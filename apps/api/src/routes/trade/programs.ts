import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb, schema, DELIVERY_MODES, ENROLLMENT_STATUSES } from "@entrust/db";
import type { AppEnv } from "../../app";
import { ServiceError } from "../../services/errors";
import { loadPrincipal } from "../../services/access";
import {
  assignCohortStaff,
  createCohort,
  createProgram,
  enrolSme,
  getCohort,
  getEnrollment,
  getProgram,
  listCohorts,
  listCohortStaff,
  listEnrollments,
  listPrograms,
  listWaitingSmes,
  refuseEnrolmentOutsideReach,
  removeCohortStaff,
  updateCohort,
  updateEnrollmentStatus,
} from "../../services/trade-cohorts";
import { assignedCohortIds, canReachCohort, limitedToAssignedCohorts } from "../../services/trade-shared";

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

// Schemas
const isoDateTop = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date, YYYY-MM-DD.");
const createProgramSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
});

const createCohortSchema = z.object({
  programId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  deliveryMode: z.enum(DELIVERY_MODES).default("self_paced"),
  country: z.string().trim().length(2).default("ET"),
  language: z.string().trim().default("en"),
  sponsorOrganizationId: z.string().optional().nullable(),
  startDate: isoDateTop.optional().nullable(),
  endDate: isoDateTop.optional().nullable(),
});

const isoDate = isoDateTop;
const updateCohortSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    deliveryMode: z.enum(DELIVERY_MODES).optional(),
    country: z.string().trim().length(2).optional(),
    language: z.string().trim().min(2).max(10).optional(),
    sponsorOrganizationId: z.string().trim().min(1).nullable().optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
  })
  .strict();

const enrolSmeSchema = z.object({
  cohortId: z.string().uuid(),
  organizationId: z.string().trim().min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(ENROLLMENT_STATUSES),
  reason: z.string().trim().optional().nullable(),
});

export const tradePrograms = new Hono<AppEnv>()
  // Programs
  .post(
    "/programs",
    zValidator("json", createProgramSchema, (result, c) => {
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
        throw new ServiceError("forbidden", "Only Entrust administrators and facilitators can create programs.");
      }

      const body = c.req.valid("json");
      const program = await createProgram(db, body);
      return c.json(program, 201);
    },
  )
  // The Quality role reads every programme's and cohort's reports, so it lists them too, and changes nothing.
  .get("/programs", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (!principal.staffRole && !principal.quality) {
      throw new ServiceError("forbidden", "Only Entrust staff can view all programs.");
    }

    const rows = await listPrograms(db);
    return c.json({ programs: rows });
  })
  .get("/programs/:id", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (!principal.staffRole) {
      throw new ServiceError("forbidden", "Only Entrust staff can view program details.");
    }

    const id = c.req.param("id");
    const prog = await getProgram(db, id);
    return c.json(prog);
  })

  // Cohorts
  .post(
    "/cohorts",
    zValidator("json", createCohortSchema, (result, c) => {
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
        throw new ServiceError("forbidden", "Only Entrust administrators and facilitators can create cohorts.");
      }

      const body = c.req.valid("json");
      // The sponsor decides which bank reads the cohort's reports, so only an administrator picks it, here as on PATCH.
      if (body.sponsorOrganizationId && principal.staffRole !== "admin") {
        throw new ServiceError("forbidden", "Only an Entrust administrator can set a cohort's sponsor.");
      }
      const cohort = await createCohort(db, body);
      // A facilitator who creates a cohort is on it, or they couldn't reach it.
      if (limitedToAssignedCohorts(principal)) await db.insert(schema.cohortStaff).values({ cohortId: cohort.id, userId: user.id, assignedByUserId: user.id });
      return c.json(cohort, 201);
    },
  )
  .get("/cohorts", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (!principal.staffRole && !principal.quality) {
      throw new ServiceError("forbidden", "Only Entrust staff can view cohorts.");
    }

    const programId = c.req.query("programId");
    const rows = await listCohorts(db, { programId });
    if (limitedToAssignedCohorts(principal)) {
      const assigned = await assignedCohortIds(db, user.id);
      return c.json({ cohorts: rows.filter((row) => assigned.includes(row.id)) });
    }
    return c.json({ cohorts: rows });
  })
  .get("/cohorts/:id", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (!principal.staffRole) {
      throw new ServiceError("forbidden", "Only Entrust staff can view cohort details.");
    }

    const id = c.req.param("id");
    if (!(await canReachCohort(db, principal, id))) throw new ServiceError("not_found", "Cohort not found.");
    const cohort = await getCohort(db, id);
    return c.json(cohort);
  })

  // Correcting a cohort: an administrator, or a facilitator on it. Only an administrator changes its sponsor, which
  // decides who reads the cohort's reports.
  .patch(
    "/cohorts/:id",
    zValidator("json", updateCohortSchema, (result, c) => {
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
        throw new ServiceError("forbidden", "Only Entrust administrators and facilitators can change a cohort.");
      }
      const id = c.req.param("id");
      if (!(await canReachCohort(db, principal, id))) throw new ServiceError("not_found", "Cohort not found.");
      const body = c.req.valid("json");
      if (body.sponsorOrganizationId !== undefined && principal.staffRole !== "admin") {
        throw new ServiceError("forbidden", "Only an Entrust administrator can change a cohort's sponsor.");
      }
      await db.transaction((tx) => updateCohort(tx, user.id, id, body));
      return c.json(await getCohort(db, id));
    },
  )

  // The facilitators and reviewers on a cohort. An administrator assigns them.
  .get("/cohorts/:id/staff", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (principal.staffRole !== "admin") throw new ServiceError("forbidden", "Only Entrust administrators assign staff to a cohort.");
    return c.json(await listCohortStaff(db, c.req.param("id")));
  })
  .post(
    "/cohorts/:id/staff",
    zValidator("json", z.object({ userId: z.string().trim().min(1) }), (result, c) => {
      if (!result.success) return c.json({ error: "userId: Say who to assign.", code: "invalid" }, 400);
    }),
    async (c) => {
      const user = requireUser(c);
      requireTrustedOrigin(c);
      const db = getDb();
      const principal = await loadPrincipal(db, user.id);
      if (principal.staffRole !== "admin") throw new ServiceError("forbidden", "Only Entrust administrators assign staff to a cohort.");
      await assignCohortStaff(db, user.id, c.req.param("id"), c.req.valid("json").userId);
      return c.json(await listCohortStaff(db, c.req.param("id")), 201);
    },
  )
  .delete("/cohorts/:id/staff/:userId", async (c) => {
    const user = requireUser(c);
    requireTrustedOrigin(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (principal.staffRole !== "admin") throw new ServiceError("forbidden", "Only Entrust administrators assign staff to a cohort.");
    await removeCohortStaff(db, user.id, c.req.param("id"), c.req.param("userId"));
    return c.json(await listCohortStaff(db, c.req.param("id")));
  })

  // Enrolments
  .post(
    "/enrollments",
    zValidator("json", enrolSmeSchema, (result, c) => {
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
        throw new ServiceError("forbidden", "Only Entrust administrators and facilitators can enrol SMEs.");
      }

      const body = c.req.valid("json");
      if (!(await canReachCohort(db, principal, body.cohortId))) throw new ServiceError("not_found", "Cohort not found.");
      await refuseEnrolmentOutsideReach(db, principal, body.organizationId);
      const enr = await db.transaction((tx) => enrolSme(tx, user.id, body));
      return c.json(enr, 201);
    },
  )
  .get("/enrollments/waiting", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
      throw new ServiceError("forbidden", "Only Entrust administrators and facilitators can see the businesses waiting to be enrolled.");
    }
    return c.json({ smes: await listWaitingSmes(db) });
  })
  .get("/enrollments", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);

    const cohortId = c.req.query("cohortId");
    const organizationId = c.req.query("organizationId");

    // If not staff, user can only query their own SME organisation
    if (!principal.staffRole) {
      if (!organizationId || !principal.smeRoles.has(organizationId)) {
        throw new ServiceError("forbidden", "You can only view enrolments for organisations you belong to.");
      }
    }

    const rows = await listEnrollments(db, { cohortId, organizationId });
    if (limitedToAssignedCohorts(principal)) {
      const assigned = await assignedCohortIds(db, user.id);
      return c.json({ enrollments: rows.filter((row) => assigned.includes(row.cohortId)) });
    }
    return c.json({ enrollments: rows });
  })
  .get("/enrollments/:id", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);

    const id = c.req.param("id");
    const enr = await getEnrollment(db, id);
    if (principal.staffRole && !(await canReachCohort(db, principal, enr.cohortId))) throw new ServiceError("not_found", "Enrolment not found.");

    // If not staff, ensure user is a member of the enrolled organisation
    if (!principal.staffRole && !principal.smeRoles.has(enr.organizationId)) {
      throw new ServiceError("forbidden", "You can only view enrolments for your own organisation.");
    }

    return c.json(enr);
  })
  .patch(
    "/enrollments/:id/status",
    zValidator("json", updateStatusSchema, (result, c) => {
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
        throw new ServiceError("forbidden", "Only Entrust administrators and facilitators can update enrolment status.");
      }

      const id = c.req.param("id");
      const body = c.req.valid("json");

      const current = await getEnrollment(db, id);
      if (!(await canReachCohort(db, principal, current.cohortId))) throw new ServiceError("not_found", "Enrolment not found.");
      const result = await db.transaction((tx) => updateEnrollmentStatus(tx, { userId: user.id, staffRole: principal.staffRole }, id, body.status, body.reason));
      return c.json(result);
    },
  );
