import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  schema,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@entrust/db";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

export interface SessionMaterial {
  title: string;
  url: string;
}

export interface CreateSessionInput {
  cohortId: string;
  title: string;
  description?: string | null;
  moduleCodes?: string[];
  facilitatorUserId?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  venue?: string | null;
  recordingUrl?: string | null;
  learnerMaterials?: SessionMaterial[];
  facilitatorMaterials?: SessionMaterial[];
}

export interface UpdateSessionInput {
  title?: string;
  description?: string | null;
  moduleCodes?: string[];
  facilitatorUserId?: string | null;
  startTime?: string | Date;
  endTime?: string | Date;
  venue?: string | null;
  recordingUrl?: string | null;
  learnerMaterials?: SessionMaterial[];
  facilitatorMaterials?: SessionMaterial[];
}

export async function createSession(db: Executor, input: CreateSessionInput) {
  const title = input.title?.trim();
  if (!title) throw new ServiceError("invalid", "Session title is required.");

  // Verify cohort exists
  const [c] = await db
    .select({ id: schema.cohort.id })
    .from(schema.cohort)
    .where(eq(schema.cohort.id, input.cohortId));
  if (!c) throw new ServiceError("not_found", "Cohort not found.");

  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ServiceError("invalid", "Valid start and end times are required.");
  }
  if (start >= end) {
    throw new ServiceError("invalid", "Start time must be before end time.");
  }

  // If facilitatorUserId is given, verify user exists
  if (input.facilitatorUserId) {
    const [u] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, input.facilitatorUserId));
    if (!u) throw new ServiceError("not_found", "Facilitator user not found.");
  }

  const [row] = await db
    .insert(schema.liveSession)
    .values({
      cohortId: input.cohortId,
      title,
      description: input.description?.trim() || null,
      moduleCodes: input.moduleCodes ?? [],
      facilitatorUserId: input.facilitatorUserId || null,
      startTime: start,
      endTime: end,
      venue: input.venue?.trim() || null,
      recordingUrl: input.recordingUrl?.trim() || null,
      learnerMaterials: input.learnerMaterials ?? [],
      facilitatorMaterials: input.facilitatorMaterials ?? [],
    })
    .returning();

  return row!;
}

export async function updateSession(db: Executor, sessionId: string, input: UpdateSessionInput) {
  const [existing] = await db
    .select()
    .from(schema.liveSession)
    .where(eq(schema.liveSession.id, sessionId));
  if (!existing) throw new ServiceError("not_found", "Session not found.");

  const start = input.startTime ? new Date(input.startTime) : existing.startTime;
  const end = input.endTime ? new Date(input.endTime) : existing.endTime;
  if (start >= end) {
    throw new ServiceError("invalid", "Start time must be before end time.");
  }

  const [updated] = await db
    .update(schema.liveSession)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.moduleCodes !== undefined ? { moduleCodes: input.moduleCodes } : {}),
      ...(input.facilitatorUserId !== undefined ? { facilitatorUserId: input.facilitatorUserId || null } : {}),
      ...(input.startTime !== undefined ? { startTime: start } : {}),
      ...(input.endTime !== undefined ? { endTime: end } : {}),
      ...(input.venue !== undefined ? { venue: input.venue?.trim() || null } : {}),
      ...(input.recordingUrl !== undefined ? { recordingUrl: input.recordingUrl?.trim() || null } : {}),
      ...(input.learnerMaterials !== undefined ? { learnerMaterials: input.learnerMaterials } : {}),
      ...(input.facilitatorMaterials !== undefined ? { facilitatorMaterials: input.facilitatorMaterials } : {}),
    })
    .where(eq(schema.liveSession.id, sessionId))
    .returning();

  return updated!;
}

export async function listSessions(
  db: Executor,
  filter?: { cohortId?: string; upcomingOnly?: boolean },
  isStaff: boolean = false,
) {
  const conditions = [];
  if (filter?.cohortId) {
    conditions.push(eq(schema.liveSession.cohortId, filter.cohortId));
  }
  if (filter?.upcomingOnly) {
    conditions.push(sql`${schema.liveSession.endTime} >= now()`);
  }

  const rows = await db
    .select({
      id: schema.liveSession.id,
      cohortId: schema.liveSession.cohortId,
      cohortName: schema.cohort.name,
      title: schema.liveSession.title,
      description: schema.liveSession.description,
      moduleCodes: schema.liveSession.moduleCodes,
      facilitatorUserId: schema.liveSession.facilitatorUserId,
      facilitatorName: schema.user.name,
      startTime: schema.liveSession.startTime,
      endTime: schema.liveSession.endTime,
      venue: schema.liveSession.venue,
      recordingUrl: schema.liveSession.recordingUrl,
      learnerMaterials: schema.liveSession.learnerMaterials,
      facilitatorMaterials: schema.liveSession.facilitatorMaterials,
      createdAt: schema.liveSession.createdAt,
    })
    .from(schema.liveSession)
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.liveSession.cohortId))
    .leftJoin(schema.user, eq(schema.user.id, schema.liveSession.facilitatorUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(schema.liveSession.startTime);

  // Strip facilitatorMaterials if caller is not staff
  return rows.map((r) => ({
    ...r,
    facilitatorMaterials: isStaff ? r.facilitatorMaterials : [],
  }));
}

export async function getSession(db: Executor, sessionId: string, isStaff: boolean = false) {
  const [row] = await db
    .select({
      id: schema.liveSession.id,
      cohortId: schema.liveSession.cohortId,
      cohortName: schema.cohort.name,
      programId: schema.cohort.programId,
      programName: schema.program.name,
      title: schema.liveSession.title,
      description: schema.liveSession.description,
      moduleCodes: schema.liveSession.moduleCodes,
      facilitatorUserId: schema.liveSession.facilitatorUserId,
      facilitatorName: schema.user.name,
      startTime: schema.liveSession.startTime,
      endTime: schema.liveSession.endTime,
      venue: schema.liveSession.venue,
      recordingUrl: schema.liveSession.recordingUrl,
      learnerMaterials: schema.liveSession.learnerMaterials,
      facilitatorMaterials: schema.liveSession.facilitatorMaterials,
      createdAt: schema.liveSession.createdAt,
    })
    .from(schema.liveSession)
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.liveSession.cohortId))
    .innerJoin(schema.program, eq(schema.program.id, schema.cohort.programId))
    .leftJoin(schema.user, eq(schema.user.id, schema.liveSession.facilitatorUserId))
    .where(eq(schema.liveSession.id, sessionId));

  if (!row) throw new ServiceError("not_found", "Session not found.");

  return {
    ...row,
    facilitatorMaterials: isStaff ? row.facilitatorMaterials : [],
  };
}

export interface AttendanceRecordInput {
  userId: string;
  organizationId: string;
  status: AttendanceStatus;
  notes?: string | null;
}

export async function recordAttendance(
  db: Executor,
  actorUserId: string,
  sessionId: string,
  records: AttendanceRecordInput[],
) {
  const [sess] = await db
    .select({ id: schema.liveSession.id, cohortId: schema.liveSession.cohortId })
    .from(schema.liveSession)
    .where(eq(schema.liveSession.id, sessionId));
  if (!sess) throw new ServiceError("not_found", "Session not found.");

  const now = new Date();
  const results = [];

  for (const r of records) {
    if (!ATTENDANCE_STATUSES.includes(r.status)) {
      throw new ServiceError("invalid", `Invalid attendance status: ${r.status}`);
    }

    const [saved] = await db
      .insert(schema.attendance)
      .values({
        sessionId,
        userId: r.userId,
        organizationId: r.organizationId,
        status: r.status,
        notes: r.notes?.trim() || null,
        recordedByUserId: actorUserId,
        recordedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.attendance.sessionId, schema.attendance.userId],
        set: {
          status: r.status,
          notes: r.notes?.trim() || null,
          recordedByUserId: actorUserId,
          recordedAt: now,
          updatedAt: now,
        },
      })
      .returning();

    results.push(saved!);

    // Audit log
    await db.insert(schema.auditLog).values({
      actorUserId,
      organizationId: r.organizationId,
      platform: "trade",
      action: "trade.session.attendance_recorded",
      entityType: "attendance",
      entityId: saved!.id,
      after: {
        sessionId,
        userId: r.userId,
        status: r.status,
        notes: r.notes || null,
      },
    });
  }

  // NOTE: Attendance does NOT alter any module status or completion!
  return results;
}

export async function getFacilitatorRoster(db: Executor, sessionId: string) {
  const sess = await getSession(db, sessionId, true);

  // 1. Get all enrolled SMEs in this cohort
  const enrollments = await db
    .select({
      enrollmentId: schema.enrollment.id,
      organizationId: schema.enrollment.organizationId,
      organizationName: schema.organization.name,
      smeId: schema.smeProfile.smeId,
      legalName: schema.smeProfile.legalName,
      status: schema.enrollment.status,
    })
    .from(schema.enrollment)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.enrollment.organizationId))
    .where(eq(schema.enrollment.cohortId, sess.cohortId));

  const orgIds = enrollments.map((e) => e.organizationId);
  if (orgIds.length === 0) {
    return { session: sess, smes: [] };
  }

  // 2. Get members of these organisations
  const members = await db
    .select({
      organizationId: schema.member.organizationId,
      userId: schema.member.userId,
      role: schema.member.role,
      name: schema.user.name,
      email: schema.user.email,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(inArray(schema.member.organizationId, orgIds));

  // 3. Get recorded attendance for this session
  const attendanceRecords = await db
    .select()
    .from(schema.attendance)
    .where(eq(schema.attendance.sessionId, sessionId));

  const attendanceByUser = new Map(attendanceRecords.map((a) => [a.userId, a]));

  // 4. Get module progress for covered moduleCodes
  const moduleCodes = sess.moduleCodes ?? [];
  const enrollmentIds = enrollments.map((e) => e.enrollmentId);
  let moduleProgressList: {
    enrollmentId: string;
    moduleId: string;
    status: string;
    completedAt: Date | null;
  }[] = [];

  if (moduleCodes.length > 0 && enrollmentIds.length > 0) {
    moduleProgressList = await db
      .select({
        enrollmentId: schema.moduleProgress.enrollmentId,
        moduleId: schema.moduleProgress.moduleId,
        status: schema.moduleProgress.status,
        completedAt: schema.moduleProgress.completedAt,
      })
      .from(schema.moduleProgress)
      .where(
        and(
          inArray(schema.moduleProgress.enrollmentId, enrollmentIds),
          inArray(schema.moduleProgress.moduleId, moduleCodes as any),
        ),
      );
  }

  // Group by SME organisation
  const smes = enrollments.map((enr) => {
    const orgMembers = members.filter((m) => m.organizationId === enr.organizationId);
    const orgModules = moduleProgressList.filter((mp) => mp.enrollmentId === enr.enrollmentId);

    return {
      organizationId: enr.organizationId,
      organizationName: enr.organizationName,
      legalName: enr.legalName,
      smeId: enr.smeId,
      enrollmentStatus: enr.status,
      members: orgMembers.map((m) => {
        const att = attendanceByUser.get(m.userId);
        return {
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          attendance: att
            ? {
                id: att.id,
                status: att.status,
                notes: att.notes,
                recordedAt: att.recordedAt,
              }
            : null,
        };
      }),
      modules: moduleCodes.map((code) => {
        const prog = orgModules.find((p) => p.moduleId === code);
        return {
          moduleCode: code,
          status: prog?.status ?? "not_started",
          completedAt: prog?.completedAt ?? null,
        };
      }),
    };
  });

  return {
    session: sess,
    smes,
  };
}

export async function queueSessionReminders(db: Executor, sessionId: string) {
  const sess = await getSession(db, sessionId, true);

  // 1. Get enrolled SME organisations
  const enrollments = await db
    .select({ organizationId: schema.enrollment.organizationId })
    .from(schema.enrollment)
    .where(
      and(
        eq(schema.enrollment.cohortId, sess.cohortId),
        inArray(schema.enrollment.status, ["registered", "active"]),
      ),
    );

  const orgIds = enrollments.map((e) => e.organizationId);
  if (orgIds.length === 0) return { queued: 0 };

  // 2. Get members of these organisations
  const members = await db
    .select({
      userId: schema.member.userId,
      name: schema.user.name,
      email: schema.user.email,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(inArray(schema.member.organizationId, orgIds));

  // Deduplicate members across organisations
  const uniqueMembers = Array.from(new Map(members.map((m) => [m.userId, m])).values());

  let queued = 0;
  for (const m of uniqueMembers) {
    const singletonKey = `trade-session-reminder-${sessionId}-${m.userId}`;
    try {
      await enqueue(
        JOB_NAMES.SEND_EMAIL,
        {
          to: m.email,
          subject: `Reminder: ${sess.title} (${sess.cohortName})`,
          template: "trade-session-reminder",
          props: {
            sessionTitle: sess.title,
            cohortName: sess.cohortName,
            startTime: sess.startTime.toISOString(),
            venue: sess.venue || undefined,
            meetingUrl: sess.venue || undefined,
            recipientName: m.name,
          },
        },
        {
          singletonKey,
        },
      );
      queued++;
    } catch (err) {
      console.error(`[trade:sessions] Could not enqueue reminder for user ${m.userId}:`, err);
    }
  }

  return { queued };
}
