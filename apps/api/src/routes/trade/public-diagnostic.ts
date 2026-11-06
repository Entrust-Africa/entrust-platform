import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../../app";
import {
  exportPublicDiagnosticsCsv,
  getPublicDiagnostic,
  getPublicDiagnosticForStaff,
  hashAddress,
  listPublicDiagnostics,
  publicTemplate,
  savePublicDiagnostic,
  startPublicDiagnostic,
  submitPublicDiagnostic,
  templateForToken,
} from "../../services/trade-public-diagnostic";
import { contextFor } from "../clear/shared";

// The onboarding diagnostic without an account (#78). The first group is public: whoever holds a draft's private token
// may read, save and submit it, and nothing else. The second is for Entrust staff, who read and export the submissions.

const invalid = (result: { success: boolean; error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } }, c: Context) => {
  if (!result.success && result.error) {
    const issue = result.error.issues[0];
    return c.json({ error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input.", code: "invalid" }, 400);
  }
  return undefined;
};

const startBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  businessName: z.string().trim().max(200).optional(),
  // A trap for bots: a person never sees this field, so a form that fills it in is answered as if it worked and stored nowhere.
  website: z.string().max(500).optional(),
});

const saveBody = z.object({ answers: z.record(z.string().max(40), z.unknown().nullable()) });

const listQuery = z.object({
  status: z.enum(["draft", "submitted"]).optional(),
  q: z.string().trim().max(100).optional(),
});

const now = () => new Date();

/** Where the visitor came from, as Cloudflare reports it. Only a hash of it is kept. */
const addressOf = (header: (name: string) => string | undefined): string | undefined =>
  header("cf-connecting-ip") ?? header("x-forwarded-for")?.split(",")[0]?.trim();

export const tradePublicDiagnostic = new Hono<AppEnv>()
  // ---- Public ----
  .get("/public/diagnostic/template", (c) => c.json(publicTemplate()))
  .post("/public/diagnostic", zValidator("json", startBody, invalid), async (c) => {
    const body = c.req.valid("json");
    if (body.website) return c.json({ token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 12) }, 201);
    const addressHash = await hashAddress(addressOf((name) => c.req.header(name)));
    const started = await startPublicDiagnostic({ db: getDb(), now: now() }, { email: body.email, businessName: body.businessName, addressHash });
    return c.json(started, 201);
  })
  .get("/public/diagnostic/:token/template", async (c) => c.json(await templateForToken({ db: getDb(), now: now() }, c.req.param("token"))))
  .get("/public/diagnostic/:token", async (c) => c.json(await getPublicDiagnostic({ db: getDb(), now: now() }, c.req.param("token"))))
  .put("/public/diagnostic/:token/responses", zValidator("json", saveBody, invalid), async (c) =>
    c.json(await savePublicDiagnostic({ db: getDb(), now: now() }, c.req.param("token"), c.req.valid("json"))),
  )
  .post("/public/diagnostic/:token/submit", async (c) => c.json(await submitPublicDiagnostic({ db: getDb(), now: now() }, c.req.param("token"))))

  // ---- Entrust staff ----
  .get("/public-diagnostics", zValidator("query", listQuery, invalid), async (c) => c.json(await listPublicDiagnostics(await contextFor(c.get("user")), c.req.valid("query"))))
  .get("/public-diagnostics/export.csv", async (c) => {
    const csv = await exportPublicDiagnosticsCsv(await contextFor(c.get("user")));
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="onboarding-diagnostics-${now().toISOString().slice(0, 10)}.csv"`);
    return c.body("﻿" + csv);
  })
  .get("/public-diagnostics/:id", async (c) => c.json(await getPublicDiagnosticForStaff(await contextFor(c.get("user")), c.req.param("id"))));
