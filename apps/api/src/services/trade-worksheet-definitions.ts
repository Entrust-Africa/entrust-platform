import { findVersion, visibleVersions } from "@entrust/trade-content";
import { WORKSHEET_DEFINITIONS, findWorksheet, type WorksheetDefinition } from "@entrust/trade-engine";
import { MODULE_IDS, type ModuleId } from "@entrust/trade-rules";

// Every worksheet an SME can fill in. Worksheets with arithmetic are defined in @entrust/trade-engine. A module with none there
// carries its own in its content package (M05, M08, M09, M10): forms with no calculators, one per required output.

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

/** The worksheets a module's newest content version carries, unless the engine already defines that module's worksheets. */
function fromContent(moduleId: ModuleId): WorksheetDefinition[] {
  if (WORKSHEET_DEFINITIONS.some((d) => d.module === moduleId)) return [];
  const content = visibleVersions(moduleId, "staff")[0];
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

export const moduleContentWorksheets = (moduleId: ModuleId): WorksheetDefinition[] => fromContent(moduleId);

export const allWorksheetDefinitions = (): WorksheetDefinition[] => [...WORKSHEET_DEFINITIONS, ...MODULE_IDS.flatMap(fromContent)];

export const findWorksheetDefinition = (id: string): WorksheetDefinition | undefined =>
  findWorksheet(id) ?? allWorksheetDefinitions().find((d) => d.id === id);

/** The individual learning plan is the output that follows the assessor's review, so it's not part of the practical submission. */
export const isLearningPlan = (def: WorksheetDefinition): boolean => def.id.endsWith(LEARNING_PLAN.replaceAll("_", "-"));

/** A draft module's worksheets stay with staff, like its lessons. */
export function canOpenWorksheet(def: WorksheetDefinition, staff: boolean): boolean {
  return findWorksheet(def.id) !== undefined || findVersion(def.module, staff ? "staff" : "learner") !== undefined;
}
