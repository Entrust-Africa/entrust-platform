import { count, desc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
import { PARTICIPANT_PASSES } from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type { RegistrationBody, RegistrationItem, RegistrationList, RegistrationQuery, RegistrationReceipt } from "../schemas/summit";
import { requireStaff, type Ctx } from "./access";

// Participant registrations (#79's public side): a visitor to the Summit page asks for a ticket tier. This records the
// request and acknowledges it by email; taking payment isn't part of it.

type Body = z.infer<typeof RegistrationBody>;
type Receipt = z.infer<typeof RegistrationReceipt>;
type Item = z.infer<typeof RegistrationItem>;
type List = z.infer<typeof RegistrationList>;
type Query = z.infer<typeof RegistrationQuery>;

const passName = (id: Body["pass"]): string => PARTICIPANT_PASSES.find((p) => p.id === id)?.name ?? id;

/** A repeat submission gets no second email inside this window, so the form can't be used to flood someone's inbox. */
const CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Records a registration. One row per email address: a second submission with the same address replaces the details and
 * the pass (the visitor fixing a mistake), and keeps the reference. The confirmation email goes to the address given, so
 * its owner sees any change made in their name. A form whose trap field is filled in is answered as if it worked and
 * stored nowhere.
 */
export async function register(ctx: Pick<Ctx, "db" | "now">, body: Body): Promise<Receipt> {
  if (body.website) return { number: "DTS-00000", pass: body.pass, passName: passName(body.pass) };

  const values = {
    email: body.email.toLowerCase(),
    fullName: body.fullName,
    phone: body.phone || null,
    organisation: body.organisation,
    jobTitle: body.jobTitle,
    country: body.country,
    pass: body.pass,
    notes: body.notes || null,
    consentedAt: ctx.now,
  };
  const [row] = await ctx.db
    .insert(schema.registration)
    .values(values)
    .onConflictDoUpdate({ target: schema.registration.email, set: values })
    .returning({ id: schema.registration.id, number: schema.registration.number, confirmationSentAt: schema.registration.confirmationSentAt });
  if (!row) throw new Error("The registration was not saved.");

  await confirm(ctx, row, values.email, body);
  return { number: row.number, pass: body.pass, passName: passName(body.pass) };
}

/** Queues the confirmation email. The registration stands if the queue is down: that is logged, not shown to the visitor. */
async function confirm(
  ctx: Pick<Ctx, "db" | "now">,
  row: { id: string; number: string; confirmationSentAt: Date | null },
  to: string,
  body: Body,
): Promise<void> {
  if (row.confirmationSentAt && ctx.now.getTime() - row.confirmationSentAt.getTime() < CONFIRMATION_WINDOW_MS) return;
  try {
    await enqueue(JOB_NAMES.SEND_EMAIL, {
      to,
      subject: "We have your registration for the Diaspora Trade Summit",
      template: "summit-registration",
      props: { fullName: body.fullName, passName: passName(body.pass), number: row.number },
    });
    await ctx.db.update(schema.registration).set({ confirmationSentAt: ctx.now }).where(eq(schema.registration.id, row.id));
  } catch (error) {
    console.error(`[summit] The confirmation email for ${row.number} could not be queued`, error);
  }
}

/** Registrations, newest first, for Entrust staff who run the Summit. */
export async function listRegistrations(ctx: Ctx, query: Query): Promise<List> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "list Summit registrations");
  const where = query.pass ? eq(schema.registration.pass, query.pass) : undefined;
  const [rows, [filtered], perPass] = await Promise.all([
    ctx.db.select().from(schema.registration).where(where).orderBy(desc(schema.registration.createdAt), desc(schema.registration.id)).limit(query.limit).offset(query.offset),
    ctx.db.select({ n: count() }).from(schema.registration).where(where),
    ctx.db.select({ pass: schema.registration.pass, n: count() }).from(schema.registration).groupBy(schema.registration.pass),
  ]);
  return {
    items: rows.map(toItem),
    total: filtered?.n ?? 0,
    byPass: Object.fromEntries(PARTICIPANT_PASSES.map((p) => [p.id, perPass.find((r) => r.pass === p.id)?.n ?? 0])),
  };
}

const toItem = (row: typeof schema.registration.$inferSelect): Item => ({
  id: row.id,
  number: row.number,
  email: row.email,
  fullName: row.fullName,
  phone: row.phone,
  organisation: row.organisation,
  jobTitle: row.jobTitle,
  country: row.country,
  pass: row.pass,
  notes: row.notes,
  consentedAt: row.consentedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
