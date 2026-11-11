import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  schema,
  DELIVERY_MODES,
  type DeliveryMode,
  ENROLLMENT_STATUSES,
  type EnrollmentStatus,
} from "@entrust/db";
import { organizationKind } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { tradeToday } from "@entrust/trade-engine";
import { recordTradeChange } from "./trade-shared";

// ---- Program Services ----

export interface CreateProgramInput {
  name: string;
  description?: string | null;
}

export async function createProgram(db: Executor, input: CreateProgramInput) {
  const name = input.name.trim();
  if (!name) throw new ServiceError("invalid", "Program name is required.");

  const [row] = await db
    .insert(schema.program)
    .values({
      name,
      description: input.description?.trim() || null,
    })
    .returning();

  return row!;
}

export async function listPrograms(db: Executor) {
  return db.select().from(schema.program).orderBy(desc(schema.program.createdAt));
}

export async function getProgram(db: Executor, id: string) {
  const [row] = await db.select().from(schema.program).where(eq(schema.program.id, id));
  if (!row) throw new ServiceError("not_found", "Program not found.");
  return row;
}

// ---- Cohort Services ----

export interface CreateCohortInput {
  programId: string;
  name: string;
  deliveryMode?: DeliveryMode;
  country?: string;
  language?: string;
  sponsorOrganizationId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

/** A sponsor named on a cohort has to be a sponsor organisation: naming a business or Entrust would give it a sponsor's view. */
async function requireSponsor(db: Executor, organizationId: string): Promise<void> {
  const [sponsor] = await db
    .select({ id: schema.organization.id, metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId));
  if (!sponsor || organizationKind(sponsor.metadata) !== "sponsor") throw new ServiceError("not_found", "Sponsor organisation not found.");
}

function checkDates(startDate: string | null | undefined, endDate: string | null | undefined): void {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !iso.test(startDate)) throw new ServiceError("invalid", "The start date is a date, YYYY-MM-DD.");
  if (endDate && !iso.test(endDate)) throw new ServiceError("invalid", "The end date is a date, YYYY-MM-DD.");
  if (startDate && endDate && endDate < startDate) throw new ServiceError("invalid", "A cohort can't end before it starts.");
}

export async function createCohort(db: Executor, input: CreateCohortInput) {
  const name = input.name.trim();
  if (!name) throw new ServiceError("invalid", "Cohort name is required.");

  // Verify program exists
  await getProgram(db, input.programId);
  if (input.sponsorOrganizationId) await requireSponsor(db, input.sponsorOrganizationId);
  checkDates(input.startDate, input.endDate);

  const [row] = await db
    .insert(schema.cohort)
    .values({
      programId: input.programId,
      name,
      deliveryMode: input.deliveryMode ?? "self_paced",
      country: input.country ?? "ET",
      language: input.language ?? "en",
      sponsorOrganizationId: input.sponsorOrganizationId || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
    })
    .returning();

  return row!;
}

export interface UpdateCohortInput {
  name?: string | undefined;
  deliveryMode?: DeliveryMode | undefined;
  country?: string | undefined;
  language?: string | undefined;
  sponsorOrganizationId?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
}

/**
 * Corrects a cohort's details. Changing or removing the sponsor changes who sees the cohort's reports, so only an
 * administrator does that (the route checks), and it's on the audit trail with the rest.
 */
export async function updateCohort(db: Executor, actorUserId: string, cohortId: string, input: UpdateCohortInput) {
  const [current] = await db.select().from(schema.cohort).where(eq(schema.cohort.id, cohortId));
  if (!current) throw new ServiceError("not_found", "Cohort not found.");
  if (input.sponsorOrganizationId) await requireSponsor(db, input.sponsorOrganizationId);
  const startDate = input.startDate === undefined ? current.startDate : input.startDate;
  const endDate = input.endDate === undefined ? current.endDate : input.endDate;
  checkDates(startDate, endDate);
  const change = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.deliveryMode !== undefined ? { deliveryMode: input.deliveryMode } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.sponsorOrganizationId !== undefined ? { sponsorOrganizationId: input.sponsorOrganizationId || null } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate || null } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate || null } : {}),
  };
  if (change.name === "") throw new ServiceError("invalid", "Cohort name is required.");
  if (Object.keys(change).length === 0) return current;
  const [updated] = await db.update(schema.cohort).set({ ...change, updatedAt: new Date() }).where(eq(schema.cohort.id, cohortId)).returning();
  const before = Object.fromEntries(Object.keys(change).map((k) => [k, current[k as keyof typeof current]]));
  await recordTradeChange(db, actorUserId, { action: "trade.cohort.updated", organizationId: null, entityType: "cohort", entityId: cohortId, before, after: change });
  return updated!;
}

export async function listCohorts(db: Executor, filter?: { programId?: string }) {
  const conditions = filter?.programId ? eq(schema.cohort.programId, filter.programId) : undefined;

  const rows = await db
    .select({
      id: schema.cohort.id,
      programId: schema.cohort.programId,
      programName: schema.program.name,
      name: schema.cohort.name,
      deliveryMode: schema.cohort.deliveryMode,
      country: schema.cohort.country,
      language: schema.cohort.language,
      sponsorOrganizationId: schema.cohort.sponsorOrganizationId,
      sponsorName: schema.organization.name,
      startDate: schema.cohort.startDate,
      endDate: schema.cohort.endDate,
      createdAt: schema.cohort.createdAt,
      enrolledCount: sql<number>`count(distinct ${schema.enrollment.id})::int`,
    })
    .from(schema.cohort)
    .innerJoin(schema.program, eq(schema.program.id, schema.cohort.programId))
    .leftJoin(schema.organization, eq(schema.organization.id, schema.cohort.sponsorOrganizationId))
    .leftJoin(schema.enrollment, eq(schema.enrollment.cohortId, schema.cohort.id))
    .where(conditions)
    .groupBy(
      schema.cohort.id,
      schema.program.name,
      schema.organization.name,
    )
    .orderBy(desc(schema.cohort.createdAt));

  return rows;
}

export async function getCohort(db: Executor, id: string) {
  const [cohortRow] = await db
    .select({
      id: schema.cohort.id,
      programId: schema.cohort.programId,
      programName: schema.program.name,
      name: schema.cohort.name,
      deliveryMode: schema.cohort.deliveryMode,
      country: schema.cohort.country,
      language: schema.cohort.language,
      sponsorOrganizationId: schema.cohort.sponsorOrganizationId,
      sponsorName: schema.organization.name,
      startDate: schema.cohort.startDate,
      endDate: schema.cohort.endDate,
      createdAt: schema.cohort.createdAt,
    })
    .from(schema.cohort)
    .innerJoin(schema.program, eq(schema.program.id, schema.cohort.programId))
    .leftJoin(schema.organization, eq(schema.organization.id, schema.cohort.sponsorOrganizationId))
    .where(eq(schema.cohort.id, id));

  if (!cohortRow) throw new ServiceError("not_found", "Cohort not found.");

  // Get enrolled SMEs
  const enrolledSmes = await db
    .select({
      enrollmentId: schema.enrollment.id,
      organizationId: schema.enrollment.organizationId,
      organizationName: schema.organization.name,
      smeId: schema.smeProfile.smeId,
      legalName: schema.smeProfile.legalName,
      tradingName: schema.smeProfile.tradingName,
      status: schema.enrollment.status,
      enrolledAt: schema.enrollment.enrolledAt,
      completedAt: schema.enrollment.completedAt,
      withdrawnAt: schema.enrollment.withdrawnAt,
    })
    .from(schema.enrollment)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.enrollment.organizationId))
    .where(eq(schema.enrollment.cohortId, id))
    .orderBy(desc(schema.enrollment.enrolledAt));

  // Where each business's plan and pathway stand, so staff can act on what's waiting for them.
  const enrollmentIds = enrolledSmes.map((e) => e.enrollmentId);
  const plans = enrollmentIds.length
    ? await db
        .select({ id: schema.learningPlan.id, enrollmentId: schema.learningPlan.enrollmentId, status: schema.learningPlan.status })
        .from(schema.learningPlan)
        .where(and(inArray(schema.learningPlan.enrollmentId, enrollmentIds), ne(schema.learningPlan.status, "superseded")))
    : [];
  const pathways = enrollmentIds.length
    ? await db
        .select({ enrollmentId: schema.pathwayAssignment.enrollmentId, pathway: schema.pathwayAssignment.pathway, status: schema.pathwayAssignment.status })
        .from(schema.pathwayAssignment)
        .where(and(inArray(schema.pathwayAssignment.enrollmentId, enrollmentIds), inArray(schema.pathwayAssignment.status, ["provisional", "confirmed"])))
    : [];

  return {
    ...cohortRow,
    enrolments: enrolledSmes.map((e) => ({
      ...e,
      plan: plans.find((p) => p.enrollmentId === e.enrollmentId) ?? null,
      pathway: pathways.find((p) => p.enrollmentId === e.enrollmentId) ?? null,
    })),
  };
}

// ---- Enrolment Services ----

export interface EnrolSmeInput {
  cohortId: string;
  organizationId: string;
}

export async function enrolSme(
  db: Executor,
  actorUserId: string,
  input: EnrolSmeInput,
) {
  // 1. Verify cohort exists, and that it hasn't ended
  const [cohortRow] = await db
    .select({ id: schema.cohort.id, endDate: schema.cohort.endDate })
    .from(schema.cohort)
    .where(eq(schema.cohort.id, input.cohortId));
  if (!cohortRow) throw new ServiceError("not_found", "Cohort not found.");
  if (cohortRow.endDate && cohortRow.endDate < tradeToday()) {
    throw new ServiceError("invalid", `This cohort ended on ${cohortRow.endDate}, so it takes no new businesses.`);
  }

  // 2. Verify organisation exists and has an SME profile
  const [org] = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      metadata: schema.organization.metadata,
      smeId: schema.smeProfile.smeId,
      legalName: schema.smeProfile.legalName,
    })
    .from(schema.organization)
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.organization.id))
    .where(eq(schema.organization.id, input.organizationId));
  if (!org) throw new ServiceError("not_found", "Organisation not found.");
  const kind = organizationKind(org.metadata);
  if (kind && kind !== "sme") throw new ServiceError("invalid", "Only an SME can be enrolled in a cohort.");
  // Every SME record has one SME ID. An organisation made outside the registration form has none yet.
  if (!org.smeId) throw new ServiceError("invalid", "This organisation has no SME ID. Register it as an SME first.");

  // 3. Check for existing enrolment in this cohort
  const [existing] = await db
    .select({ id: schema.enrollment.id })
    .from(schema.enrollment)
    .where(
      and(
        eq(schema.enrollment.cohortId, input.cohortId),
        eq(schema.enrollment.organizationId, input.organizationId),
      ),
    );
  if (existing) {
    throw new ServiceError(
      "conflict",
      "This organisation is already enrolled in this cohort.",
    );
  }
  // One live enrolment at a time: the diagnostic, placement and every screen work from "the" enrolment.
  await refuseSecondLiveEnrolment(db, input.organizationId);

  // 4. Determine initial status: registered if organisation already has members, invited otherwise
  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.member)
    .where(eq(schema.member.organizationId, input.organizationId));
  const initialStatus: EnrollmentStatus = (memberCount?.count ?? 0) > 0 ? "registered" : "invited";

  // 5. Insert enrolment & grant trade access in transaction
  const [enr] = await db
    .insert(schema.enrollment)
    .values({
      cohortId: input.cohortId,
      organizationId: input.organizationId,
      status: initialStatus,
    })
    .returning();

  // Grant platform access to trade (on conflict do nothing)
  await db
    .insert(schema.platformAccess)
    .values({
      organizationId: input.organizationId,
      platform: "trade",
      grantedBy: actorUserId,
    })
    .onConflictDoNothing();

  // Audit log
  await db.insert(schema.auditLog).values({
    actorUserId,
    organizationId: input.organizationId,
    platform: "trade",
    action: "trade.enrolled",
    entityType: "enrollment",
    entityId: enr!.id,
    after: {
      id: enr!.id,
      cohortId: input.cohortId,
      organizationId: input.organizationId,
      status: initialStatus,
      smeId: org.smeId,
    },
  });

  return enr!;
}

export interface WaitingSme {
  organizationId: string;
  organizationName: string;
  smeId: string | null;
  legalName: string | null;
  country: string | null;
  ownerEmail: string | null;
  createdAt: Date;
}

/**
 * The businesses that have signed up to TRADE and are in no cohort yet, newest first: the ones Entrust still has to
 * enrol. A business that was enrolled and withdrawn is not here, because it has an enrolment row.
 */
export async function listWaitingSmes(db: Executor, limit = 200): Promise<WaitingSme[]> {
  const rows = await db
    .select({
      organizationId: schema.organization.id,
      organizationName: schema.organization.name,
      metadata: schema.organization.metadata,
      smeId: schema.smeProfile.smeId,
      legalName: schema.smeProfile.legalName,
      country: schema.smeProfile.country,
      ownerEmail: sql<string | null>`(
        select ${schema.user.email} from ${schema.member}
        inner join ${schema.user} on ${schema.user.id} = ${schema.member.userId}
        where ${schema.member.organizationId} = ${schema.organization.id} and ${schema.member.role} = 'owner'
        order by ${schema.member.createdAt} limit 1
      )`,
      createdAt: schema.organization.createdAt,
    })
    .from(schema.organization)
    .innerJoin(
      schema.platformAccess,
      and(eq(schema.platformAccess.organizationId, schema.organization.id), eq(schema.platformAccess.platform, "trade")),
    )
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.organization.id))
    .leftJoin(schema.enrollment, eq(schema.enrollment.organizationId, schema.organization.id))
    .where(isNull(schema.enrollment.id))
    .orderBy(desc(schema.organization.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));

  return rows
    .filter((r) => (organizationKind(r.metadata) ?? "sme") === "sme")
    .map(({ metadata: _metadata, ...rest }) => rest);
}

export async function listEnrollments(
  db: Executor,
  filter?: { cohortId?: string; organizationId?: string },
) {
  const conditions = [];
  if (filter?.cohortId) conditions.push(eq(schema.enrollment.cohortId, filter.cohortId));
  if (filter?.organizationId) conditions.push(eq(schema.enrollment.organizationId, filter.organizationId));

  return db
    .select({
      id: schema.enrollment.id,
      cohortId: schema.enrollment.cohortId,
      cohortName: schema.cohort.name,
      programId: schema.cohort.programId,
      programName: schema.program.name,
      organizationId: schema.enrollment.organizationId,
      organizationName: schema.organization.name,
      smeId: schema.smeProfile.smeId,
      legalName: schema.smeProfile.legalName,
      status: schema.enrollment.status,
      enrolledAt: schema.enrollment.enrolledAt,
      completedAt: schema.enrollment.completedAt,
      withdrawnAt: schema.enrollment.withdrawnAt,
    })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.enrollment.cohortId))
    .innerJoin(schema.program, eq(schema.program.id, schema.cohort.programId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.enrollment.organizationId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.enrollment.enrolledAt));
}

export async function getEnrollment(db: Executor, id: string) {
  const [row] = await db
    .select({
      id: schema.enrollment.id,
      cohortId: schema.enrollment.cohortId,
      cohortName: schema.cohort.name,
      deliveryMode: schema.cohort.deliveryMode,
      programId: schema.cohort.programId,
      programName: schema.program.name,
      organizationId: schema.enrollment.organizationId,
      organizationName: schema.organization.name,
      smeId: schema.smeProfile.smeId,
      legalName: schema.smeProfile.legalName,
      status: schema.enrollment.status,
      enrolledAt: schema.enrollment.enrolledAt,
      completedAt: schema.enrollment.completedAt,
      withdrawnAt: schema.enrollment.withdrawnAt,
    })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.enrollment.cohortId))
    .innerJoin(schema.program, eq(schema.program.id, schema.cohort.programId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.enrollment.organizationId))
    .where(eq(schema.enrollment.id, id));

  if (!row) throw new ServiceError("not_found", "Enrolment not found.");
  return row;
}

/** Enrolments that are still running. A business has at most one of these. */
export const LIVE_ENROLMENT_STATUSES = ["invited", "registered", "active", "paused"] as const satisfies readonly EnrollmentStatus[];

async function refuseSecondLiveEnrolment(db: Executor, organizationId: string, except?: string): Promise<void> {
  // Two enrolments of the same business at once take turns on the business, so both can't pass this check.
  await db.select({ id: schema.organization.id }).from(schema.organization).where(eq(schema.organization.id, organizationId)).for("update");
  const live = await db
    .select({ id: schema.enrollment.id, cohortName: schema.cohort.name })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.enrollment.cohortId))
    .where(and(eq(schema.enrollment.organizationId, organizationId), inArray(schema.enrollment.status, [...LIVE_ENROLMENT_STATUSES])));
  const other = live.find((e) => e.id !== except);
  if (other) throw new ServiceError("conflict", `This business is already enrolled in ${other.cohortName}. Withdraw it there first.`);
}

/**
 * Where a status can go by hand. A finished programme leaves `completed` only by the reopen path (a score override or a
 * withdrawn exemption), and `completed` is reached only by completing the modules. A withdrawn business comes back to
 * `active` by an administrator's decision, with a reason.
 */
const ENROLMENT_TRANSITIONS: Readonly<Record<EnrollmentStatus, readonly EnrollmentStatus[]>> = {
  invited: ["registered", "active", "withdrawn"],
  registered: ["active", "paused", "withdrawn"],
  active: ["paused", "withdrawn"],
  paused: ["active", "withdrawn"],
  completed: [],
  withdrawn: ["active"],
};

export async function updateEnrollmentStatus(
  db: Executor,
  actor: { userId: string; staffRole: string | null },
  enrollmentId: string,
  newStatus: EnrollmentStatus,
  reason?: string | null,
) {
  if (!ENROLLMENT_STATUSES.includes(newStatus)) {
    throw new ServiceError("invalid", `Invalid enrolment status: ${newStatus}`);
  }

  // A programme completes when its modules do, which is what earns the certificate. Saying so by hand would count an SME as a
  // graduate with nothing behind it.
  if (newStatus === "completed") {
    throw new ServiceError("invalid", "An enrolment completes by itself when every assigned module is passed.");
  }

  const [current] = await db
    .select()
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, enrollmentId))
    .for("update");
  if (!current) throw new ServiceError("not_found", "Enrolment not found.");
  const from = current.status as EnrollmentStatus;

  if (from === newStatus) throw new ServiceError("invalid_transition", `This enrolment is already ${newStatus}.`);
  if (from === "completed") {
    throw new ServiceError("invalid_transition", "This programme is finished and holds its certificate. It reopens only when a module's result changes.");
  }
  if (!ENROLMENT_TRANSITIONS[from].includes(newStatus)) {
    throw new ServiceError("invalid_transition", `An enrolment can't go from ${from} to ${newStatus}.`);
  }
  const reactivating = from === "withdrawn";
  if (reactivating && actor.staffRole !== "admin") {
    throw new ServiceError("forbidden", "Only an Entrust administrator can bring back a withdrawn enrolment.");
  }

  // Reason is required for pausing, withdrawing and bringing a business back
  if ((newStatus === "paused" || newStatus === "withdrawn" || reactivating) && (!reason || !reason.trim())) {
    throw new ServiceError("invalid", reactivating ? "Say why this business is coming back." : `A reason is required to mark an enrolment as ${newStatus}.`);
  }
  if (reactivating) await refuseSecondLiveEnrolment(db, current.organizationId, enrollmentId);

  const now = new Date();
  const updateData: Record<string, any> = {
    status: newStatus,
    updatedAt: now,
    ...(newStatus === "withdrawn" ? { withdrawnAt: now } : {}),
    ...(reactivating ? { withdrawnAt: null } : {}),
  };

  await db
    .update(schema.enrollment)
    .set(updateData)
    .where(eq(schema.enrollment.id, enrollmentId));

  await db.insert(schema.auditLog).values({
    actorUserId: actor.userId,
    organizationId: current.organizationId,
    platform: "trade",
    action: "enrollment.status_updated",
    entityType: "enrollment",
    entityId: enrollmentId,
    before: { status: current.status },
    after: { status: newStatus },
    reason: reason?.trim() || null,
  });

  return { ok: true, id: enrollmentId, status: newStatus };
}

/**
 * A facilitator works with the businesses on their own cohorts. Enrolling one that has been in a cohort they aren't on
 * would open that business's whole record to them (canReachOrganization), so an administrator does that.
 */
export async function refuseEnrolmentOutsideReach(db: Executor, principal: { userId: string; staffRole: string | null }, organizationId: string): Promise<void> {
  if (principal.staffRole === "admin") return;
  const elsewhere = await db
    .select({ cohortId: schema.enrollment.cohortId })
    .from(schema.enrollment)
    .where(
      and(
        eq(schema.enrollment.organizationId, organizationId),
        sql`not exists (select 1 from ${schema.cohortStaff} where ${schema.cohortStaff.cohortId} = ${schema.enrollment.cohortId} and ${schema.cohortStaff.userId} = ${principal.userId})`,
      ),
    )
    .limit(1);
  if (elsewhere.length) {
    throw new ServiceError("forbidden", "This business has been in a cohort you aren't on, so an Entrust administrator enrols it.");
  }
}

// ---- Staff assigned to a cohort ----

/** The facilitators and reviewers on a cohort, and the Entrust staff who could be added. */
export async function listCohortStaff(db: Executor, cohortId: string) {
  const assigned = await db
    .select({ userId: schema.cohortStaff.userId, name: schema.user.name, email: schema.user.email, assignedAt: schema.cohortStaff.createdAt })
    .from(schema.cohortStaff)
    .innerJoin(schema.user, eq(schema.user.id, schema.cohortStaff.userId))
    .where(eq(schema.cohortStaff.cohortId, cohortId));
  const entrustOrg = process.env.ENTRUST_ORG_ID;
  const staff = entrustOrg
    ? await db
        .select({ userId: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.member.role })
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(and(eq(schema.member.organizationId, entrustOrg), inArray(schema.member.role, ["facilitator", "reviewer"])))
    : [];
  const taken = new Set(assigned.map((a) => a.userId));
  return { assigned, available: staff.filter((s) => !taken.has(s.userId)) };
}

export async function assignCohortStaff(db: Executor, actorUserId: string, cohortId: string, userId: string) {
  const [cohort] = await db.select({ id: schema.cohort.id }).from(schema.cohort).where(eq(schema.cohort.id, cohortId));
  if (!cohort) throw new ServiceError("not_found", "Cohort not found.");
  const { available } = await listCohortStaff(db, cohortId);
  if (!available.some((s) => s.userId === userId)) throw new ServiceError("invalid", "Choose a facilitator or reviewer who isn't on this cohort yet.");
  await db.insert(schema.cohortStaff).values({ cohortId, userId, assignedByUserId: actorUserId }).onConflictDoNothing();
  await recordTradeChange(db, actorUserId, { action: "trade.cohort_staff.assigned", organizationId: null, entityType: "cohort", entityId: cohortId, after: { userId } });
}

export async function removeCohortStaff(db: Executor, actorUserId: string, cohortId: string, userId: string) {
  const removed = await db
    .delete(schema.cohortStaff)
    .where(and(eq(schema.cohortStaff.cohortId, cohortId), eq(schema.cohortStaff.userId, userId)))
    .returning();
  if (removed.length === 0) throw new ServiceError("not_found", "That person isn't on this cohort.");
  await recordTradeChange(db, actorUserId, { action: "trade.cohort_staff.removed", organizationId: null, entityType: "cohort", entityId: cohortId, before: { userId } });
}
