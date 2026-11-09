import { sectionBuilder } from "@entrust/forms";
import { APPLICATION_0_1_0 } from "./v1";
import type { ApplicationTemplate } from "./types";

// The Summit application form, version 0.2.0, published on 9 November 2026. It is 0.1.0 with financial records taken out,
// because the partner pack going to institutions says they do not need to be submitted:
// - S5.2 ("Can you provide financial statements or management accounts for the last two years?") is gone.
// - The applicant types in two key figures instead (S5.6, S5.7), beside the annual revenue the form already asks in S2.4.
// - "Financial statements or management accounts" is no longer one of the documents S8.1 offers, and the business plan is
//   no longer "or financial model".
// Every other question keeps its ID and its wording, so an answer given under 0.1.0 still fits. The report's "Financial
// statements available" column has no question behind it any more.
// A published version never changes: a correction is a new version.

const s5 = sectionBuilder("S5");

const { financialStatements: _dropped, ...report } = APPLICATION_0_1_0.inputs.report;

export const APPLICATION_0_2_0: ApplicationTemplate = {
  ...APPLICATION_0_1_0,
  version: "0.2.0",
  inputs: { ...APPLICATION_0_1_0.inputs, report },
  sections: APPLICATION_0_1_0.sections.map((section) => {
    if (section.id === "S5") return { ...section, purpose: "Financial figures, operations, management, certifications" };
    if (section.id === "S8") return { ...section, purpose: "Registration, product, and investment documents" };
    return section;
  }),
  questions: APPLICATION_0_1_0.questions.flatMap((q) => {
    switch (q.id) {
      case "S5.2":
        return [];
      case "S5.5":
        return [
          q,
          s5.yesNo("S5.6", "Was the business profitable in its last financial year?", { help: "Tell us what you know. You do not need to upload any financial records." }),
          s5.money("S5.7", "Approximately how much does the business owe in loans or other debt? Enter 0 if none.", {
            help: "Type in the figure. You do not need to upload any financial records.",
          }),
        ];
      case "S4.7":
        return [{ ...q, text: "Do you have a business plan for the investment?" }];
      case "S8.1":
        return [
          {
            ...q,
            options: q.options
              ?.filter((o) => o.value !== "financial_statements")
              .map((o) => (o.value === "business_plan" ? { ...o, label: "Business plan" } : o)),
          },
        ];
      default:
        return [q];
    }
  }),
};
