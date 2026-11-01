import { and, count, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { schema } from "@entrust/db";
import { canSubmit, checkAnswers, type Answer, type Answers } from "@entrust/forms";
import {
  RESTRICTED_DOCUMENT_KINDS,
  applicationPathway,
  screenEligibility,
  type ApplicationTemplate,
  type DocumentKind,
  type EligibilityResult,
  type SummitRules,
} from "@entrust/summit-engine";
import type { ApplicationDetailView, ApplicationListView, ApplicationSummaryView } from "../schemas/summit";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { fromEngine, ServiceError } from "./errors";
import { findApplication, requireApplicant, type ApplicationRow, type SummitAccess } from "./summit-access";
import { listClarifications, openClarification } from "./summit-clarification-data";
import { findApplicationTemplate, findSummitRules } from "./summit-forms";
import { openPeriod, periodState, type PeriodRow } from "./summit-periods";
import { changeStatus, publicStatus, recordSummitChange, WITHDRAWABLE } from "./summit-status";
import { getStorageProvider } from "./storage";

// The applicant's side of the Summit application (#79), and what Entrust staff see of it. Eligibility is screened when
// an application is submitted and again when it is resubmitted or an exception is recorded; the commercial score is a
// separate step with its own tables.

const todayOf = (now: Date): string => now.toISOString().slice(0, 10);

export function templateOf(version: string): ApplicationTemplate {
  const template = findApplicationTemplate(version);
  if (!template) throw new Error(`Application form ${version} is missing`);
  return template;
}

export function rulesOf(version: string): SummitRules {
  const rules = findSummitRules(version);
  if (!rules) throw new Error(`Summit rules ${version} are missing`);
  return rules;
}

export async function loadPeriod(db: Executor, id: string): Promise<PeriodRow> {
  const [period] = await db.select().from(schema.applicationPeriod).where(eq(schema.applicationPeriod.id, id));
  if (!period) throw new Error(`Application period ${id} is missing`);
  return period;
}

export async function reload(db: Executor, id: string): Promise<ApplicationRow> {
  const [row] = await db.select().from(schema.application).where(eq(schema.application.id, id));
  if (!row) throw new Error(`Application ${id} is missing`);
  return row;
}

export async function latestEligibility(db: Executor, applicationId: string) {
  const [row] = await db
    .select()
    .from(schema.eligibilityResult)
    .where(eq(schema.eligibilityResult.applicationId, applicationId))
    .orderBy(desc(schema.eligibilityResult.screenedAt))
    .limit(1);
  return row;
}

/**
 * Whether the applicant can change answers and documents. A draft can until the period closes. After submitting, only
 * an application that is waiting on a clarification about eligibility can: the applicant fixes what was missing and
 * submits again. Once it is in assessment the answers stay as they were scored.
 */
function isEditable(row: Pick<ApplicationRow, "status">, latest: { outcome: string } | undefined, period: PeriodRow, now: Date): boolean {
  switch (row.status) {
    case "draft":
      return now < period.closesAt;
    case "incomplete":
      return true;
    case "awaiting_additional_information":
      return latest?.outcome === "pending_clarification";
    default:
      return false;
  }
}

const problemView = (p: { question: string; code: string; message: string }) => ({ question: p.question, code: p.code, message: p.message });

// ---- Views ----

export async function buildDetail(db: Executor, row: ApplicationRow, access: SummitAccess, now: Date): Promise<ApplicationDetailView> {
  const [period, [organisation], documents, latest, clarifications, open] = await Promise.all([
    loadPeriod(db, row.periodId),
    db
      .select({ name: schema.organization.name, smeId: schema.smeProfile.smeId, country: schema.smeProfile.country })
      .from(schema.organization)
      .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.organization.id))
      .where(eq(schema.organization.id, row.organizationId)),
    db
      .select({
        id: schema.applicationDocument.id,
        fileId: schema.applicationDocument.fileId,
        kind: schema.applicationDocument.kind,
        addedAt: schema.applicationDocument.addedAt,
        fileName: schema.file.originalName,
        contentType: schema.file.contentType,
        sizeBytes: schema.file.sizeBytes,
      })
      .from(schema.applicationDocument)
      .innerJoin(schema.file, eq(schema.file.id, schema.applicationDocument.fileId))
      .where(eq(schema.applicationDocument.applicationId, row.id))
      .orderBy(schema.applicationDocument.addedAt),
    latestEligibility(db, row.id),
    listClarifications(db, row.id, access.applicant),
    openClarification(db, row.id),
  ]);

  const template = templateOf(row.templateVersion);
  const rules = rulesOf(period.rulesVersion);
  const check = checkAnswers(template, row.answers, { today: todayOf(now) });
  const pathway = applicationPathway(template, row.answers) ?? null;
  const editable = access.applicant && isEditable(row, latest, period, now);

  const view: ApplicationDetailView = {
    id: row.id,
    number: row.number,
    organizationId: row.organizationId,
    organizationName: organisation?.name ?? "",
    smeId: organisation?.smeId ?? null,
    country: organisation?.country ?? null,
    periodId: row.periodId,
    view: access.applicant ? "applicant" : "staff",
    status: access.applicant ? publicStatus(row.status) : row.status,
    templateVersion: row.templateVersion,
    pathway,
    answers: row.answers as ApplicationDetailView["answers"],
    progress: check.progress,
    incomplete: check.incomplete.map(problemView),
    errors: check.errors.map(problemView),
    requiredDocuments: pathway ? [...rules.eligibility.requiredDocuments[pathway]] : [],
    documents: documents.map((d) => ({
      id: d.id,
      fileId: d.fileId,
      kind: d.kind,
      restricted: RESTRICTED_DOCUMENT_KINDS.includes(d.kind),
      fileName: d.fileName,
      contentType: d.contentType,
      sizeBytes: d.sizeBytes,
      addedAt: d.addedAt.toISOString(),
    })),
    eligibility: latest
      ? {
          outcome: latest.outcome,
          // An exception is for Entrust's records: the applicant sees the requirement as met.
          criteria: latest.criteria.map((c) => ({
            id: c.id,
            text: c.text,
            result: access.applicant && c.result === "excepted" ? "met" : c.result,
            reason: c.reason,
          })),
          missingDocuments: latest.missingDocuments as DocumentKind[],
          screenedAt: latest.screenedAt.toISOString(),
        }
      : null,
    editable,
    canSubmit: editable && canSubmit(check),
    canEditDocuments: access.applicant && (editable || (row.status === "awaiting_additional_information" && open !== undefined)),
    clarifications,
    closesAt: period.closesAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (access.applicant) return view;

  const [history, [officer], exceptions] = await Promise.all([
    db
      .select({
        from: schema.applicationStatusChange.fromStatus,
        to: schema.applicationStatusChange.toStatus,
        at: schema.applicationStatusChange.changedAt,
        reason: schema.applicationStatusChange.reason,
        userId: schema.user.id,
        userName: schema.user.name,
      })
      .from(schema.applicationStatusChange)
      .leftJoin(schema.user, eq(schema.user.id, schema.applicationStatusChange.changedBy))
      .where(eq(schema.applicationStatusChange.applicationId, row.id))
      .orderBy(schema.applicationStatusChange.changedAt),
    db
      .select({
        userId: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        assignedAt: schema.officerAssignment.assignedAt,
      })
      .from(schema.officerAssignment)
      .innerJoin(schema.user, eq(schema.user.id, schema.officerAssignment.officerUserId))
      .where(and(eq(schema.officerAssignment.applicationId, row.id), isNull(schema.officerAssignment.endedAt))),
    db
      .select({
        criterion: schema.eligibilityException.criterion,
        reason: schema.eligibilityException.reason,
        at: schema.eligibilityException.recordedAt,
        userId: schema.user.id,
        userName: schema.user.name,
      })
      .from(schema.eligibilityException)
      .leftJoin(schema.user, eq(schema.user.id, schema.eligibilityException.recordedBy))
      .where(eq(schema.eligibilityException.applicationId, row.id))
      .orderBy(schema.eligibilityException.recordedAt),
  ]);
  const person = (id: string | null, name: string | null) => (id && name ? { id, name } : null);
  return {
    ...view,
    staff: {
      history: history.map((h) => ({ from: h.from, to: h.to, by: person(h.userId, h.userName), at: h.at.toISOString(), reason: h.reason })),
      officer: officer ? { ...officer, assignedAt: officer.assignedAt.toISOString() } : null,
      exceptions: exceptions.map((e) => ({ criterion: e.criterion, reason: e.reason, by: person(e.userId, e.userName), at: e.at.toISOString() })),
    },
  };
}

export async function getApplication(ctx: Ctx, id: string): Promise<ApplicationDetailView> {
  const { row, access } = await findApplication(ctx.db, ctx.principal, id);
  return buildDetail(ctx.db, row, access, ctx.now);
}

export interface ListApplicationsInput {
  organizationId?: string | undefined;
  periodId?: string | undefined;
  status?: string | undefined;
  pathway?: (typeof schema.application.$inferSelect)["pathway"] | undefined;
  officerUserId?: string | undefined;
  limit: number;
  offset: number;
}

const currentAssignments = (db: Executor, officerUserId: string) =>
  db
    .select({ id: schema.officerAssignment.applicationId })
    .from(schema.officerAssignment)
    .where(and(eq(schema.officerAssignment.officerUserId, officerUserId), isNull(schema.officerAssignment.endedAt)));

/**
 * The applications the caller can see, newest first. An applicant sees their organisations' applications. An
 * administrator or facilitator sees every one, with how complete each is, and an assessment officer sees those
 * assigned to them now.
 */
export async function listApplications(ctx: Ctx, input: ListApplicationsInput): Promise<ApplicationListView> {
  const { principal, db } = ctx;
  const staff = principal.staffRole;
  if (!staff && principal.smeRoles.size === 0) return { items: [], total: 0 };

  const filters: (SQL | undefined)[] = [
    staff ? undefined : inArray(schema.application.organizationId, [...principal.smeRoles.keys()]),
    staff === "reviewer" ? inArray(schema.application.id, currentAssignments(db, principal.userId)) : undefined,
    input.organizationId ? eq(schema.application.organizationId, input.organizationId) : undefined,
    input.periodId ? eq(schema.application.periodId, input.periodId) : undefined,
    staff && input.status ? eq(schema.application.status, input.status as ApplicationRow["status"]) : undefined,
    input.pathway ? eq(schema.application.pathway, input.pathway) : undefined,
    staff && staff !== "reviewer" && input.officerUserId ? inArray(schema.application.id, currentAssignments(db, input.officerUserId)) : undefined,
  ];
  const where = and(...filters);

  const [rows, [total]] = await Promise.all([
    db
      .select({
        row: schema.application,
        organizationName: schema.organization.name,
        smeId: schema.smeProfile.smeId,
        country: schema.smeProfile.country,
        rulesVersion: schema.applicationPeriod.rulesVersion,
      })
      .from(schema.application)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.application.organizationId))
      .innerJoin(schema.applicationPeriod, eq(schema.applicationPeriod.id, schema.application.periodId))
      .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.application.organizationId))
      .where(where)
      .orderBy(desc(schema.application.createdAt), desc(schema.application.id))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ total: count() }).from(schema.application).where(where),
  ]);
  if (rows.length === 0) return { items: [], total: total?.total ?? 0 };

  const ids = rows.map((r) => r.row.id);
  const [eligibility, documents, officers] = await Promise.all([
    db
      .selectDistinctOn([schema.eligibilityResult.applicationId], {
        applicationId: schema.eligibilityResult.applicationId,
        outcome: schema.eligibilityResult.outcome,
      })
      .from(schema.eligibilityResult)
      .where(inArray(schema.eligibilityResult.applicationId, ids))
      .orderBy(schema.eligibilityResult.applicationId, desc(schema.eligibilityResult.screenedAt)),
    db
      .select({ applicationId: schema.applicationDocument.applicationId, kind: schema.applicationDocument.kind })
      .from(schema.applicationDocument)
      .where(inArray(schema.applicationDocument.applicationId, ids)),
    staff
      ? db
          .select({ applicationId: schema.officerAssignment.applicationId, userId: schema.user.id, name: schema.user.name })
          .from(schema.officerAssignment)
          .innerJoin(schema.user, eq(schema.user.id, schema.officerAssignment.officerUserId))
          .where(and(inArray(schema.officerAssignment.applicationId, ids), isNull(schema.officerAssignment.endedAt)))
      : Promise.resolve([]),
  ]);
  const outcomes = new Map(eligibility.map((e) => [e.applicationId, e.outcome]));
  const officerOf = new Map(officers.map((o) => [o.applicationId, { id: o.userId, name: o.name }]));
  const kindsOf = new Map<string, Set<string>>();
  for (const d of documents) kindsOf.set(d.applicationId, (kindsOf.get(d.applicationId) ?? new Set()).add(d.kind));

  const items: ApplicationSummaryView[] = rows.map(({ row, organizationName, smeId, country, rulesVersion }) => {
    const template = templateOf(row.templateVersion);
    const pathway = applicationPathway(template, row.answers);
    const required = pathway ? rulesOf(rulesVersion).eligibility.requiredDocuments[pathway] : [];
    const have = kindsOf.get(row.id);
    return {
      id: row.id,
      number: row.number,
      organizationId: row.organizationId,
      organizationName,
      smeId,
      country,
      periodId: row.periodId,
      status: staff ? row.status : publicStatus(row.status),
      pathway: pathway ?? null,
      progressPercent: checkAnswers(template, row.answers).progress.percent,
      eligibility: outcomes.get(row.id) ?? null,
      missingDocuments: required.filter((kind) => !have?.has(kind)).length,
      officer: staff ? (officerOf.get(row.id) ?? null) : null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
  return { items, total: total?.total ?? items.length };
}

// ---- Starting an application ----

/** The country as a name, for the form's country question. The profile holds the ISO code. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export interface CreateApplicationInput {
  organizationId: string;
  periodId?: string | undefined;
}

/**
 * Starts an application for an SME organisation: an owner or member of the organisation, while the period is open and
 * the organisation's country is allowed in it. The first application gives the organisation Summit access, which is
 * a platform of its own and not TRADE. Answers the registry already holds (the business name and country) are filled
 * in. An organisation has one application a period, unless it withdrew the earlier one.
 */
export async function createApplication(ctx: Ctx, input: CreateApplicationInput): Promise<ApplicationDetailView> {
  const { principal } = ctx;
  if (!principal.smeRoles.has(input.organizationId)) throw new ServiceError("not_found", "Organisation not found.");

  return ctx.db.transaction(async (tx) => {
    const period = input.periodId
      ? (await tx.select().from(schema.applicationPeriod).where(eq(schema.applicationPeriod.id, input.periodId)))[0]
      : await openPeriod(tx, ctx.now);
    if (input.periodId && !period) throw new ServiceError("not_found", "Application period not found.");
    if (!period || periodState(period, ctx.now) !== "open") {
      throw new ServiceError("precondition_failed", "Applications for the Summit aren't open.");
    }

    const [profile] = await tx.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, input.organizationId));
    if (!profile) throw new ServiceError("precondition_failed", "Your organisation has no SME profile, so it can't apply.");
    if (!period.countries.includes(profile.country.toUpperCase())) {
      throw new ServiceError("forbidden", `The Summit isn't taking applications from ${countryName(profile.country)} in this period.`);
    }

    const template = templateOf(period.templateVersion);
    const prefill: Record<string, Answer> = {};
    if (template.registry.includes("S1.1")) prefill["S1.1"] = profile.legalName;
    if (template.registry.includes("S1.3")) prefill["S1.3"] = countryName(profile.country);

    const [row] = await tx
      .insert(schema.application)
      .values({
        organizationId: input.organizationId,
        periodId: period.id,
        applicantUserId: principal.userId,
        templateVersion: template.version,
        answers: prefill,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new ServiceError("invalid_transition", "Your organisation has already applied in this period.");

    const [granted] = await tx
      .insert(schema.platformAccess)
      .values({ organizationId: input.organizationId, platform: "summit", grantedBy: principal.userId })
      .onConflictDoNothing()
      .returning({ id: schema.platformAccess.id });
    if (granted) {
      await tx.insert(schema.auditLog).values({
        actorUserId: principal.userId,
        organizationId: input.organizationId,
        platform: "summit",
        action: "summit.access.granted",
        entityType: "organization",
        entityId: input.organizationId,
        after: { platform: "summit" },
      });
    }

    await tx.insert(schema.applicationStatusChange).values({
      applicationId: row.id,
      fromStatus: null,
      toStatus: "draft",
      changedBy: principal.userId,
      changedAt: sql`clock_timestamp()`,
    });
    await recordSummitChange(tx, principal.userId, {
      action: "summit.application.created",
      entityType: "summit_application",
      entityId: row.id,
      organizationId: row.organizationId,
      after: { number: row.number, periodId: period.id, templateVersion: template.version },
    });
    return buildDetail(tx, row, { applicant: true, staffRole: null, assigned: false, committee: false }, ctx.now);
  });
}

// ---- Answering ----

const problemsText = (problems: readonly { message: string }[]): string =>
  problems.slice(0, 5).map((p) => p.message).join("; ") + (problems.length > 5 ? `; and ${problems.length - 5} more` : "");

/** Loads an application the applicant may still change, locked for update. */
async function editableApplication(ctx: Ctx, tx: Executor, id: string, doing: string) {
  const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
  requireApplicant(access, doing);
  const [period, latest] = await Promise.all([loadPeriod(tx, row.periodId), latestEligibility(tx, row.id)]);
  if (!isEditable(row, latest, period, ctx.now)) {
    throw new ServiceError(
      row.status === "draft" ? "precondition_failed" : "invalid_transition",
      row.status === "draft" ? "The application period has closed." : "This application can't be changed in its current status.",
    );
  }
  return { row, access, period, latest };
}

/** Like `editableApplication`, and also open while a request for more information waits for the applicant. */
async function documentsApplication(ctx: Ctx, tx: Executor, id: string) {
  const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
  requireApplicant(access, "add documents");
  if (row.status === "awaiting_additional_information" && (await openClarification(tx, id))) return { row, access };
  return editableApplication(ctx, tx, id, "add documents");
}

/**
 * Saves answers as the applicant goes, so they can leave and resume. A value sets an answer, null clears it, and
 * answers not named stay. An answer that isn't valid for its question is refused; a question left unanswered is not,
 * since that only blocks submitting.
 */
export async function saveAnswers(ctx: Ctx, id: string, patch: Readonly<Record<string, Answer | null>>): Promise<ApplicationDetailView> {
  return ctx.db.transaction(async (tx) => {
    const { row, access } = await editableApplication(ctx, tx, id, "answer the application");
    const next: Record<string, Answer> = { ...row.answers };
    for (const [question, value] of Object.entries(patch)) {
      if (value === null) delete next[question];
      else next[question] = value;
    }
    const template = templateOf(row.templateVersion);
    const check = checkAnswers(template, next, { today: todayOf(ctx.now) });
    if (check.errors.length) throw new ServiceError("invalid", problemsText(check.errors));

    const [saved] = await tx
      .update(schema.application)
      .set({ answers: next as Answers, pathway: applicationPathway(template, next) ?? null })
      .where(eq(schema.application.id, id))
      .returning();
    if (!saved) throw new Error("The answers were not saved");
    return buildDetail(tx, saved, access, ctx.now);
  });
}

// ---- Documents ----

export async function attachDocument(ctx: Ctx, id: string, input: { fileId: string; kind: DocumentKind }): Promise<ApplicationDetailView> {
  return ctx.db.transaction(async (tx) => {
    // While Entrust waits on a request for more information the applicant can add documents, but not change answers.
    const { row, access } = await documentsApplication(ctx, tx, id);
    const [file] = await tx
      .select({ id: schema.file.id, name: schema.file.originalName })
      .from(schema.file)
      .where(and(eq(schema.file.id, input.fileId), eq(schema.file.organizationId, row.organizationId)));
    if (!file) throw new ServiceError("not_found", "File not found. Upload it for the applicant's organisation first.");

    const [added] = await tx
      .insert(schema.applicationDocument)
      .values({ applicationId: id, fileId: input.fileId, kind: input.kind, addedBy: ctx.principal.userId })
      .onConflictDoNothing()
      .returning({ id: schema.applicationDocument.id });
    if (!added) throw new ServiceError("invalid_transition", "That file is already attached to the application.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.document.added",
      entityType: "summit_application",
      entityId: id,
      organizationId: row.organizationId,
      after: { documentId: added.id, fileId: input.fileId, kind: input.kind, fileName: file.name },
    });
    return buildDetail(tx, row, access, ctx.now);
  });
}

export async function removeDocument(ctx: Ctx, id: string, documentId: string): Promise<ApplicationDetailView> {
  return ctx.db.transaction(async (tx) => {
    const { row, access } = await editableApplication(ctx, tx, id, "remove documents");
    const [removed] = await tx
      .delete(schema.applicationDocument)
      .where(and(eq(schema.applicationDocument.id, documentId), eq(schema.applicationDocument.applicationId, id)))
      .returning();
    if (!removed) throw new ServiceError("not_found", "Document not found.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.document.removed",
      entityType: "summit_application",
      entityId: id,
      organizationId: row.organizationId,
      before: { documentId, fileId: removed.fileId, kind: removed.kind },
    });
    return buildDetail(tx, row, access, ctx.now);
  });
}

/**
 * A short-lived link to a document. The applicant opens their own, the assigned officer and Entrust's administrators
 * open any, and a facilitator opens any except the restricted kinds (financial statements).
 */
export async function documentDownloadUrl(ctx: Ctx, id: string, documentId: string) {
  const { row, access } = await findApplication(ctx.db, ctx.principal, id);
  const [document] = await ctx.db
    .select({
      kind: schema.applicationDocument.kind,
      storageKey: schema.file.storageKey,
      fileName: schema.file.originalName,
      contentType: schema.file.contentType,
      sizeBytes: schema.file.sizeBytes,
    })
    .from(schema.applicationDocument)
    .innerJoin(schema.file, eq(schema.file.id, schema.applicationDocument.fileId))
    .where(and(eq(schema.applicationDocument.id, documentId), eq(schema.applicationDocument.applicationId, row.id)));
  if (!document) throw new ServiceError("not_found", "Document not found.");
  if (RESTRICTED_DOCUMENT_KINDS.includes(document.kind) && !(access.applicant || access.assigned || access.staffRole === "admin")) {
    throw new ServiceError("forbidden", "This is a restricted document. Only the applicant, the assigned officer and an administrator can open it.");
  }

  const expiresInSeconds = 900;
  const downloadUrl = await getStorageProvider().createPresignedDownloadUrl(document.storageKey, document.fileName, expiresInSeconds, document.contentType);
  return { downloadUrl, expiresInSeconds, fileName: document.fileName, contentType: document.contentType, sizeBytes: document.sizeBytes };
}

// ---- Screening for eligibility ----

/**
 * Screens an application against the six requirements and moves it to the status the outcome gives. The result is
 * stored beside the earlier ones. `by` is null when the platform screens on its own, on submit. The application has
 * to be in a status that can reach the outcome.
 */
export async function screenApplication(
  tx: Executor,
  row: ApplicationRow,
  period: PeriodRow,
  by: string | null,
  reason: string,
): Promise<EligibilityResult> {
  const [documents, exceptions] = await Promise.all([
    tx.select({ kind: schema.applicationDocument.kind }).from(schema.applicationDocument).where(eq(schema.applicationDocument.applicationId, row.id)),
    tx.select().from(schema.eligibilityException).where(eq(schema.eligibilityException.applicationId, row.id)),
  ]);
  const result = fromEngine(() =>
    screenEligibility(rulesOf(period.rulesVersion), templateOf(row.templateVersion), row.answers, {
      documents: documents.map((d) => d.kind),
      exceptions: exceptions.map((e) => ({ criterion: e.criterion, reason: e.reason, by: e.recordedBy ?? "a removed user" })),
    }),
  );
  await tx.insert(schema.eligibilityResult).values({
    applicationId: row.id,
    rulesVersion: result.rulesVersion,
    outcome: result.outcome,
    criteria: [...result.criteria],
    missingDocuments: [...result.missingDocuments],
    screenedAt: sql`clock_timestamp()`,
    screenedBy: by,
  });
  if (row.status !== result.status) await changeStatus(tx, row, result.status, by, reason);
  return result;
}

// ---- Submitting and withdrawing ----

/**
 * Submits the application, or submits it again after Entrust asked for more. Every shown question has to be answered
 * and the declaration accepted. The platform then screens eligibility: an application that meets the six
 * requirements becomes eligible, one that fails any becomes ineligible, and one the answers and documents don't yet
 * settle waits for additional information, which the applicant gives and then submits again.
 */
export async function submitApplication(ctx: Ctx, id: string): Promise<ApplicationDetailView> {
  return ctx.db.transaction(async (tx) => {
    const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
    requireApplicant(access, "submit the application");
    const [period, latest] = await Promise.all([loadPeriod(tx, row.periodId), latestEligibility(tx, row.id)]);

    const first = row.status === "draft";
    const again = row.status === "awaiting_additional_information" && latest?.outcome === "pending_clarification";
    if (!first && !again) throw new ServiceError("invalid_transition", "This application can't be submitted in its current status.");
    if (first && ctx.now >= period.closesAt) throw new ServiceError("precondition_failed", "The application period has closed.");

    const template = templateOf(row.templateVersion);
    const check = checkAnswers(template, row.answers, { today: todayOf(ctx.now) });
    if (!canSubmit(check)) {
      throw new ServiceError("precondition_failed", `The application isn't complete: ${problemsText([...check.errors, ...check.incomplete])}`);
    }

    // The declaration and the data-use terms, as the applicant answered them on this version of the form.
    await tx
      .insert(schema.consentRecord)
      .values(template.inputs.declaration.map((question) => ({ applicationId: id, question, userId: ctx.principal.userId, termsVersion: row.templateVersion })))
      .onConflictDoNothing();

    if (first) {
      await tx.update(schema.application).set({ submittedAt: ctx.now }).where(eq(schema.application.id, id));
      await changeStatus(tx, row, "submitted", ctx.principal.userId);
    }
    await changeStatus(tx, row, "under_eligibility_review", null);
    const result = await screenApplication(tx, row, period, null, `Screened on ${first ? "submit" : "resubmit"}`);

    await recordSummitChange(tx, ctx.principal.userId, {
      action: first ? "summit.application.submitted" : "summit.application.resubmitted",
      entityType: "summit_application",
      entityId: id,
      organizationId: row.organizationId,
      after: { eligibility: result.outcome, missingDocuments: result.missingDocuments },
    });
    return buildDetail(tx, await reload(tx, id), access, ctx.now);
  });
}

/** Withdraws the application. It can't be undone, but the organisation may start a new application while the period is open. */
export async function withdrawApplication(ctx: Ctx, id: string, reason?: string): Promise<ApplicationDetailView> {
  return ctx.db.transaction(async (tx) => {
    const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
    requireApplicant(access, "withdraw the application");
    if (!WITHDRAWABLE.includes(row.status)) {
      throw new ServiceError("invalid_transition", "This application can't be withdrawn in its current status.");
    }
    await changeStatus(tx, row, "withdrawn", ctx.principal.userId, reason ?? null);
    return buildDetail(tx, await reload(tx, id), access, ctx.now);
  });
}
