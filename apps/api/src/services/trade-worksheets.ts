import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  WORKSHEET_DEFINITIONS,
  computeWorksheet,
  findWorksheet,
  isShown,
  prefillFrom,
  type WorksheetContext,
  type WorksheetDefinition,
  type WorksheetField,
  type WorksheetResult,
  type WorksheetValues,
} from "@entrust/trade-engine";
import type { WorksheetDefinitionView, WorksheetVersionView } from "../schemas/trade";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { evaluateAndSyncModuleCompletion } from "./trade-completion";
import { accessTo, recordTradeChange, type Access } from "./trade-shared";
import { allWorksheetDefinitions, canOpenWorksheet, findWorksheetDefinition, isLearningPlan, prefillContentWorksheet } from "./trade-worksheet-definitions";

// Worksheets (#64, #65): structured forms an SME fills in while it learns. Values save as they type and are labelled self-reported.
// Submitting turns a draft into a numbered version that is kept and never edited; editing starts the next draft from it. The
// arithmetic is in @entrust/trade-engine (never AI), and a submitted version keeps what it worked out, so it reads the same forever.

type VersionRow = typeof schema.worksheetVersion.$inferSelect;
type EnrollmentRow = typeof schema.enrollment.$inferSelect;

const MAX_VALUES_BYTES = 200_000;
const LIVE_ENROLLMENT = ["invited", "registered", "active"] as const;

const definitionOf = (id: string, staff = true): WorksheetDefinition => {
  const def = findWorksheetDefinition(id);
  if (!def || !canOpenWorksheet(def, staff)) throw new ServiceError("not_found", "Worksheet not found.");
  return def;
};

/** What a worksheet works out. One carried by a module's content has no calculators, so there is nothing to work out. */
const computeFor = (def: WorksheetDefinition, values: WorksheetValues, context: WorksheetContext): WorksheetResult =>
  findWorksheet(def.id) ? computeWorksheet(def.id, values, context) : { computed: {}, rows: {}, etb: {}, flags: [], problems: [] };

// ---- Definitions ----

const fieldView = (f: WorksheetField) => ({
  id: f.id,
  label: f.label,
  kind: f.kind,
  required: f.required === true,
  help: f.help ?? null,
  options: f.options ? f.options.map((o) => ({ ...o })) : null,
  showWhen: f.showWhen ? { field: f.showWhen.field, in: [...f.showWhen.in] } : null,
});

export function definitionView(def: WorksheetDefinition): WorksheetDefinitionView {
  return {
    id: def.id,
    module: def.module,
    title: def.title,
    description: def.description,
    money: def.money,
    prefillFrom: def.prefillFrom ?? null,
    printable: def.printable === true,
    fields: def.fields.map(fieldView),
    tables: def.tables.map((t) => ({
      id: t.id,
      label: t.label,
      columns: t.columns.map(fieldView),
      computedColumns: (t.computedColumns ?? []).map((c) => ({ ...c })),
      minRows: t.minRows ?? null,
      maxRows: t.maxRows ?? null,
    })),
    computed: def.computed.map((c) => ({ id: c.id, label: c.label, kind: c.kind, etb: c.etb === true })),
    sections: def.sections.map((s) => ({ id: s.id, title: s.title, description: s.description ?? null, items: [...s.items] })),
  };
}

export const listDefinitions = (ctx: Ctx): WorksheetDefinitionView[] =>
  allWorksheetDefinitions().filter((def) => canOpenWorksheet(def, !!ctx.principal.staffRole)).map(definitionView);
export const getDefinition = (ctx: Ctx, id: string): WorksheetDefinitionView => definitionView(definitionOf(id, !!ctx.principal.staffRole));

// ---- Who and which enrolment ----

async function enrollmentFor(db: Executor, ctx: Ctx, input: { enrollmentId?: string | undefined; organizationId?: string | undefined }): Promise<{ enrollment: EnrollmentRow; access: Access }> {
  const { principal } = ctx;
  if (input.enrollmentId) {
    const [enrollment] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.id, input.enrollmentId));
    const access = enrollment ? await accessTo(db, principal, enrollment.organizationId) : null;
    if (!enrollment || !access) throw new ServiceError("not_found", "Enrolment not found.");
    return { enrollment, access };
  }
  const organizationId = input.organizationId ?? (principal.smeRoles.size === 1 ? [...principal.smeRoles.keys()][0] : undefined);
  if (!organizationId) throw new ServiceError("invalid", "Say which organisation (`organizationId`) or enrolment (`enrollmentId`) this is for.");
  const access = await accessTo(db, principal, organizationId);
  if (!access) throw new ServiceError("not_found", "Organisation not found.");
  // An SME keeps its outputs after a programme, and can update them (review section 6). The live enrolment comes first, then
  // the newest one that isn't withdrawn.
  const enrollments = await db
    .select()
    .from(schema.enrollment)
    .where(and(eq(schema.enrollment.organizationId, organizationId), ne(schema.enrollment.status, "withdrawn")))
    .orderBy(desc(schema.enrollment.enrolledAt));
  const chosen = enrollments.find((e) => (LIVE_ENROLLMENT as readonly string[]).includes(e.status)) ?? enrollments[0];
  if (!chosen) throw new ServiceError("precondition_failed", "This organisation isn't enrolled in a TRADE cohort yet.");
  return { enrollment: chosen, access };
}

/** The enrolment's avenue and live-order flag, which the M04 brief's checks read. */
async function contextOf(db: Executor, enrollmentId: string): Promise<WorksheetContext> {
  const [avenue] = await db
    .select({ pathway: schema.pathwayAssignment.pathway, liveOrder: schema.pathwayAssignment.liveOrder })
    .from(schema.pathwayAssignment)
    .where(and(eq(schema.pathwayAssignment.enrollmentId, enrollmentId), inArray(schema.pathwayAssignment.status, ["provisional", "confirmed"])))
    .limit(1);
  return avenue ? { pathway: avenue.pathway, liveOrder: avenue.liveOrder } : {};
}

// ---- Views ----

const wireResult = (r: WorksheetResult): WorksheetVersionView["result"] => ({
  computed: { ...r.computed },
  rows: Object.fromEntries(Object.entries(r.rows).map(([id, rows]) => [id, rows.map((row) => ({ ...row }))])),
  etb: { ...r.etb },
  flags: r.flags.map((f) => ({ ...f, fields: [...f.fields] })),
  problems: r.problems.map((p) => ({ ...p })),
});

const FINANCIAL_MODULES = ["M03", "M04"];

async function buildView(db: Executor, row: VersionRow, organizationId: string, access: Access): Promise<WorksheetVersionView> {
  const def = definitionOf(row.worksheetId);
  const values = row.values as WorksheetValues;
  const result = row.status === "submitted" && row.result ? (row.result as unknown as WorksheetVersionView["result"]) : wireResult(computeFor(def, values, await contextOf(db, row.enrollmentId)));
  const [basedOn] = row.basedOnVersionId ? await db.select({ id: schema.worksheetVersion.id, version: schema.worksheetVersion.version }).from(schema.worksheetVersion).where(eq(schema.worksheetVersion.id, row.basedOnVersionId)) : [];
  const [source] = row.prefilledFromVersionId
    ? await db.select({ id: schema.worksheetVersion.id, worksheetId: schema.worksheetVersion.worksheetId, version: schema.worksheetVersion.version }).from(schema.worksheetVersion).where(eq(schema.worksheetVersion.id, row.prefilledFromVersionId))
    : [];
  return {
    id: row.id,
    worksheetId: row.worksheetId,
    module: row.moduleId,
    title: def.title,
    version: row.version,
    status: row.status,
    enrollmentId: row.enrollmentId,
    organizationId,
    canEdit: !access.staff && access.write && row.status === "draft",
    confidence: row.confidence,
    confidenceLabel: "Self-reported",
    values: { ...values },
    result,
    basedOn: basedOn ? { id: basedOn.id, version: basedOn.version } : null,
    prefilledFrom: source ? { id: source.id, worksheetId: source.worksheetId, title: findWorksheetDefinition(source.worksheetId)?.title ?? source.worksheetId, version: source.version } : null,
    mizan: def.money && FINANCIAL_MODULES.includes(def.module) ? { connected: false, message: "MIZAN not connected yet. Your figures are kept so it can read them once it is." } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}

async function findVersion(db: Executor, ctx: Ctx, id: string, options: { lock?: boolean } = {}): Promise<{ row: VersionRow; enrollment: EnrollmentRow; access: Access }> {
  const query = db
    .select({ row: schema.worksheetVersion, enrollment: schema.enrollment })
    .from(schema.worksheetVersion)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.worksheetVersion.enrollmentId))
    .where(eq(schema.worksheetVersion.id, id));
  const [found] = await query;
  const access = found ? await accessTo(db, ctx.principal, found.enrollment.organizationId) : null;
  if (!found || !access) throw new ServiceError("not_found", "Worksheet version not found.");
  if (!options.lock) return { ...found, access };
  const [locked] = await db.select().from(schema.worksheetVersion).where(eq(schema.worksheetVersion.id, id)).for("update");
  return { row: locked ?? found.row, enrollment: found.enrollment, access };
}

export async function getVersion(ctx: Ctx, id: string): Promise<WorksheetVersionView> {
  const { row, enrollment, access } = await findVersion(ctx.db, ctx, id);
  return buildView(ctx.db, row, enrollment.organizationId, access);
}

// ---- Listing ----

export async function listWorksheets(ctx: Ctx, input: { enrollmentId?: string | undefined; organizationId?: string | undefined }) {
  const { enrollment, access } = await enrollmentFor(ctx.db, ctx, input);
  const rows = await ctx.db.select().from(schema.worksheetVersion).where(eq(schema.worksheetVersion.enrollmentId, enrollment.id)).orderBy(desc(schema.worksheetVersion.version));
  return {
    enrollmentId: enrollment.id,
    items: allWorksheetDefinitions().filter((def) => canOpenWorksheet(def, access.staff)).map((def) => {
      const mine = rows.filter((r) => r.worksheetId === def.id);
      const latest = mine.find((r) => r.status === "submitted");
      const draft = mine.find((r) => r.status === "draft");
      return {
        id: def.id,
        module: def.module,
        title: def.title,
        description: def.description,
        latest: latest ? { id: latest.id, version: latest.version, submittedAt: latest.submittedAt!.toISOString() } : null,
        draft: draft ? { id: draft.id, version: draft.version, updatedAt: draft.updatedAt.toISOString() } : null,
      };
    }),
  };
}

export async function listVersions(ctx: Ctx, worksheetId: string, input: { enrollmentId?: string | undefined; organizationId?: string | undefined }) {
  definitionOf(worksheetId, !!ctx.principal.staffRole);
  const { enrollment } = await enrollmentFor(ctx.db, ctx, input);
  const rows = await ctx.db
    .select()
    .from(schema.worksheetVersion)
    .where(and(eq(schema.worksheetVersion.enrollmentId, enrollment.id), eq(schema.worksheetVersion.worksheetId, worksheetId)))
    .orderBy(desc(schema.worksheetVersion.version));
  return { worksheetId, items: rows.map((r) => ({ id: r.id, version: r.version, status: r.status, updatedAt: r.updatedAt.toISOString(), submittedAt: r.submittedAt?.toISOString() ?? null })) };
}

// ---- Starting a draft ----

/**
 * The draft of a worksheet for an enrolment: the one already open, or a new one. A new draft starts from the newest submitted
 * version (editing a submitted version starts the next one), or, for the first, from the worksheet it builds on and from what
 * the registry knows (the M03 working-capital brief prefills M04's brief).
 */
export async function startDraft(ctx: Ctx, worksheetId: string, input: { enrollmentId?: string | undefined; organizationId?: string | undefined }): Promise<WorksheetVersionView> {
  const def = definitionOf(worksheetId, false);
  return ctx.db.transaction(async (tx) => {
    const { enrollment, access } = await enrollmentFor(tx, ctx, input);
    if (access.staff || !access.write) throw new ServiceError("forbidden", "Only the SME's own team fills in a worksheet.");
    // One start at a time per enrolment, so two taps can't make two drafts.
    await tx.select({ id: schema.enrollment.id }).from(schema.enrollment).where(eq(schema.enrollment.id, enrollment.id)).for("update");

    const mine = await tx
      .select()
      .from(schema.worksheetVersion)
      .where(and(eq(schema.worksheetVersion.enrollmentId, enrollment.id), eq(schema.worksheetVersion.worksheetId, worksheetId)))
      .orderBy(desc(schema.worksheetVersion.version));
    const draft = mine.find((r) => r.status === "draft");
    if (draft) return buildView(tx, draft, enrollment.organizationId, access);

    const latest = mine.find((r) => r.status === "submitted");
    let values: Record<string, unknown> = {};
    let prefilledFromVersionId: string | null = null;
    if (latest) values = structuredClone(latest.values);
    else {
      if (def.prefillFrom) {
        const [source] = await tx
          .select()
          .from(schema.worksheetVersion)
          .where(and(eq(schema.worksheetVersion.enrollmentId, enrollment.id), eq(schema.worksheetVersion.worksheetId, def.prefillFrom), eq(schema.worksheetVersion.status, "submitted")))
          .orderBy(desc(schema.worksheetVersion.version))
          .limit(1);
        if (source) {
          values = findWorksheet(def.id)
            ? prefillFrom(def.id, { id: source.worksheetId, values: source.values, computed: ((source.result as { computed?: WorksheetResult["computed"] } | null)?.computed ?? {}) })
            : prefillContentWorksheet(def.id, source.values);
          if (Object.keys(values).length) prefilledFromVersionId = source.id;
        }
      }
      if (def.id === "m01-export-opportunity-brief") {
        const [profile] = await tx.select({ legalName: schema.smeProfile.legalName }).from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, enrollment.organizationId));
        if (profile?.legalName) values.company_name = profile.legalName;
      }
    }

    const [created] = await tx
      .insert(schema.worksheetVersion)
      .values({
        enrollmentId: enrollment.id,
        worksheetId,
        moduleId: def.module,
        version: (mine[0]?.version ?? 0) + 1,
        values,
        basedOnVersionId: latest?.id ?? null,
        prefilledFromVersionId,
        createdByUserId: ctx.principal.userId,
      })
      .returning();
    if (!created) throw new Error("The worksheet draft was not created");
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.worksheet.started",
      organizationId: enrollment.organizationId,
      entityType: "worksheet_version",
      entityId: created.id,
      after: { worksheetId, version: created.version, basedOnVersion: latest?.version ?? null, prefilled: prefilledFromVersionId !== null },
    });
    return buildView(tx, created, enrollment.organizationId, access);
  });
}

// ---- Saving ----

const isRow = (r: unknown): r is Record<string, unknown> => typeof r === "object" && r !== null && !Array.isArray(r);

/** Checks the shape of what was sent: known fields only, scalars for fields, lists of rows with known columns for tables. */
function checkShape(def: WorksheetDefinition, values: Record<string, unknown>): void {
  const fields = new Map(def.fields.map((f) => [f.id, f]));
  const tables = new Map(def.tables.map((t) => [t.id, t]));
  for (const [key, value] of Object.entries(values)) {
    if (value === null) continue;
    const table = tables.get(key);
    if (table) {
      if (!Array.isArray(value) || !value.every(isRow)) throw new ServiceError("invalid", `${table.label} must be a list of rows.`);
      if (table.maxRows !== undefined && value.length > table.maxRows) throw new ServiceError("invalid", `${table.label} has room for ${table.maxRows} rows.`);
      const columns = new Set(table.columns.map((c) => c.id));
      for (const row of value) for (const [column, cell] of Object.entries(row)) {
        if (!columns.has(column)) throw new ServiceError("invalid", `${table.label} has no column "${column}".`);
        if (cell !== null && typeof cell === "object") throw new ServiceError("invalid", `${table.label}: a cell holds one value.`);
      }
    } else if (fields.has(key)) {
      if (typeof value === "object") throw new ServiceError("invalid", `${fields.get(key)!.label} holds one value.`);
    } else {
      throw new ServiceError("invalid", `${key}: this worksheet has no such field.`);
    }
  }
}

/** Saves values as the learner types. Only a draft changes; the result is worked out live and comes back with the version. */
export async function saveValues(ctx: Ctx, id: string, input: Record<string, unknown>): Promise<WorksheetVersionView> {
  return ctx.db.transaction(async (tx) => {
    const { row, enrollment, access } = await findVersion(tx, ctx, id, { lock: true });
    if (access.staff || !access.write) throw new ServiceError("forbidden", "Only the SME's own team fills in a worksheet.");
    if (row.status !== "draft") throw new ServiceError("invalid_transition", "A submitted version can't be edited. Start a new draft to change it.");
    const def = definitionOf(row.worksheetId);
    checkShape(def, input);
    const next: Record<string, unknown> = { ...row.values };
    for (const [key, value] of Object.entries(input)) {
      if (value === null || value === "") delete next[key];
      else next[key] = value;
    }
    if (JSON.stringify(next).length > MAX_VALUES_BYTES) throw new ServiceError("invalid", "That worksheet is too large.");
    const [saved] = await tx.update(schema.worksheetVersion).set({ values: next }).where(eq(schema.worksheetVersion.id, id)).returning();
    return buildView(tx, saved ?? row, enrollment.organizationId, access);
  });
}

// ---- Submitting ----

/** What the worksheet still needs before it can be submitted, in words. */
function missingFor(def: WorksheetDefinition, values: WorksheetValues): string[] {
  const blank = (v: unknown) => v === null || v === undefined || v === "";
  const missing: string[] = [];
  const required = (f: WorksheetField, v: unknown) => f.required && isShown(f.showWhen, values) && blank(v);
  for (const f of def.fields) if (required(f, values[f.id])) missing.push(f.label);
  if (def.money && typeof values.currency === "string" && values.currency !== "ETB") {
    if (blank(values.exchange_rate)) missing.push("Exchange rate");
    if (blank(values.rate_date)) missing.push("Date of the rate");
  }
  for (const t of def.tables) {
    const rows = Array.isArray(values[t.id]) ? (values[t.id] as Record<string, unknown>[]) : [];
    if (t.minRows !== undefined && rows.length < t.minRows) missing.push(`${t.label}: at least ${t.minRows} row${t.minRows === 1 ? "" : "s"}`);
    rows.forEach((row, i) => {
      for (const c of t.columns) if (c.required && blank(row[c.id])) missing.push(`${t.label}, row ${i + 1}: ${c.label}`);
    });
  }
  return missing;
}

/** Submits a draft: it becomes a numbered version that is kept and never edited, with what the worksheet worked out. */
export async function submitVersion(ctx: Ctx, id: string): Promise<WorksheetVersionView> {
  return ctx.db.transaction(async (tx) => {
    const { row, enrollment, access } = await findVersion(tx, ctx, id, { lock: true });
    if (access.staff || !access.write) throw new ServiceError("forbidden", "Only the SME's own team can submit a worksheet.");
    if (row.status !== "draft") throw new ServiceError("invalid_transition", "This version has already been submitted.");
    const def = definitionOf(row.worksheetId);
    const result = computeFor(def, row.values, await contextOf(tx, row.enrollmentId));
    if (result.problems.length) throw new ServiceError("precondition_failed", `Some figures can't be used yet: ${result.problems.slice(0, 4).map((p) => p.message).join(" ")}`);
    const missing = missingFor(def, row.values);
    if (missing.length) throw new ServiceError("precondition_failed", `The worksheet isn't complete. Still to fill in: ${missing.slice(0, 6).join("; ")}${missing.length > 6 ? `; and ${missing.length - 6} more` : ""}.`);

    const [submitted] = await tx
      .update(schema.worksheetVersion)
      .set({ status: "submitted", result: wireResult(result) as unknown as Record<string, unknown>, submittedAt: ctx.now, submittedByUserId: ctx.principal.userId })
      .where(eq(schema.worksheetVersion.id, id))
      .returning();
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.worksheet.submitted",
      organizationId: enrollment.organizationId,
      entityType: "worksheet_version",
      entityId: id,
      after: { worksheetId: row.worksheetId, version: row.version, flags: result.flags.map((f) => f.code) },
    });
    // The learning plan comes after the assessor's review, so it can be the last thing a module was waiting for.
    if (isLearningPlan(def)) await evaluateAndSyncModuleCompletion(tx, ctx, row.enrollmentId, def.module);
    return buildView(tx, submitted ?? row, enrollment.organizationId, access);
  });
}

// ---- What a sponsor sees, with consent ----

const SPONSOR_KINDS: Record<string, (def: WorksheetDefinition) => boolean> = {
  financial_worksheets: (def) => def.module === "M03" && def.money,
  m04_brief: (def) => def.module === "M04",
};

/** The newest submitted worksheets a sponsor's agreement covers: the M03 financial worksheets, or the M04 brief. Figures only, no flags. */
export async function sharedWorksheets(db: Executor, enrollmentId: string, kind: "financial_worksheets" | "m04_brief") {
  const wanted = WORKSHEET_DEFINITIONS.filter(SPONSOR_KINDS[kind]!);
  if (wanted.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.worksheetVersion)
    .where(and(eq(schema.worksheetVersion.enrollmentId, enrollmentId), eq(schema.worksheetVersion.status, "submitted"), inArray(schema.worksheetVersion.worksheetId, wanted.map((d) => d.id))))
    .orderBy(asc(schema.worksheetVersion.worksheetId), desc(schema.worksheetVersion.version));
  const seen = new Set<string>();
  const items: { worksheetId: string; title: string; version: number; submittedAt: string | null; currency: string; computed: Record<string, unknown>; etb: Record<string, unknown> }[] = [];
  for (const r of rows) {
    if (seen.has(r.worksheetId)) continue;
    seen.add(r.worksheetId);
    const result = (r.result ?? {}) as { computed?: Record<string, unknown>; etb?: Record<string, unknown> };
    items.push({
      worksheetId: r.worksheetId,
      title: findWorksheet(r.worksheetId)?.title ?? r.worksheetId,
      version: r.version,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      currency: typeof r.values.currency === "string" ? r.values.currency : "ETB",
      computed: result.computed ?? {},
      etb: result.etb ?? {},
    });
  }
  return items;
}

