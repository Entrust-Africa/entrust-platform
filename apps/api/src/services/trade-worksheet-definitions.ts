import { findVersion, visibleVersions } from "@entrust/trade-content";
import { WORKSHEET_DEFINITIONS, findWorksheet, type WorksheetDefinition } from "@entrust/trade-engine";
import { MODULE_IDS, type ModuleId } from "@entrust/trade-rules";

// Every worksheet an SME can fill in. Worksheets with arithmetic are defined in @entrust/trade-engine. A module with none there
// carries its own in its content package (M05, M08, M09, M10): forms with no calculators, one per required output.

const LEARNING_PLAN = "individual_learning_plan";

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
