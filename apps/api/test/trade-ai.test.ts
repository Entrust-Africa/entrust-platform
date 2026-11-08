import { eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { aiCostUsd, type AiResult } from "../src/services/ai-provider";
import { callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// The AI assistant for module exercises (#76). The provider is replaced: no test calls it, or pays for it.

const provider = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../src/services/ai-provider", async (original) => {
  const actual = await original<typeof import("../src/services/ai-provider")>();
  return { ...actual, callClaude: (request: unknown) => provider.call(request) };
});

const w = {} as { learner: TestUser; other: TestUser; stranger: TestUser; admin: TestUser; reviewer: TestUser; org: string; otherOrg: string };
const RUN = "/trade/modules/M01/ai-prompts/market-research/run";
const BODY = { product: "Washed coffee", market: "Germany", buyer: "A roaster in Hamburg" };

const answer = (over: Partial<AiResult> = {}): AiResult => ({ text: "Check EU residue limits first.", refused: false, model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 500, costUsd: aiCostUsd(1000, 500), ...over });

const clearLog = async () => {
  await db.delete(schema.aiExchange).where(inArray(schema.aiExchange.userId, [w.learner.id, w.other.id, w.admin.id, w.reviewer.id]));
};

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-never-sent";
  await cleanup();
  const [learner, other, stranger, admin, reviewer] = (await Promise.all(["ai-learner", "ai-other", "ai-stranger", "ai-admin", "ai-reviewer"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { learner, other, stranger, admin, reviewer });
  process.env.ENTRUST_ORG_ID = await createOrganization("ai-entrust", [[admin, "admin"], [reviewer, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("ai-org", [[learner, "owner"]], { platform: "trade" });
  w.otherOrg = await createOrganization("ai-other-org", [[other, "owner"]], { platform: "trade" });
  await createOrganization("ai-no-trade", [[stranger, "owner"]], { platform: null });
});

beforeEach(async () => {
  provider.call.mockReset();
  provider.call.mockResolvedValue(answer());
  process.env.ANTHROPIC_API_KEY = "test-key-never-sent";
  delete process.env.AI_MONTHLY_CAP_USD;
  await clearLog();
});

afterAll(async () => {
  await clearLog();
  delete process.env.ANTHROPIC_API_KEY;
  await cleanup();
});

describe("running a prompt", () => {
  it("labels the answer as an AI suggestion and gives the checks to make", async () => {
    const res = await callV1(w.learner, "POST", RUN, BODY);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.label).toBe("AI suggestion");
    expect(res.body.text).toBe("Check EU residue limits first.");
    expect(res.body.verification.length).toBeGreaterThan(0);
  });

  it("sends the module's prompt and the three details, and nothing else", async () => {
    await callV1(w.learner, "POST", RUN, { ...BODY, statements: "secret figures" });
    const { user, system } = provider.call.mock.calls[0]![0] as { user: string; system: string };
    expect(user).toContain("Help me analyze trade flows");
    expect(user).toContain("Washed coffee");
    expect(user).toContain("Germany");
    expect(user).toContain("A roaster in Hamburg");
    expect(user + system).not.toContain("secret figures");
  });

  it("logs what was sent and what came back, for review by an administrator only", async () => {
    await callV1(w.learner, "POST", RUN, BODY);
    const log = await callV1(w.admin, "GET", "/trade/ai-exchanges");
    expect(log.status).toBe(200);
    const row = log.body.items.find((i: Json) => i.userId === w.learner.id);
    expect(row).toMatchObject({ organizationId: w.org, moduleId: "M01", promptId: "market-research", status: "completed", output: "Check EU residue limits first.", input: BODY });
    expect(log.body.monthCostUsd).toBeGreaterThan(0);
    expect((await callV1(w.reviewer, "GET", "/trade/ai-exchanges")).status).toBe(403);
    expect((await callV1(w.learner, "GET", "/trade/ai-exchanges")).status).toBe(403);
  });

  it("changes no score, plan, progress or worksheet", async () => {
    const counts = async () =>
      Promise.all([schema.capabilityScore, schema.learningPlan, schema.moduleProgress, schema.worksheetVersion, schema.evidenceRecord].map(async (table) => (await db.select().from(table)).length));
    const before = await counts();
    await callV1(w.learner, "POST", RUN, BODY);
    expect(await counts()).toEqual(before);
  });
});

describe("who can run a prompt", () => {
  it("needs TRADE access and a real prompt", async () => {
    expect((await callV1(null, "POST", RUN, BODY)).status).toBe(401);
    expect((await callV1(w.stranger, "POST", RUN, BODY)).status).toBe(403);
    expect((await callV1(w.learner, "POST", "/trade/modules/M01/ai-prompts/nope/run", BODY)).status).toBe(404);
    expect((await callV1(w.learner, "POST", "/trade/modules/M11/ai-prompts/market-research/run", BODY)).status).toBe(404);
    expect(provider.call).not.toHaveBeenCalled();
  });

  it("doesn't let someone count a request against another organisation", async () => {
    expect((await callV1(w.learner, "POST", RUN, { ...BODY, organizationId: w.otherOrg })).status).toBe(404);
    expect(provider.call).not.toHaveBeenCalled();
  });

  it("says so when the assistant isn't switched on, and the module says so too", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await callV1(w.learner, "POST", RUN, BODY);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("isn't switched on");
    expect(provider.call).not.toHaveBeenCalled();
    expect((await callV1(w.learner, "GET", "/trade/modules/M01")).body.aiAssistantEnabled).toBe(false);
    process.env.ANTHROPIC_API_KEY = "test-key-never-sent";
    expect((await callV1(w.learner, "GET", "/trade/modules/M01")).body.aiAssistantEnabled).toBe(true);
  });
});

describe("the limits", () => {
  it("stops a user after ten requests in an hour, without stopping anyone else", async () => {
    await db.insert(schema.aiExchange).values(Array.from({ length: 10 }, () => ({ userId: w.learner.id, moduleId: "M01" as const, contentVersion: "0.1.0", promptId: "market-research", input: {}, status: "completed" as const })));
    expect((await callV1(w.learner, "POST", RUN, BODY)).status).toBe(429);
    expect((await callV1(w.other, "POST", RUN, BODY)).status).toBe(200);
  });

  it("pauses everyone once the month's cap is reached", async () => {
    await db.insert(schema.aiExchange).values({ userId: w.other.id, moduleId: "M01", contentVersion: "0.1.0", promptId: "market-research", input: {}, status: "completed", costUsd: "5" });
    process.env.AI_MONTHLY_CAP_USD = "1";
    const res = await callV1(w.learner, "POST", RUN, BODY);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("limit for this month");
    expect(provider.call).not.toHaveBeenCalled();
  });
});

describe("when the provider doesn't answer", () => {
  it("logs a failure and gives a plain message without the provider's error", async () => {
    provider.call.mockRejectedValue(new Error("500 upstream key sk-ant-xyz"));
    const res = await callV1(w.learner, "POST", RUN, BODY);
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).not.toContain("sk-ant");
    const [row] = await db.select().from(schema.aiExchange).where(eq(schema.aiExchange.userId, w.learner.id));
    expect(row!.status).toBe("failed");
  });

  it("logs a refusal and gives no suggestion", async () => {
    provider.call.mockResolvedValue(answer({ refused: true, text: "" }));
    const res = await callV1(w.learner, "POST", RUN, BODY);
    expect(res.status).toBe(422);
    const [row] = await db.select().from(schema.aiExchange).where(eq(schema.aiExchange.userId, w.learner.id));
    expect(row!.status).toBe("refused");
  });
});
