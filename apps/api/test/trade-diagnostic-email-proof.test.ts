import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPublicDiagnosticEmail } from "../src/services/trade-public-diagnostic";
import { PREFIX, callV1, cleanup, db, signUp, type TestUser } from "./support";

// The public diagnostic proves the visitor's email only when they confirm it from the link we email (the link shown on
// screen after starting proves nothing). Confirming moves the draft to a new private link and gives the visitor an
// account (on AfriConnect and Entrust).

const queued = vi.hoisted(() => [] as Array<{ name: string; data: { to?: string; props?: { action?: { url?: string } } } }>);
vi.mock("@entrust/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@entrust/jobs")>()),
  enqueue: async (name: string, data: never) => {
    queued.push({ name, data });
    return "job";
  },
}));

const post = (path: string, body?: unknown) => callV1(null, "POST", `/trade${path}`, body);
const get = (path: string) => callV1(null, "GET", `/trade${path}`);
const email = (name: string) => `${PREFIX}proof-${Math.random().toString(36).slice(2, 8)}-${name}@example.test`;

let person: TestUser;

beforeAll(async () => {
  await db.delete(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, `${PREFIX}%`));
  person = await signUp("proof-person");
});

afterAll(async () => {
  await db.delete(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, `${PREFIX}%`));
  await cleanup();
});

beforeEach(() => {
  queued.length = 0;
});

/** Starts a draft and returns its token and the proof from the emailed link. */
async function start(name: string) {
  const address = email(name);
  const res = await post("/public/diagnostic", { email: address, phone: "+251911234567", businessName: `Business ${name}` });
  expect(res.status).toBe(201);
  const mail = queued.find((job) => job.data.to === address);
  const link = new URL(mail!.data.props!.action!.url!);
  expect(link.pathname).toBe(`/onboarding/${res.body.token}`);
  const proof = link.searchParams.get("proof");
  expect(proof).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  return { token: res.body.token as string, proof: proof!, address };
}

describe("proving the email on the public diagnostic", () => {
  it("starts unproven; the on-screen token alone never proves it", async () => {
    const { token } = await start("unproven");
    const view = await get(`/public/diagnostic/${token}`);
    expect(view.body.emailVerified).toBe(false);
    const wrong = await post(`/public/diagnostic/${token}/verify-email`, { proof: token });
    expect(wrong.status).toBe(200);
    expect(wrong.body.emailVerified).toBe(false);
    expect(wrong.body.token).toBeUndefined();
  });

  it("confirming moves the draft to a new private link, emails it, and the old link stops working", async () => {
    const { token, proof, address } = await start("rotate");
    queued.length = 0;
    const res = await post(`/public/diagnostic/${token}/verify-email`, { proof });
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(true);
    const fresh = res.body.token as string;
    expect(fresh).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(fresh).not.toBe(token);

    expect((await get(`/public/diagnostic/${token}`)).status).toBe(404);
    const moved = await get(`/public/diagnostic/${fresh}`);
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ email: address, emailVerified: true });

    const mail = queued.find((job) => job.data.to === address);
    expect(new URL(mail!.data.props!.action!.url!).pathname).toBe(`/onboarding/${fresh}`);
    expect(mail!.data.props!.action!.url).not.toContain("proof");

    const [row] = await db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.email, address));
    expect(row!.emailProofHash).toBeNull();
    // AfriConnect is off in this file, so no account.
    expect(row!.userId).toBeNull();

    // The proof is spent.
    const again = await post(`/public/diagnostic/${fresh}/verify-email`, { proof });
    expect(again.body.token).toBeUndefined();
  });

  it("makes the account once, when the address is confirmed, and records the user", async () => {
    const { token, proof, address } = await start("account");
    const ensure = vi.fn(async () => ({ status: "linked" as const, userId: person.id, created: true }));
    const now = new Date();
    const view = await verifyPublicDiagnosticEmail({ db, now }, token, proof, ensure);
    expect(view.emailVerified).toBe(true);
    expect(ensure).toHaveBeenCalledWith({ email: address });
    const [row] = await db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.email, address));
    expect(row!.userId).toBe(person.id);

    await verifyPublicDiagnosticEmail({ db, now }, view.token!, proof, ensure);
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("a failed or refused account leaves the draft confirmed, and is not retried by the link", async () => {
    const { token, proof, address } = await start("retry");
    const now = new Date();
    const failing = vi.fn(async () => {
      throw new Error("AfriConnect is down");
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const first = await verifyPublicDiagnosticEmail({ db, now }, token, proof, failing);
    errors.mockRestore();
    expect(first.emailVerified).toBe(true);

    const ensure = vi.fn(async () => ({ status: "linked" as const, userId: person.id, created: false }));
    await verifyPublicDiagnosticEmail({ db, now }, first.token!, "spent-proof-value-0000000000", ensure);
    await verifyPublicDiagnosticEmail({ db, now }, first.token!, proof, ensure);
    expect(ensure).not.toHaveBeenCalled();
    const [row] = await db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.email, address));
    expect(row!.emailVerifiedAt).not.toBeNull();
    expect(row!.userId).toBeNull();

    const { token: other, proof: otherProof, address: otherAddress } = await start("conflict");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await verifyPublicDiagnosticEmail({ db, now }, other, otherProof, async () => ({
      status: "conflict",
      reason: "an Entrust account for this email was never verified",
    }));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    const [conflicted] = await db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.email, otherAddress));
    expect(conflicted!.userId).toBeNull();
  });

  it("refuses a proof that is not a token, and a draft's proof does not prove another draft", async () => {
    const a = await start("a");
    const b = await start("b");
    const malformed = await post(`/public/diagnostic/${a.token}/verify-email`, { proof: "x".repeat(101) });
    expect(malformed.status).toBe(400);
    const crossed = await post(`/public/diagnostic/${a.token}/verify-email`, { proof: b.proof });
    expect(crossed.body.emailVerified).toBe(false);
  });
});
