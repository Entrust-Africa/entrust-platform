import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb, ATTENDANCE_STATUSES, schema } from "@entrust/db";
import { and, eq, inArray } from "drizzle-orm";
import type { AppEnv } from "../../app";
import { ServiceError } from "../../services/errors";
import { loadPrincipal } from "../../services/access";
import {
  createSession,
  getFacilitatorRoster,
  getSession,
  listSessions,
  queueSessionReminders,
  recordAttendance,
  updateSession,
} from "../../services/trade-sessions";

function requireUser(c: { get: (key: "user") => AppEnv["Variables"]["user"] }) {
  const user = c.get("user");
  if (!user) throw new ServiceError("unauthenticated", "Not signed in.");
  return user;
}

function requireTrustedOrigin(c: { req: { header: (name: string) => string | undefined } }) {
  const origin = c.req.header("origin");
  const defaultTrusted = ["http://localhost:3000", "http://localhost:3001", "http://localhost:6001"];
  const envTrusted = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const trusted = Array.from(new Set([...defaultTrusted, ...envTrusted]));
  if (origin && !trusted.includes(origin)) {
    throw new ServiceError("forbidden", "That request origin is not allowed.");
  }
}

const sessionMaterialSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().url(),
});

const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  moduleCodes: z.array(z.string().trim()).default([]),
  facilitatorUserId: z.string().optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  venue: z.string().trim().max(500).optional().nullable(),
  recordingUrl: z.string().url().optional().nullable(),
  learnerMaterials: z.array(sessionMaterialSchema).default([]),
  facilitatorMaterials: z.array(sessionMaterialSchema).default([]),
});

const updateSessionSchema = createSessionSchema.partial();

const attendanceRecordSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  status: z.enum(ATTENDANCE_STATUSES),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const recordAttendanceSchema = z.object({
  records: z.array(attendanceRecordSchema).min(1),
});

export const tradeSessions = new Hono<AppEnv>()
  // Create session for cohort (staff only)
  .post(
    "/cohorts/:cohortId/sessions",
    zValidator("json", createSessionSchema, (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input.";
        return c.json({ error: message, code: "invalid" }, 400);
      }
    }),
    async (c) => {
      const user = requireUser(c);
      requireTrustedOrigin(c);
      const db = getDb();
      const principal = await loadPrincipal(db, user.id);
      if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
        throw new ServiceError("forbidden", "Only Entrust administrators and facilitators can schedule sessions.");
      }

      const cohortId = c.req.param("cohortId");
      const body = c.req.valid("json");
      const session = await createSession(db, {
        ...body,
        cohortId,
      });

      return c.json(session, 201);
    },
  )

  // List sessions for cohort
  .get("/cohorts/:cohortId/sessions", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    const cohortId = c.req.param("cohortId");

    const isStaff = Boolean(principal.staffRole);

    // If not staff, ensure user is a member of an SME enrolled in this cohort
    if (!isStaff) {
      const userOrgIds = Array.from(principal.smeRoles.keys());
      if (userOrgIds.length === 0) {
        throw new ServiceError("forbidden", "You are not enrolled in this cohort.");
      }

      const [enr] = await db
        .select({ id: schema.enrollment.id })
        .from(schema.enrollment)
        .where(
          and(
            eq(schema.enrollment.cohortId, cohortId),
            inArray(schema.enrollment.organizationId, userOrgIds),
          ),
        );
      if (!enr) {
        throw new ServiceError("forbidden", "You are not enrolled in this cohort.");
      }
    }

    const sessions = await listSessions(db, { cohortId }, isStaff);
    return c.json({ sessions });
  })

  // Get session details
  .get("/sessions/:id", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    const sessionId = c.req.param("id");

    const isStaff = Boolean(principal.staffRole);
    const sess = await getSession(db, sessionId, isStaff);

    if (!isStaff) {
      const userOrgIds = Array.from(principal.smeRoles.keys());
      const [enr] = await db
        .select({ id: schema.enrollment.id })
        .from(schema.enrollment)
        .where(
          and(
            eq(schema.enrollment.cohortId, sess.cohortId),
            inArray(schema.enrollment.organizationId, userOrgIds),
          ),
        );
      if (!enr) {
        throw new ServiceError("forbidden", "You do not have access to this session.");
      }
    }

    return c.json(sess);
  })

  // Update session (staff only)
  .patch(
    "/sessions/:id",
    zValidator("json", updateSessionSchema, (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input.";
        return c.json({ error: message, code: "invalid" }, 400);
      }
    }),
    async (c) => {
      const user = requireUser(c);
      requireTrustedOrigin(c);
      const db = getDb();
      const principal = await loadPrincipal(db, user.id);
      if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
        throw new ServiceError("forbidden", "Only Entrust administrators and facilitators can update sessions.");
      }

      const sessionId = c.req.param("id");
      const body = c.req.valid("json");
      const updated = await updateSession(db, sessionId, body);
      return c.json(updated);
    },
  )

  // Facilitator preparation roster & attendance sheet (staff only)
  .get("/sessions/:id/roster", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
      throw new ServiceError("forbidden", "Only Entrust staff can view the session roster.");
    }

    const sessionId = c.req.param("id");
    const roster = await getFacilitatorRoster(db, sessionId);
    return c.json(roster);
  })

  // Record attendance marks (staff only)
  .post(
    "/sessions/:id/attendance",
    zValidator("json", recordAttendanceSchema, (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input.";
        return c.json({ error: message, code: "invalid" }, 400);
      }
    }),
    async (c) => {
      const user = requireUser(c);
      requireTrustedOrigin(c);
      const db = getDb();
      const principal = await loadPrincipal(db, user.id);
      if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
        throw new ServiceError("forbidden", "Only Entrust staff can record attendance.");
      }

      const sessionId = c.req.param("id");
      const body = c.req.valid("json");
      const recorded = await recordAttendance(db, user.id, sessionId, body.records);
      return c.json({ recorded });
    },
  )

  // Send reminders (staff only)
  .post("/sessions/:id/reminders", async (c) => {
    const user = requireUser(c);
    requireTrustedOrigin(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
      throw new ServiceError("forbidden", "Only Entrust staff can trigger session reminders.");
    }

    const sessionId = c.req.param("id");
    const result = await queueSessionReminders(db, sessionId);
    return c.json(result);
  });
