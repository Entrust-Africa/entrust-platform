import { and, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { mizanCan } from "@entrust/roles";
import { CONSENT_KINDS, type ConsentKind, type ConsentMethod } from "@entrust/mizan-engine";
import { hasPlatformAccess, type Ctx, type Principal } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { mizanUploadAllowed } from "./mizan-files";

// The data collection notice and the permission to use TRADE and CLEAR data (#227). The notice must be accepted before an
// assessment starts; the permission before an assessor uses the SME's TRADE or CLEAR records. Every acceptance and withdrawal is
// a row of mizan.consent and none is ever changed, apart from stamping an acceptance with its withdrawal. The latest row of a kind
// (by when it was given) is the one in force. The wording is mizan.notice, versioned, so it can be reworded without a release.

export const CONSENT_LABELS: Readonly<Record<ConsentKind, string>> = {
  assessment_notice: "the assessment notice",
  platform_data: "the permission to use TRADE and CLEAR data",
};

type ConsentRow = typeof schema.mizanConsent.$inferSelect;
type NoticeRow = typeof schema.mizanNotice.$inferSelect;

const latestFirst = [desc(schema.mizanConsent.givenAt), desc(schema.mizanConsent.capturedAt)] as const;

/** The latest record of a kind for an SME: the one in force, accepted or not. */
export async function latestConsent(db: Executor, organizationId: string, kind: ConsentKind): Promise<ConsentRow | null> {
  const [row] = await db
    .select()
    .from(schema.mizanConsent)
    .where(and(eq(schema.mizanConsent.organizationId, organizationId), eq(schema.mizanConsent.kind, kind)))
    .orderBy(...latestFirst)
    .limit(1);
  return row ?? null;
}

const inForce = (row: ConsentRow | null): row is ConsentRow => !!row && row.accepted && row.withdrawnAt === null;

/** The acceptance in force for a kind, or null when the SME never accepted it or withdrew it. */
export async function consentInForce(db: Executor, organizationId: string, kind: ConsentKind): Promise<ConsentRow | null> {
  const row = await latestConsent(db, organizationId, kind);
  return inForce(row) ? row : null;
}

/** Throws unless the SME's assessment notice is in force. Starting, submitting and approving an assessment all need it. */
export async function requireAssessmentNotice(db: Executor, organizationId: string, doing: string): Promise<ConsentRow> {
  const row = await latestConsent(db, organizationId, "assessment_notice");
  if (inForce(row)) return row;
  throw new ServiceError(
    "precondition_failed",
    row
      ? `The SME withdrew the assessment notice, so you can't ${doing}. Work already done is kept; record a new acceptance to go on.`
      : `The SME hasn't accepted the assessment notice, so you can't ${doing}. Record it on the SME's Consent tab first.`,
  );
}

/** Throws unless the SME has given permission to use its TRADE and CLEAR records (#234 calls it before taking an export). */
export async function requirePlatformData(db: Executor, organizationId: string): Promise<ConsentRow> {
  const row = await consentInForce(db, organizationId, "platform_data");
  if (row) return row;
  throw new ServiceError(
    "precondition_failed",
    "The SME hasn't given permission to use its TRADE and CLEAR records (or withdrew it), so they can't be used or added. Record the permission on the SME's Consent tab first.",
  );
}

// ---------------------------------------------------------------- notices

/** The wording in use for each kind: the latest published version. */
export async function currentNotices(db: Executor): Promise<Record<ConsentKind, NoticeRow>> {
  const rows = await db.select().from(schema.mizanNotice).orderBy(desc(schema.mizanNotice.publishedAt));
  const out: Partial<Record<ConsentKind, NoticeRow>> = {};
  for (const row of rows) out[row.kind] ??= row;
  for (const kind of CONSENT_KINDS) {
    if (!out[kind]) throw new ServiceError("precondition_failed", `No wording is published for ${CONSENT_LABELS[kind]}.`);
  }
  return out as Record<ConsentKind, NoticeRow>;
}

const noticeView = (n: NoticeRow) => ({ kind: n.kind, version: n.version, title: n.title, body: n.body, publishedAt: n.publishedAt.toISOString() });
export type NoticeView = ReturnType<typeof noticeView>;

export async function listNotices(ctx: Ctx): Promise<{ items: NoticeView[] }> {
  const current = await currentNotices(ctx.db);
  return { items: CONSENT_KINDS.map((k) => noticeView(current[k])) };
}

/** A new wording. It becomes the one shown and accepted from now on; acceptances of earlier versions stay in force. */
export async function publishNotice(ctx: Ctx, input: { kind: ConsentKind; version: string; title: string; body: string }): Promise<NoticeView> {
  if (!mizanCan(ctx.principal, "manage_notices")) throw new ServiceError("forbidden", "Only a Super Admin can reword the MIZAN notices.");
  return ctx.db.transaction(async (tx) => {
    const [taken] = await tx
      .select({ id: schema.mizanNotice.id })
      .from(schema.mizanNotice)
      .where(and(eq(schema.mizanNotice.kind, input.kind), eq(schema.mizanNotice.version, input.version)))
      .limit(1);
    if (taken) throw new ServiceError("conflict", `Version ${input.version} of ${CONSENT_LABELS[input.kind]} already exists. Give the new wording a new version.`);
    const [row] = await tx
      .insert(schema.mizanNotice)
      .values({ ...input, publishedBy: ctx.principal.userId, publishedAt: ctx.now })
      .returning();
    await tx.insert(schema.auditLog).values({
      actorUserId: ctx.principal.userId,
      platform: "mizan",
      action: "mizan.notice.published",
      entityType: "mizan_notice",
      entityId: row!.id,
      after: { kind: input.kind, version: input.version, title: input.title },
    });
    return noticeView(row!);
  });
}

// ---------------------------------------------------------------- an SME's consents

interface SmeAccess {
  sme: { organizationId: string; smeId: string; legalName: string };
  /** Staff who may record and withdraw on the SME's behalf. */
  staff: boolean;
  /** The SME's own member, who may accept or withdraw in MIZAN. */
  smeRole: string | null;
}

/**
 * Staff who read SMEs, for an SME that is in MIZAN, or a member of the SME while its organisation has MIZAN access. Anything
 * else, and an organisation that isn't an SME, is not found: nobody learns whether another organisation exists. Staff are kept
 * to SMEs in MIZAN because an Assessor is a TRADE reviewer, who otherwise works only with their own cohorts' businesses.
 */
async function smeAccess(db: Executor, principal: Principal, organizationId: string): Promise<SmeAccess> {
  const [sme] = await db
    .select({ organizationId: schema.smeProfile.organizationId, smeId: schema.smeProfile.smeId, legalName: schema.smeProfile.legalName })
    .from(schema.smeProfile)
    .where(eq(schema.smeProfile.organizationId, organizationId))
    .limit(1);
  const notFound = new ServiceError("not_found", "No such SME.");
  if (!sme) throw notFound;
  if (mizanCan(principal, "read_smes")) {
    if (!(await mizanUploadAllowed(db, organizationId))) throw notFound;
    return { sme, staff: mizanCan(principal, "manage_smes"), smeRole: null };
  }
  const role = principal.smeRoles.get(organizationId);
  if (role && (await hasPlatformAccess(db, organizationId, "mizan"))) return { sme, staff: false, smeRole: role };
  throw notFound;
}

export interface ConsentView {
  id: string;
  kind: ConsentKind;
  accepted: boolean;
  signatoryName: string;
  signatoryRole: string | null;
  method: ConsentMethod;
  noticeVersion: string;
  source: "mizan" | "trade";
  sourceRef: string | null;
  givenAt: string;
  fileId: string | null;
  capturedBy: string | null;
  capturedAt: string;
  withdrawnAt: string | null;
  withdrawnBy: string | null;
}

export async function getConsents(ctx: Ctx, organizationId: string) {
  const access = await smeAccess(ctx.db, ctx.principal, organizationId);
  return consentsView(ctx.db, access);
}

async function consentsView(db: Executor, access: SmeAccess) {
  const rows = await db
    .select()
    .from(schema.mizanConsent)
    .where(eq(schema.mizanConsent.organizationId, access.sme.organizationId))
    .orderBy(...latestFirst);
  const userIds = [...new Set(rows.flatMap((r) => [r.capturedBy, r.withdrawnBy]).filter((id): id is string => !!id))];
  const names = new Map(
    userIds.length
      ? (await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, userIds))).map((u) => [u.id, u.name])
      : [],
  );
  const view = (r: ConsentRow): ConsentView => ({
    id: r.id,
    kind: r.kind,
    accepted: r.accepted,
    signatoryName: r.signatoryName,
    signatoryRole: r.signatoryRole,
    method: r.method,
    noticeVersion: r.noticeVersion,
    source: r.source,
    sourceRef: r.sourceRef,
    givenAt: r.givenAt.toISOString(),
    fileId: r.fileId,
    capturedBy: r.capturedBy ? (names.get(r.capturedBy) ?? null) : null,
    capturedAt: r.capturedAt.toISOString(),
    withdrawnAt: r.withdrawnAt?.toISOString() ?? null,
    withdrawnBy: r.withdrawnBy ? (names.get(r.withdrawnBy) ?? null) : null,
  });
  const notices = await currentNotices(db);
  return {
    organizationId: access.sme.organizationId,
    smeId: access.sme.smeId,
    legalName: access.sme.legalName,
    canRecord: access.staff,
    canAccept: access.smeRole !== null,
    kinds: CONSENT_KINDS.map((kind) => {
      const latest = rows.find((r) => r.kind === kind) ?? null;
      return { kind, inForce: inForce(latest), latest: latest ? view(latest) : null, notice: noticeView(notices[kind]) };
    }),
    history: rows.map(view),
  };
}

export type ConsentsView = Awaited<ReturnType<typeof consentsView>>;

export interface AcceptInput {
  kind: ConsentKind;
  /**
   * in_platform: the SME's own member accepts while signed in to MIZAN. paper: staff record a signed notice and attach the scan.
   * trade: staff record one accepted in TRADE, with TRADE's reference (#228 brings these across by itself).
   */
  method: ConsentMethod;
  signatoryName?: string | undefined;
  signatoryRole?: string | undefined;
  /** The wording accepted. Defaults to the current one; for TRADE, the version of TRADE's wording. */
  noticeVersion?: string | undefined;
  /** When it was given. Defaults to now; needed for paper and TRADE. */
  givenAt?: Date | undefined;
  fileId?: string | undefined;
  sourceRef?: string | undefined;
}

/** Records an acceptance. The SME's own member accepts in MIZAN; staff record one given on paper or in TRADE. */
export async function acceptConsent(ctx: Ctx, organizationId: string, input: AcceptInput): Promise<ConsentsView> {
  return ctx.db.transaction(async (tx) => {
    const access = await smeAccess(tx, ctx.principal, organizationId);
    await lockSme(tx, organizationId);
    const notices = await currentNotices(tx);
    let row: typeof schema.mizanConsent.$inferInsert;

    if (input.method === "in_platform") {
      if (!access.smeRole) {
        throw new ServiceError("forbidden", "Only someone from the SME can accept in MIZAN. Record a signed paper notice, or one given in TRADE, instead.");
      }
      const [me] = await tx.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, ctx.principal.userId));
      row = {
        organizationId,
        kind: input.kind,
        accepted: true,
        signatoryName: me?.name ?? "Unknown",
        // From their membership, as a withdrawal does: a member can't give themselves a title on the permanent record.
        signatoryRole: access.smeRole === "owner" ? "Owner" : "Member",
        method: "in_platform",
        // What they read on the screen: always the current wording.
        noticeVersion: notices[input.kind].version,
        givenAt: ctx.now,
        capturedBy: ctx.principal.userId,
      };
    } else {
      if (!access.staff) throw new ServiceError("forbidden", "Only an Assessor or Super Admin can record a notice given on paper or in TRADE.");
      const signatoryName = input.signatoryName?.trim();
      if (!signatoryName) throw new ServiceError("invalid", "Give the name of the person who accepted for the SME.");
      if (!input.givenAt) throw new ServiceError("invalid", "Give the date it was accepted.");
      if (input.givenAt > ctx.now) throw new ServiceError("invalid", "The date it was accepted can't be in the future.");
      let noticeVersion: string;
      if (input.method === "paper") {
        if (!input.fileId) throw new ServiceError("invalid", "Attach the scan of the signed notice.");
        await requireOwnFile(tx, ctx.principal, organizationId, input.fileId);
        noticeVersion = input.noticeVersion?.trim() || notices[input.kind].version;
        const [known] = await tx
          .select({ id: schema.mizanNotice.id })
          .from(schema.mizanNotice)
          .where(and(eq(schema.mizanNotice.kind, input.kind), eq(schema.mizanNotice.version, noticeVersion)))
          .limit(1);
        if (!known) throw new ServiceError("invalid", `There is no version ${noticeVersion} of ${CONSENT_LABELS[input.kind]}.`);
      } else {
        if (!input.sourceRef?.trim()) throw new ServiceError("invalid", "Give TRADE's reference for the acceptance, such as the diagnostic it was given in.");
        noticeVersion = input.noticeVersion?.trim() || "TRADE (version not stated)";
      }
      row = {
        organizationId,
        kind: input.kind,
        accepted: true,
        signatoryName,
        signatoryRole: input.signatoryRole?.trim() || null,
        method: input.method,
        noticeVersion,
        source: input.method === "trade" ? "trade" : "mizan",
        sourceRef: input.method === "trade" ? input.sourceRef!.trim() : null,
        givenAt: input.givenAt,
        fileId: input.method === "paper" ? input.fileId! : null,
        capturedBy: ctx.principal.userId,
      };
    }

    const latest = await latestConsent(tx, organizationId, input.kind);
    if (inForce(latest) && latest.noticeVersion === row.noticeVersion) {
      throw new ServiceError("conflict", `The SME has already accepted ${CONSENT_LABELS[input.kind]} (version ${row.noticeVersion}).`);
    }
    // The latest record wins, so an acceptance dated before the record in force would be history the moment it was saved.
    if (latest && row.givenAt < latest.givenAt) {
      throw new ServiceError(
        "invalid",
        latest.accepted && !latest.withdrawnAt
          ? `This is dated before the acceptance already in force (${day(latest.givenAt)}), so it would change nothing.`
          : `The SME withdrew on ${day(latest.givenAt)}, after this acceptance was given, so it can't bring ${CONSENT_LABELS[input.kind]} back. Record a new acceptance.`,
      );
    }
    if (row.sourceRef) {
      const [same] = await tx
        .select({ id: schema.mizanConsent.id })
        .from(schema.mizanConsent)
        .where(and(eq(schema.mizanConsent.organizationId, organizationId), eq(schema.mizanConsent.kind, input.kind), eq(schema.mizanConsent.source, "trade"), eq(schema.mizanConsent.sourceRef, row.sourceRef)))
        .limit(1);
      if (same) throw new ServiceError("conflict", `TRADE's acceptance ${row.sourceRef} is already recorded.`);
    }

    const [created] = await tx.insert(schema.mizanConsent).values(row).returning();
    await audit(tx, ctx, organizationId, "mizan.consent.accepted", created!.id, null, {
      kind: input.kind,
      method: row.method,
      signatoryName: row.signatoryName,
      signatoryRole: row.signatoryRole,
      noticeVersion: row.noticeVersion,
      sourceRef: row.sourceRef ?? null,
      givenAt: row.givenAt.toISOString(),
      fileId: row.fileId ?? null,
    });
    return consentsView(tx, access);
  });
}

export interface WithdrawInput {
  kind: ConsentKind;
  /** Who asked, for the SME. Staff give it; for the SME's own member it is them. */
  signatoryName?: string | undefined;
  signatoryRole?: string | undefined;
  /** When they asked. Defaults to now. */
  givenAt?: Date | undefined;
  /** A letter or email asking to withdraw, if there is one. */
  fileId?: string | undefined;
  reason?: string | undefined;
}

/**
 * Withdraws the acceptance in force. It stops future use: an open assessment can't be submitted or approved while the notice is
 * withdrawn, and the work done on it is kept. Reports already issued are untouched. Withdrawing should be as easy as agreeing,
 * so staff record it on the SME's word, with a letter attached when there is one.
 */
export async function withdrawConsent(ctx: Ctx, organizationId: string, input: WithdrawInput): Promise<ConsentsView> {
  return ctx.db.transaction(async (tx) => {
    const access = await smeAccess(tx, ctx.principal, organizationId);
    if (!access.staff && !access.smeRole) throw new ServiceError("forbidden", "Only an Assessor, a Super Admin or someone from the SME can withdraw.");
    await lockSme(tx, organizationId);
    const current = await consentInForce(tx, organizationId, input.kind);
    if (!current) throw new ServiceError("conflict", `${capitalise(CONSENT_LABELS[input.kind])} isn't in force, so there is nothing to withdraw.`);

    let signatoryName: string;
    let signatoryRole: string | null;
    let givenAt = ctx.now;
    if (access.smeRole) {
      const [me] = await tx.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, ctx.principal.userId));
      signatoryName = me?.name ?? "Unknown";
      signatoryRole = access.smeRole === "owner" ? "Owner" : "Member";
    } else {
      const name = input.signatoryName?.trim();
      if (!name) throw new ServiceError("invalid", "Give the name of the person who asked to withdraw for the SME.");
      signatoryName = name;
      signatoryRole = input.signatoryRole?.trim() || null;
      if (input.givenAt) {
        if (input.givenAt > ctx.now) throw new ServiceError("invalid", "The date they asked can't be in the future.");
        if (input.givenAt < current.givenAt) throw new ServiceError("invalid", `The date they asked can't be before the acceptance it withdraws (${day(current.givenAt)}).`);
        givenAt = input.givenAt;
      }
    }
    if (input.fileId) await requireOwnFile(tx, ctx.principal, organizationId, input.fileId);

    const [created] = await tx
      .insert(schema.mizanConsent)
      .values({
        organizationId,
        kind: input.kind,
        accepted: false,
        signatoryName,
        signatoryRole,
        method: input.fileId ? "paper" : "in_platform",
        noticeVersion: current.noticeVersion,
        givenAt,
        fileId: input.fileId ?? null,
        capturedBy: ctx.principal.userId,
      })
      .returning();
    await tx
      .update(schema.mizanConsent)
      .set({ withdrawnAt: givenAt, withdrawnBy: ctx.principal.userId })
      .where(eq(schema.mizanConsent.id, current.id));
    await audit(
      tx,
      ctx,
      organizationId,
      "mizan.consent.withdrawn",
      created!.id,
      { consentId: current.id, noticeVersion: current.noticeVersion },
      { kind: input.kind, signatoryName, signatoryRole, givenAt: givenAt.toISOString(), fileId: input.fileId ?? null },
      input.reason?.trim() || null,
    );
    return consentsView(tx, access);
  });
}

/**
 * Two people recording for the same SME at once would otherwise both read the same record as the latest. Starting or submitting
 * an assessment takes it too, so a withdrawal can't commit between their notice check and their write.
 */
export async function lockSme(tx: Executor, organizationId: string) {
  await tx.select({ id: schema.smeProfile.id }).from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, organizationId)).for("update");
}

/**
 * The scan or letter must be the SME's, and uploaded by the person recording it. Attaching a file makes it MIZAN evidence that
 * every MIZAN staff member can open (mizanFileAllowed), so any other file of the SME's would otherwise be one record away.
 */
async function requireOwnFile(tx: Executor, principal: Principal, organizationId: string, fileId: string) {
  const [f] = await tx
    .select({ organizationId: schema.file.organizationId, uploaderUserId: schema.file.uploaderUserId, scanStatus: schema.file.scanStatus })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  if (!f || f.organizationId !== organizationId) throw new ServiceError("invalid", "That file isn't one of this SME's uploads.");
  if (f.uploaderUserId !== principal.userId) throw new ServiceError("invalid", "Attach a file you uploaded here, not one already in the SME's files.");
  if (f.scanStatus === "infected") throw new ServiceError("invalid", "That file failed the virus check. Upload a clean copy.");
}

async function audit(tx: Executor, ctx: Ctx, organizationId: string, action: string, entityId: string, before: unknown, after: unknown, reason: string | null = null) {
  await tx.insert(schema.auditLog).values({
    actorUserId: ctx.principal.userId,
    organizationId,
    platform: "mizan",
    action,
    entityType: "mizan_consent",
    entityId,
    before: before ?? null,
    after,
    reason,
  });
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
