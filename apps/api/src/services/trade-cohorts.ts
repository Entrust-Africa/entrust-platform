import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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

export async function createCohort(db: Executor, input: CreateCohortInput) {
  const name = input.name.trim();
  if (!name) throw new ServiceError("invalid", "Cohort name is required.");

  // Verify program exists
  await getProgram(db, input.programId);

  // If sponsorOrganizationId provided, verify it exists
  if (input.sponsorOrganizationId) {
    const [sponsor] = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.id, input.sponsorOrganizationId));
    if (!sponsor) throw new ServiceError("not_found", "Sponsor organisation not found.");
  }

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

  return {
    ...cohortRow,
    enrolments: enrolledSmes,
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
  // 1. Verify cohort exists
  const [cohortRow] = await db
    .select({ id: schema.cohort.id })
    .from(schema.cohort)
    .where(eq(schema.cohort.id, input.cohortId));
  if (!cohortRow) throw new ServiceError("not_found", "Cohort not found.");

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

export async function updateEnrollmentStatus(
  db: Executor,
  actorUserId: string,
  enrollmentId: string,
  newStatus: EnrollmentStatus,
  reason?: string | null,
) {
  if (!ENROLLMENT_STATUSES.includes(newStatus)) {
    throw new ServiceError("invalid", `Invalid enrolment status: ${newStatus}`);
  }

  // Reason is required for pausing and withdrawing
  if ((newStatus === "paused" || newStatus === "withdrawn") && (!reason || !reason.trim())) {
    throw new ServiceError("invalid", `A reason is required to mark an enrolment as ${newStatus}.`);
  }

  const [current] = await db
    .select()
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, enrollmentId));
  if (!current) throw new ServiceError("not_found", "Enrolment not found.");

  const now = new Date();
  const updateData: Record<string, any> = {
    status: newStatus,
    updatedAt: now,
    ...(newStatus === "completed" ? { completedAt: now } : {}),
    ...(newStatus === "withdrawn" ? { withdrawnAt: now } : {}),
  };

  await db
    .update(schema.enrollment)
    .set(updateData)
    .where(eq(schema.enrollment.id, enrollmentId));

  await db.insert(schema.auditLog).values({
    actorUserId,
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
