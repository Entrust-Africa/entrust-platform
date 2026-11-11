import { MODULE_CONTENT, type ModuleContent } from "@entrust/trade-content";
import { describe, expect, it } from "vitest";
import { moduleContentWorksheets } from "../src/services/trade-worksheet-definitions";

// A draft version committed to the repo isn't approved, so it mustn't change what learners fill in or what a submission
// needs. Every bundled version is approved today, so the draft here is made up.
describe("the worksheets a module's content gives learners", () => {
  const m05 = MODULE_CONTENT.find((c) => c.module === "M05" && c.version === "1.0.0")!;
  const { approval: _approval, ...unapproved } = m05;
  const draft: ModuleContent = {
    ...unapproved,
    version: "9.0.0",
    status: "draft",
    worksheets: [...m05.worksheets, { id: "draft_only_form", title: "Not approved yet", fields: [{ id: "note", label: "Note", kind: "text" }], tables: [], computed: [] }],
  };

  it("come from the newest approved version, not a newer draft", () => {
    const ids = moduleContentWorksheets("M05", [...MODULE_CONTENT, draft]).map((d) => d.id);
    expect(ids).toEqual(moduleContentWorksheets("M05").map((d) => d.id));
    expect(ids).not.toContain("m05-draft-only-form");
  });

  it("show a draft-only module's worksheets, which canOpenWorksheet keeps to staff", () => {
    const ids = moduleContentWorksheets("M05", [draft]).map((d) => d.id);
    expect(ids).toContain("m05-draft-only-form");
  });
});
