import { MODULE_CONTENT, findVersion, visibleVersions, type ModuleContent } from "@entrust/trade-content";
import { WORKSHEET_DEFINITIONS, findWorksheet, type WorksheetDefinition } from "@entrust/trade-engine";
import { MODULE_IDS, type ModuleId } from "@entrust/trade-rules";

// Every worksheet an SME can fill in. Worksheets with arithmetic are defined in @entrust/trade-engine. A module's content package
// carries the rest: forms with no calculators, one per required output (M05, M08, M09, M10), or, for M01, M03, M04 and M07, the
// outputs the engine's forms don't cover.

const LEARNING_PLAN = "individual_learning_plan";

const BUYER_PIPELINE = "m05-qualified-buyer-pipeline";
const BUYER_REGISTER = "m10-relationship-register";
const CONTENT_PREFILL: Readonly<Record<string, string>> = { [BUYER_REGISTER]: BUYER_PIPELINE };

// M05's stages end where M10's begin. Where they name the same stage it carries over as it is.
const REGISTER_STAGE: Readonly<Record<string, string>> = {
  identified: "identified",
  researched: "researched",
  qualified: "qualified",
  contacted: "contacted",
  engaged: "responded",
  requirements_confirmed: "qualified",
  quotation_submitted: "quotation_submitted",
  negotiation: "negotiation",
  order_confirmed: "order_confirmed",
  closed_won: "transaction_completed",
  closed_lost: "inactive_or_lost",
};

/** What a new draft starts with when it builds on another content worksheet: M10's register starts with M05's buyers, so nobody types them twice. */
export function prefillContentWorksheet(targetId: string, values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (targetId !== BUYER_REGISTER || !Array.isArray(values.pipeline)) return {};
  const buyers = (values.pipeline as Record<string, unknown>[]).map((row) => ({
    legal_name: row.company_name,
    location: row.country,
    contacts: row.contact_person,
    products: row.product,
    verification: row.verification_status,
    stage: REGISTER_STAGE[String(row.stage)] ?? "identified",
    follow_up: row.next_follow_up,
  }));
  return buyers.length ? { buyers: buyers.map((b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined && v !== null && v !== ""))) } : {};
}

/**
 * The worksheets of the newest version learners can open. M01, M03, M04 and M07 add these to the forms the engine defines,
 * for the outputs those forms don't cover. A draft committed to the repo doesn't count: its worksheets would otherwise
 * reach learners and change what a submission and completion need before anyone approved it. A module with drafts only
 * shows its newest draft's worksheets, to staff (canOpenWorksheet keeps them from learners).
 */
function fromContent(moduleId: ModuleId, bundle: readonly ModuleContent[] = MODULE_CONTENT): WorksheetDefinition[] {
  const content = visibleVersions(moduleId, "learner", bundle)[0] ?? visibleVersions(moduleId, "staff", bundle)[0];
  if (!content) return [];
  return content.worksheets.map((w) => ({
    id: `${moduleId.toLowerCase()}-${w.id.replaceAll("_", "-")}`,
    module: moduleId,
    title: w.title,
    description: w.description ?? `Part of ${content.title}.`,
    money: false,
    fields: w.fields,
    tables: w.tables,
    computed: [],
    sections: [{ id: "form", title: "Your answers", items: [...w.fields.map((f) => f.id), ...w.tables.map((t) => t.id)] }],
    ...(CONTENT_PREFILL[`${moduleId.toLowerCase()}-${w.id.replaceAll("_", "-")}`] ? { prefillFrom: CONTENT_PREFILL[`${moduleId.toLowerCase()}-${w.id.replaceAll("_", "-")}`]! } : {}),
  }));
}

export const moduleContentWorksheets = (moduleId: ModuleId, bundle: readonly ModuleContent[] = MODULE_CONTENT): WorksheetDefinition[] => fromContent(moduleId, bundle);

export const allWorksheetDefinitions = (): WorksheetDefinition[] => [...WORKSHEET_DEFINITIONS, ...MODULE_IDS.flatMap((id) => fromContent(id))];

export const findWorksheetDefinition = (id: string): WorksheetDefinition | undefined =>
  findWorksheet(id) ?? allWorksheetDefinitions().find((d) => d.id === id);

/** The individual learning plan is the output that follows the assessor's review, so it's not part of the practical submission. */
export const isLearningPlan = (def: WorksheetDefinition): boolean => def.id.endsWith(LEARNING_PLAN.replaceAll("_", "-"));

/** A draft module's worksheets stay with staff, like its lessons. */
export function canOpenWorksheet(def: WorksheetDefinition, staff: boolean): boolean {
  return findWorksheet(def.id) !== undefined || findVersion(def.module, staff ? "staff" : "learner") !== undefined;
}
