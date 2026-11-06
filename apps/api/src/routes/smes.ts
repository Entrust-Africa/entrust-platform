import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../app";
import { ServiceError } from "../services/errors";
import { loadPrincipal } from "../services/access";
import {
  checkSmeDuplicates,
  mergeSme,
  searchSmes,
} from "../services/sme-registry";

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

const checkDuplicateSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  registrationNumber: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().length(2).default("ET"),
  excludeOrganizationId: z.string().optional(),
});

const mergeSchema = z.object({
  targetSmeId: z.string().trim().min(1),
  reason: z.string().trim().min(1, "A reason is required to merge an SME."),
});

export const smes = new Hono<AppEnv>()
  .get("/smes/search", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const principal = await loadPrincipal(db, user.id);
    if (!principal.staffRole) {
      throw new ServiceError("forbidden", "Only Entrust staff can search the SME registry.");
    }

    const q = c.req.query("q") ?? "";
    const limitQuery = c.req.query("limit");
    const limit = limitQuery ? parseInt(limitQuery, 10) : 20;

    const results = await searchSmes(db, q, isNaN(limit) ? 20 : limit);
    return c.json({ smes: results });
  })
  .post(
    "/smes/check-duplicate",
    zValidator("json", checkDuplicateSchema, (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input.";
        return c.json({ error: message, code: "invalid" }, 400);
      }
    }),
    async (c) => {
      const body = c.req.valid("json");
      const db = getDb();
      const duplicateResult = await checkSmeDuplicates(db, {
        legalName: body.legalName,
        registrationNumber: body.registrationNumber,
        country: body.country,
        excludeOrganizationId: body.excludeOrganizationId,
      });

      if (duplicateResult.registrationNumberConflict) {
        return c.json({
          duplicate: true,
          conflict: "registration_number",
          message: `An organisation with registration number '${duplicateResult.registrationNumberConflict.registrationNumber}' already exists in ${duplicateResult.registrationNumberConflict.country}. Please ask the existing owner for an invitation.`,
          details: duplicateResult.registrationNumberConflict,
        });
      }

      if (duplicateResult.legalNameWarning) {
        return c.json({
          duplicate: true,
          warning: "legal_name",
          message: `An organisation with a similar name already exists ('${duplicateResult.legalNameWarning.legalName}'). Please confirm if this is a different organisation.`,
          details: duplicateResult.legalNameWarning,
        });
      }

      return c.json({ duplicate: false });
    },
  )
  .post(
    "/smes/:smeId/merge",
    zValidator("json", mergeSchema, (result, c) => {
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
      if (principal.staffRole !== "admin") {
        throw new ServiceError("forbidden", "Only Entrust admins can merge SMEs.");
      }

      const duplicateSmeId = c.req.param("smeId");
      const body = c.req.valid("json");

      const mergeResult = await mergeSme(
        db,
        user.id,
        duplicateSmeId,
        body.targetSmeId,
        body.reason,
      );

      return c.json(mergeResult);
    },
  );
