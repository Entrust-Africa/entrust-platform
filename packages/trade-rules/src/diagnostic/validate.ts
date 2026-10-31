import { formDefinitionErrors } from "@entrust/forms";
import { DIAGNOSTIC_STORAGE } from "./types";
import type { DiagnosticTemplate } from "./types";

const duplicates = <T>(values: readonly T[]): T[] => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];

function templateErrors(template: DiagnosticTemplate): string[] {
  const errors = formDefinitionErrors(template);
  const questions = new Map(template.questions.map((q) => [q.id, q]));
  const sections = new Set(template.sections.map((s) => s.id));

  for (const s of template.sections) {
    const storage = template.storage[s.id];
    if (!storage) errors.push(`section ${s.id}: says nowhere to store its answers`);
    else if (!DIAGNOSTIC_STORAGE.includes(storage)) errors.push(`section ${s.id}: unknown storage ${storage}`);
  }
  for (const id of Object.keys(template.storage)) if (!sections.has(id)) errors.push(`storage names missing section ${id}`);

  for (const [id, reason] of Object.entries(template.omitted)) {
    if (questions.has(id)) errors.push(`${id}: is both asked and listed as omitted`);
    if (!reason.trim()) errors.push(`${id}: omitted without a reason`);
  }

  const { exported, lastShipment, liveOrder } = template.pathwayInputs;
  const input = (id: string, type: "yes_no" | "date", name: string) => {
    const q = questions.get(id);
    if (!q) errors.push(`pathway input ${name} names missing question ${id}`);
    else if (q.type !== type) errors.push(`pathway input ${name}: ${id} is a ${q.type} question, not ${type}`);
    return q;
  };
  input(exported, "yes_no", "exported");
  const shipment = input(lastShipment, "date", "lastShipment");
  if (shipment && !JSON.stringify(shipment.showIf ?? {}).includes(`"${exported}"`)) {
    errors.push(`${lastShipment}: should be asked only after ${exported}, which says whether there was a shipment`);
  }
  if (!liveOrder.length) errors.push("pathway input liveOrder names no question");
  for (const id of duplicates(liveOrder)) errors.push(`pathway input liveOrder lists ${id} twice`);
  for (const id of liveOrder) input(id, "yes_no", "liveOrder");
  return errors;
}

/** Check published versions of the diagnostic for internal consistency. One message per problem; empty when valid. */
export function validateDiagnosticTemplates(templates: readonly DiagnosticTemplate[]): string[] {
  const errors = duplicates(templates.map((t) => t.version)).map((v) => `${v}: published twice`);
  for (const t of templates) errors.push(...templateErrors(t).map((message) => `${t.version}: ${message}`));
  return errors;
}
