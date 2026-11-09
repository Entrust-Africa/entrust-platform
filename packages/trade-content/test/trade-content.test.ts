import { CALCULATOR_NAMES, evaluateRubric } from "@entrust/trade-engine";
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
const PUBLISHED: Record<string, string> = {
  "M01@0.1.0": "73abc3d9c3bbb5ee98e90227fca6a2da7e7cda5f107b90e885d3ee5f4a130528",
  "M03@0.1.0": "d1aa13df57617e3b9a6e357650c93b806c6c2ec02b4a0cc470ea1c9c48cc0b35",
  "M04@0.1.0": "75541b37d6e52679fba4ca720a15b7f6e03f7684fd1fda8048ef28f2ba1e9f5e",
  "M07@0.1.0": "b54b6f5a5c1a0c8ea58f90dc49391d9db0fec5a1616a29f96763ee406fbc78da",
  "M02@1.0.0": "67c655893fac8c58475cb52d7b4ac4f2ea77f943ee69affec849bddadf06139e",
  "M05@1.0.0": "60869126540962ee28bc039e4231cbdf0138a8f73d39ba3b97e4516b68b53edb",
  "M06@1.0.0": "ad25907607203e55becfa3a9327c654af1c76c23f000c6c22549c7d0a373bd66",
  "M08@1.0.0": "57beed266b812892d3dff52301e65f638c6bf8a1d9c1b9513e9c98bff511c0e0",
  "M09@1.0.0": "141077f06f3b726297f42bf416f48dc1ca4218091db51f0920b6fe41df857e21",
  "M10@1.0.0": "161a134121f2fe07502fdf3222724b4add9d11aefa3f5e075820a991c6fa0c10",
  "M11@1.0.0": "e48dcbbffcf21f724fc27657bf880090abf97434a4c531a6ff5656499a724ec5",
  "M12@1.0.0": "1ca8057ddae49ee89017ada65a6874c7cfdba7b020ffeab715a28b74a17d4261",
};

const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const hashOf = (content: ModuleContent) => sha256(JSON.stringify(content));

describe("module content", () => {
  it("only names calculators that exist in the trade engine", () => {
    // A worksheet's arithmetic is always a named calculator (#64), so content can't name one that isn't there.
    const named = MODULE_CONTENT.flatMap((c) => c.worksheets.flatMap((w) => w.computed.map((f) => `${c.module}@${c.version} ${w.id}.${f.id}: ${f.calculator}`)));
    expect(named.filter((n) => !(CALCULATOR_NAMES as string[]).includes(n.split(": ")[1] as string))).toEqual([]);
  });

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

// Entrust's Curriculum and Platform Consistency Review, section 5, sets one assessment standard for all
// twelve modules. M01, M03, M04 and M07 v0.1.0 predate it, so a version joins this list once it meets it.
describe("modules on Entrust's common assessment standard", () => {
  const onStandard = MODULE_CONTENT.filter((c) => ["M02", "M05", "M06", "M08", "M09", "M10", "M11", "M12"].includes(c.module));

  it("publishes the eight modules on the standard, with a record of who approved them", () => {
    expect(onStandard.map((c) => `${c.module}@${c.version} ${c.status}`)).toEqual(["M02", "M05", "M06", "M08", "M09", "M10", "M11", "M12"].map((m) => `${m}@1.0.0 approved`));
    expect(onStandard.every((c) => c.approval?.by === "Minase Fikadu, TRADE platform team")).toBe(true);
    expect(listModules("learner").find((m) => m.id === "M05")).toMatchObject({ contentStatus: "ready", versions: ["1.0.0"] });
  });

  it.each(onStandard.map((c) => [c.module, c] as const))("%s has ten questions with four options and one answer, passing at 80%%", (_, content) => {
    expect(content.knowledgeCheck.passMark).toBe(80);
    expect(content.knowledgeCheck.questions).toHaveLength(10);
    for (const q of content.knowledgeCheck.questions) {
      expect(q.options.map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
      expect(q.correct).toHaveLength(1);
    }
  });

  it.each(onStandard.map((c) => [c.module, c] as const))("%s scores six criteria out of 36 and passes at exactly 24 with no critical failure", (_, content) => {
    const { rubric } = content;
    expect(rubric.criteria.map((c) => c.maxPoints)).toEqual([6, 6, 6, 6, 6, 6]);
    expect(rubric.passMark).toBe(24);
    expect(rubric.criteria.some((c) => c.mustHave)).toBe(false);
    expect(rubric.criticalFailures.length).toBeGreaterThan(0);

    const scored = (total: number) => Object.fromEntries(rubric.criteria.map((c, i) => [c.id, { points: Math.floor(total / 6) + (i < total % 6 ? 1 : 0) }]));
    expect(evaluateRubric(rubric, scored(24))).toMatchObject({ totalPoints: 24, maxPoints: 36, passed: true });
    expect(evaluateRubric(rubric, scored(23))).toMatchObject({ totalPoints: 23, passed: false });
    expect(evaluateRubric(rubric, scored(36), [rubric.criticalFailures[0]!.id])).toMatchObject({ totalPoints: 36, passed: false });
  });

  it("defines one worksheet per required output, ending with the learning plan", () => {
    expect(onStandard.map((c) => [c.module, c.lessons.length, c.worksheets.length])).toEqual([
      ["M02", 7, 7],
      ["M05", 8, 8],
      ["M06", 8, 9],
      ["M08", 9, 10],
      ["M09", 9, 9],
      ["M10", 9, 9],
      ["M11", 9, 10],
      ["M12", 6, 6],
    ]);
    // M12's plan is itself the learner's plan, so it has no individual learning plan after it.
    for (const content of onStandard) expect(content.worksheets.at(-1)?.id).toBe(content.module === "M12" ? "action_plan" : "individual_learning_plan");
  });

  it("sets M11 out as eight gates in order, with each output tied to one", () => {
    const m11 = onStandard.find((c) => c.module === "M11")!;
    expect(m11.lessons.map((l) => l.id)).toEqual(["introduction", ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `gate-${n}`)]);
    expect(m11.worksheets.slice(0, 9).map((w) => w.description?.match(/^Gate (\d)/)?.[1])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "8"]);
    // M11's document explains its first two answers, and those reach feedback.
    expect(m11.knowledgeCheck.questions[0]!.explanation).toContain("clarify the commercial requirement");
    expect(m11.knowledgeCheck.questions.every((q) => q.lessonId?.startsWith("gate-"))).toBe(true);
  });

  it("carries the case materials the exercises rely on, labelled fictional, with the answers for staff only", () => {
    const lesson = (module: string, id: string) => onStandard.find((c) => c.module === module)!.lessons.find((l) => l.id === id)!.body;
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(lesson("M11", `gate-${n}`), `gate ${n}`).toContain("Case file");
    for (const [module, id] of [["M05", "lesson-6"], ["M06", "lesson-4"], ["M06", "lesson-7"], ["M08", "lesson-1"], ["M08", "lesson-3"], ["M08", "lesson-5"], ["M08", "lesson-6"], ["M08", "lesson-8"], ["M09", "lesson-5"], ["M09", "lesson-8"]] as const) {
      const body = lesson(module, id);
      expect(body, `${module} ${id}`).toContain("fictional training document");
      // The sample comes before the exercise that uses it.
      expect(body.indexOf("fictional training document"), `${module} ${id}`).toBeLessThan(body.indexOf("## Practical exercise"));
    }
    for (const content of onStandard.filter((c) => ["M05", "M06", "M08", "M09", "M11"].includes(c.module))) {
      expect(content.staff.facilitatorGuide).toContain("Case material notes");
      expect(JSON.stringify(toLearnerView(content))).not.toContain("Case material notes");
    }
  });

  it("holds M12's action register to 5 to 10 actions", () => {
    const register = onStandard.find((c) => c.module === "M12")!.worksheets.find((w) => w.id === "action_register")!;
    expect(register.tables[0]).toMatchObject({ minRows: 5, maxRows: 10 });
  });

  it("gives M09's prompts their verification steps, so approving it won't fail validation", () => {
    const prompts = onStandard.find((c) => c.module === "M09")!.aiPrompts;
    expect(prompts.map((p) => p.id)).toEqual(["company-profile", "action-register", "costing-review"]);
    for (const prompt of prompts) expect(prompt.verification).toHaveLength(7);
  });

  it("never gives a learner the answers or the staff material", () => {
    for (const content of onStandard) {
      const view = JSON.stringify(toLearnerView(content));
      expect(view).not.toContain('"correct"');
      expect(view).not.toContain("Assessor scoring guide");
    }
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
    const modules = listModules("learner", []);
    expect(modules.map((m) => m.id)).toEqual([...MODULE_IDS]);
    expect(modules.every((m) => m.contentStatus === "in_production" && m.latestVersion === null && m.versions.length === 0)).toBe(true);
    expect(modules.find((m) => m.id === "M04")?.title).toBe("Trade Finance and Payment Risk");
    expect(listModules("staff", [])).toEqual(modules);

    const loaded = listModules("learner");
    expect(loaded.find((m) => m.id === "M01")?.contentStatus).toBe("ready");
    expect(loaded.find((m) => m.id === "M03")?.contentStatus).toBe("ready");
    expect(loaded.find((m) => m.id === "M04")?.contentStatus).toBe("ready");
    expect(loaded.every((m) => m.contentStatus === "ready")).toBe(true);
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
