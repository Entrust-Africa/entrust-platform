import { MODULE_IDS } from "@entrust/trade-rules";
import { describe, expect, it } from "vitest";
import { MODULE_CONTENT, findVersion, learnerModuleSchema, listModules, newerVersion, toLearnerView, validateModuleContent, visibleVersions } from "../src";
import type { ModuleContent } from "../src";
import { approved, fixture } from "./fixture";

const errorsFor = (...versions: unknown[]) => validateModuleContent(versions);
/** The content with part of it changed, for the validator to catch. */
const withRubric = (change: Partial<ModuleContent["rubric"]>) => fixture({ rubric: { ...fixture().rubric, ...change } });
const withQuestion = (index: number, change: Partial<ModuleContent["knowledgeCheck"]["questions"][number]>) => {
  const check = fixture().knowledgeCheck;
  return fixture({ knowledgeCheck: { ...check, questions: check.questions.map((q, i) => (i === index ? { ...q, ...change } : q)) } });
};

// The content of every approved version. Every learner keeps the version they started, so an approved
// version must not change: put a correction in a new version instead. Add a line here, keyed
// "M04@0.1.0", when a version is approved. Drafts can still change and aren't listed.
const PUBLISHED: Record<string, string> = {};

const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const hashOf = (content: ModuleContent) => sha256(JSON.stringify(content));

describe("module content", () => {
  it("all validates", () => {
    expect(errorsFor(...MODULE_CONTENT)).toEqual([]);
  });

  it("never changes once approved", async () => {
    const hashes = Object.fromEntries(
      await Promise.all(MODULE_CONTENT.filter((c) => c.status === "approved").map(async (c) => [`${c.module}@${c.version}`, await hashOf(c)])),
    );
    expect(hashes).toEqual(PUBLISHED);
  });

  it("would catch an approved version that was edited", async () => {
    const before = await hashOf(approved());
    expect(await hashOf(approved())).toBe(before);
    expect(await hashOf(approved({ title: "Test module, reworded" }))).not.toBe(before);
    const edited = approved();
    edited.lessons[0]!.body += " (corrected)";
    expect(await hashOf(edited)).not.toBe(before);
  });
});

describe("validation", () => {
  it("accepts a complete draft and a complete approved version", () => {
    expect(errorsFor(fixture())).toEqual([]);
    expect(errorsFor(approved())).toEqual([]);
  });

  it("rejects a rubric whose pass mark is above its maximum", () => {
    expect(errorsFor(withRubric({ passMark: 10 }))).toEqual(["M04@0.1.0: rubric.passMark: the pass mark is 10, above the rubric's maximum of 9"]);
    expect(errorsFor(withRubric({ passMark: 9 }))).toEqual([]);
  });

  it("rejects a question without a correct answer", () => {
    expect(errorsFor(withQuestion(0, { correct: [] }))).toEqual(["M04@0.1.0: knowledgeCheck.questions.0.correct: a question needs a correct answer"]);
    const missing = { ...fixture().knowledgeCheck.questions[0]! } as Record<string, unknown>;
    delete missing.correct;
    expect(errorsFor({ ...fixture(), knowledgeCheck: { passMark: 80, questions: [missing] } })).toHaveLength(1);
    expect(errorsFor(withQuestion(0, { correct: ["z"] }))).toEqual(["M04@0.1.0: knowledgeCheck.questions.0: q1: the correct answer z isn't one of the options"]);
  });

  it("checks the rest of the knowledge check and the rubric", () => {
    expect(errorsFor(withQuestion(0, { correct: ["a", "b", "c"] }))).toEqual(["M04@0.1.0: knowledgeCheck.questions.0: q1: every option is correct"]);
    expect(errorsFor(withQuestion(0, { options: [{ id: "a", text: "Only one" }], correct: ["a"] }))[0]).toContain("knowledgeCheck.questions.0.options");
    expect(errorsFor(fixture({ knowledgeCheck: { ...fixture().knowledgeCheck, passMark: 101 } }))[0]).toContain("knowledgeCheck.passMark");
    expect(errorsFor(withRubric({ mustHaveMinimum: 4 }))).toEqual([
      "M04@0.1.0: rubric.mustHaveMinimum: gap is must-have but is worth 3, below the minimum of 4",
      "M04@0.1.0: rubric.mustHaveMinimum: plan is must-have but is worth 3, below the minimum of 4",
    ]);
    expect(errorsFor(withRubric({ bands: [{ label: "Critical", from: 10 }] }))).toEqual(["M04@0.1.0: rubric.bands: the first band starts at 0"]);
    expect(errorsFor(withRubric({ bands: [{ label: "Critical", from: 0 }, { label: "Developing", from: 0 }] }))).toEqual([
      "M04@0.1.0: rubric.bands: band Developing doesn't start above Critical",
    ]);
    expect(errorsFor(withRubric({ criteria: [] }))[0]).toContain("rubric.criteria");
  });

  it("wants an approval record exactly when the version is approved", () => {
    expect(errorsFor(fixture({ status: "approved" }))).toEqual(["M04@0.1.0: approval: an approved version records who approved it and when"]);
    expect(errorsFor(fixture({ approval: { by: "Entrust", at: "2026-11-02" } }))).toEqual(["M04@0.1.0: approval: a draft has no approval record"]);
    expect(errorsFor(approved({ approval: { by: "Entrust", at: "02/11/2026" } }))[0]).toContain("approval.at");
  });

  it("lets a draft's AI prompt lack a verification step, but not an approved one's", () => {
    const prompts = [{ id: "outreach", title: "Outreach", prompt: "Write an email", verification: [] }];
    expect(errorsFor(fixture({ aiPrompts: prompts }))).toEqual([]);
    expect(errorsFor(approved({ aiPrompts: prompts }))).toEqual(["M04@0.1.0: aiPrompts: outreach: an approved AI prompt has a verification checklist"]);
  });

  it("checks worksheet definitions", () => {
    const [worksheet] = fixture().worksheets;
    const withWorksheet = (change: Partial<NonNullable<typeof worksheet>>) => fixture({ worksheets: [{ ...worksheet!, ...change }] });
    expect(errorsFor(withWorksheet({ computed: [{ id: "gap", label: "Gap", kind: "money", calculator: "fundingGap", inputs: ["outlay", "ghost"] }] }))).toEqual([
      "M04@0.1.0: worksheets.0: brief: gap reads ghost, which isn't in the worksheet",
    ]);
    expect(errorsFor(withWorksheet({ computed: [{ id: "outlay", label: "Outlay", kind: "money", calculator: "x", inputs: [] }] }))).toEqual([
      "M04@0.1.0: worksheets.0: brief: outlay is used twice",
    ]);
    expect(errorsFor(withWorksheet({ fields: [{ id: "terms", label: "Terms", kind: "choice" }], tables: [], computed: [] }))).toEqual([
      "M04@0.1.0: worksheets.0: brief: choice field terms needs at least two options",
    ]);
    expect(errorsFor(withWorksheet({ fields: [], tables: [], computed: [] }))).toEqual(["M04@0.1.0: worksheets.0: brief: has no fields or tables"]);
  });

  it("rejects repeats, unknown modules, bad versions and stray keys", () => {
    expect(errorsFor(fixture(), fixture())).toEqual(["M04@0.1.0: published twice"]);
    expect(errorsFor(fixture(), fixture({ version: "0.2.0" }))).toEqual([]);
    expect(errorsFor({ ...fixture(), module: "M13" })[0]).toContain("module");
    expect(errorsFor(fixture({ version: "1.0" }))[0]).toContain("major.minor.patch");
    expect(errorsFor({ ...fixture(), answerKey: "x" })[0]).toContain("answerKey");
    expect(errorsFor(fixture({ lessons: [fixture().lessons[0]!, fixture().lessons[0]!] }))).toEqual(["M04@0.1.0: lessons: duplicate lesson lesson-1"]);
    expect(errorsFor(null)[0]).toContain("unnamed content");
  });
});

describe("what each audience sees", () => {
  const content = [fixture({ version: "0.1.0" }), approved({ version: "0.2.0" }), approved({ version: "0.10.0", title: "Newest" }), fixture({ module: "M01", title: "M01 draft", version: "0.3.0" })];

  it("lists all twelve modules, in production until content is loaded", () => {
    const modules = listModules("learner");
    expect(modules.map((m) => m.id)).toEqual([...MODULE_IDS]);
    expect(modules.every((m) => m.contentStatus === "in_production" && m.latestVersion === null && m.versions.length === 0)).toBe(true);
    expect(modules.find((m) => m.id === "M04")?.title).toBe("Trade Finance and Payment Risk");
    expect(listModules("staff")).toEqual(modules);
  });

  it("shows an SME only approved versions, newest first by number", () => {
    expect(visibleVersions("M04", "learner", content).map((c) => c.version)).toEqual(["0.10.0", "0.2.0"]);
    expect(visibleVersions("M04", "staff", content).map((c) => c.version)).toEqual(["0.10.0", "0.2.0", "0.1.0"]);
    expect(findVersion("M04", "learner", undefined, content)?.title).toBe("Newest");
    expect(findVersion("M04", "learner", "0.1.0", content)).toBeUndefined();
    expect(findVersion("M04", "staff", "0.1.0", content)?.status).toBe("draft");
    expect(findVersion("M05", "staff", undefined, content)).toBeUndefined();
  });

  it("calls a module with only drafts a draft to staff and in production to an SME", () => {
    const [m01] = listModules("staff", content).filter((m) => m.id === "M01");
    expect(m01).toMatchObject({ contentStatus: "draft", latestVersion: "0.3.0", title: "M01 draft" });
    expect(listModules("learner", content).find((m) => m.id === "M01")).toMatchObject({ contentStatus: "in_production", latestVersion: null });
    expect(listModules("learner", content).find((m) => m.id === "M04")).toMatchObject({ contentStatus: "ready", latestVersion: "0.10.0", versions: ["0.10.0", "0.2.0"] });
  });

  it("says when a newer version exists than the one a learner started", () => {
    expect(newerVersion("M04", "learner", "0.2.0", content)).toBe("0.10.0");
    expect(newerVersion("M04", "learner", "0.10.0", content)).toBeNull();
    expect(newerVersion("M05", "learner", "0.1.0", content)).toBeNull();
  });

  it("never gives an SME the answer keys, explanations, auto-checks or staff material", () => {
    const view = JSON.stringify(toLearnerView(approved()));
    for (const secret of ["correct", "explanation", "The seller ships before it is paid", "autoCheck", "open-account-unverified", "facilitatorGuide", "Spend ten minutes", "liveSessionPlan", "hybridSequence", "staff"]) {
      expect(view, secret).not.toContain(secret);
    }
    // The view carries nothing its schema doesn't list, which is what the API documents.
    expect(learnerModuleSchema.safeParse(toLearnerView(approved())).success).toBe(true);
    expect(learnerModuleSchema.safeParse({ ...toLearnerView(approved()), staff: approved().staff }).success).toBe(false);
    const [one, two] = toLearnerView(approved()).knowledgeCheck.questions;
    expect([one?.multiple, two?.multiple]).toEqual([false, true]);
    // What a learner does need: the lessons, the rubric they are assessed on and the prompts.
    expect(view).toContain("Funding gaps");
    expect(toLearnerView(approved()).rubric.criticalFailures).toEqual([
      { id: "open-account", text: "Open account with an unverified buyer" },
      { id: "no-freight", text: "Freight missing from the outlays" },
    ]);
    expect(toLearnerView(approved()).aiPrompts).toHaveLength(1);
  });
});
