import { randomBytes } from "node:crypto";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  SELECTED_SME_ELIGIBILITY,
  availability,
  badgeProblems,
  badgeState,
  parseBadgeCode,
  priceLabel,
  reportAnswers,
  type PaymentStatus,
} from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type {
  DelegateDetail,
  DelegateList,
  DelegatePatch,
  DelegateQuery,
  DelegateReceipt,
  DelegateRegistrationBody,
  PublicBadge,
  ReasonBody,
} from "../schemas/summit-commerce";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { currentEdition } from "./summit-commerce";
import { amountText, firstName, paymentParagraphs, sendNotice, siteUrl } from "./summit-commerce-mail";
import { cancelOpenPayment, openPayment, paymentOf, paymentView } from "./summit-commerce-payments";
import { approvedFinalList } from "./summit-final-list";
import { templateOf } from "./summit-applications";
import { recordSummitChange } from "./summit-status";

// Delegate registration (section 8): a visitor picks a category and registers; a paid category's badge becomes valid once an
// administrator verifies the payment, and a selected SME registers free against its assessment application. Administrators
// verify badges at the door.

type DelegateRow = typeof schema.delegateRegistration.$inferSelect;
type Detail = z.infer<typeof DelegateDetail>;
type List = z.infer<typeof DelegateList>;
type Receipt = z.infer<typeof DelegateReceipt>;

const CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const newToken = (): string => randomBytes(18).toString("base64url");

function requireHandler(ctx: Ctx, doing: string): void {
  requireStaff(ctx.principal, ["admin", "facilitator"], doing);
}

/** The badge's web address, which is also what its QR code holds. */
const badgeUrl = (token: string): string => siteUrl(`/badge/${token}`);

// ---- Selected SMEs ----

interface SelectedSme {
  applicationId: string;
  businessName: string;
  country: string | null;
  sector: string | null;
}

/**
 * Finds the selected SME an application number and an email address stand for. Every reason it can fail gives the same
 * answer, so the form can't be used to find out which applications exist or which businesses were selected. The email must
 * be an account of a member of the applicant's organisation: the badge goes to it, so only the business receives it.
 */
async function findSelectedSme(db: Executor, edition: typeof schema.commerceEdition.$inferSelect, applicationNumber: string, email: string): Promise<SelectedSme> {
  const refused = new ServiceError("invalid", "We couldn't match that application number and email address to a selected SME. Check both, or contact the ADTIS secretariat.");
  if (!edition.applicationPeriodId) throw refused;
  const [found] = await db
    .select({ row: schema.application, businessName: schema.organization.name, country: schema.smeProfile.country })
    .from(schema.application)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.application.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.application.organizationId))
    .where(and(eq(schema.application.number, applicationNumber), eq(schema.application.periodId, edition.applicationPeriodId)));
  if (!found || found.row.status !== "selected") throw refused;
  // A decision of the committee stands only once the final list is approved.
  if (!(await approvedFinalList(db, found.row.periodId))) throw refused;
  const [member] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(and(eq(schema.member.organizationId, found.row.organizationId), sql`lower(${schema.user.email}) = ${email}`));
  if (!member) throw refused;
  const template = templateOf(found.row.templateVersion);
  return {
    applicationId: found.row.id,
    businessName: found.businessName,
    country: found.country,
    sector: reportAnswers(template, found.row.answers).text("sector"),
  };
}

// ---- The public registration ----

/**
 * Registers a delegate. One live registration per email address and edition: registering again changes the details (and
 * the category, while nothing has been paid or recorded), and a paid registration is left as it is. A selected SME registers
 * free with its application number and doesn't fill in a second application: its business, country and sector come from the
 * assessment. A form whose trap field is filled in is answered as if it worked and stored nowhere.
 */
export async function registerDelegate(ctx: Pick<Ctx, "db" | "now">, body: z.infer<typeof DelegateRegistrationBody>): Promise<Receipt> {
  if (body.nickname) return { number: "DEL-00000", categoryName: "", price: "", paymentRequired: false, alreadyRegistered: false };

  const edition = await currentEdition(ctx.db);
  if (!edition) throw new ServiceError("not_found", "Registration is not open yet.");
  const [product] = await ctx.db
    .select()
    .from(schema.commerceProduct)
    .where(
      and(
        eq(schema.commerceProduct.editionId, edition.id),
        eq(schema.commerceProduct.slug, body.categorySlug),
        eq(schema.commerceProduct.kind, "delegate_category"),
        eq(schema.commerceProduct.status, "published"),
      ),
    );
  if (!product) throw new ServiceError("not_found", "That delegate category doesn't exist.");

  const email = body.email.toLowerCase();
  const forSelectedSme = product.attributes.eligibility === SELECTED_SME_ELIGIBILITY;
  let sme: SelectedSme | null = null;
  if (forSelectedSme) {
    if (!body.applicationNumber) throw new ServiceError("invalid", "A selected SME registers with its application number, like SUM-000123.");
    sme = await findSelectedSme(ctx.db, edition, body.applicationNumber, email);
  }
  const organisation = sme?.businessName ?? body.organisation;
  const country = sme?.country ?? body.country;
  if (!organisation) throw new ServiceError("invalid", "Please give your organisation.");
  if (!country) throw new ServiceError("invalid", "Please give your country.");

  const result = await ctx.db.transaction(async (tx) => {
    // The category row is locked, so the last places can't be taken twice.
    await tx.select({ id: schema.commerceProduct.id }).from(schema.commerceProduct).where(eq(schema.commerceProduct.id, product.id)).for("update");
    const [existing] = await tx
      .select()
      .from(schema.delegateRegistration)
      .where(and(eq(schema.delegateRegistration.editionId, edition.id), eq(schema.delegateRegistration.email, email), eq(schema.delegateRegistration.status, "registered")))
      .for("update");
    const existingPayment = existing ? await paymentOf(tx, "delegate", existing.id) : undefined;
    const settled = existingPayment !== undefined && existingPayment.status !== "pending";

    // Places: a registration that stays in its category takes no new place.
    const sameCategory = existing?.productId === product.id;
    if (!sameCategory) {
      const [{ n: taken = 0 } = {}] = await tx
        .select({ n: count() })
        .from(schema.delegateRegistration)
        .where(and(eq(schema.delegateRegistration.productId, product.id), eq(schema.delegateRegistration.status, "registered")));
      if (availability({ capacity: product.capacity, taken, markedSoldOut: product.markedSoldOut }).soldOut) {
        throw new ServiceError("precondition_failed", `${product.name} is sold out. Please choose another category or contact the ADTIS secretariat.`);
      }
    }
    // A selected SME's own registration can always change its details; the allowance counts the registrations it already holds.
    if (sme && existing?.applicationId !== sme.applicationId) {
      const [{ n: used = 0 } = {}] = await tx
        .select({ n: count() })
        .from(schema.delegateRegistration)
        .where(
          and(
            eq(schema.delegateRegistration.applicationId, sme.applicationId),
            eq(schema.delegateRegistration.status, "registered"),
          ),
        );
      if (used >= edition.complimentaryPerSme) {
        throw new ServiceError("precondition_failed", "This business has already used its complimentary registration. Others from the business can register as general business delegates.");
      }
    }

    const details = {
      fullName: body.fullName,
      phone: body.phone || null,
      organisation,
      jobTitle: body.jobTitle,
      country,
      sector: sme?.sector ?? (body.sector || null),
      needs: body.needs || null,
      consentedAt: ctx.now,
    };
    if (existing) {
      // A verified payment is final: a repeat from the public form changes nothing, so the name on a paid badge can't be rewritten.
      if (existingPayment?.status === "confirmed") return { row: existing, created: false, alreadyPaid: true };
      // A payment with a reference recorded keeps its category and amount; only contact details change.
      if (settled || sameCategory) {
        const [updated] = await tx.update(schema.delegateRegistration).set(details).where(eq(schema.delegateRegistration.id, existing.id)).returning();
        return { row: updated ?? existing, created: false, alreadyPaid: false };
      }
      const [updated] = await tx
        .update(schema.delegateRegistration)
        .set({ ...details, productId: product.id, amountCents: product.priceCents, applicationId: sme?.applicationId ?? null })
        .where(eq(schema.delegateRegistration.id, existing.id))
        .returning();
      if (!updated) throw new Error("The registration was not saved.");
      await tx.update(schema.commercePayment).set({ amountDueCents: product.priceCents }).where(eq(schema.commercePayment.id, existingPayment!.id));
      if (product.priceCents === 0) await completeComplimentary(tx, updated, sme);
      return { row: updated, created: false, alreadyPaid: false };
    }

    const [created] = await tx
      .insert(schema.delegateRegistration)
      .values({ ...details, editionId: edition.id, productId: product.id, email, amountCents: product.priceCents, applicationId: sme?.applicationId ?? null, badgeToken: newToken() })
      .returning();
    if (!created) throw new Error("The registration was not saved.");
    await openPayment(tx, { editionId: edition.id, subjectType: "delegate", subjectId: created.id, amountDueCents: product.priceCents });
    if (product.priceCents === 0) await completeComplimentary(tx, created, sme);
    await recordSummitChange(tx, null, {
      action: "summit.commerce.delegate.registered",
      entityType: "delegate_registration",
      entityId: created.id,
      organizationId: null,
      after: { number: created.number, category: product.slug, organisation, country, amountCents: created.amountCents, selectedSme: sme !== null },
    });
    return { row: created, created: true, alreadyPaid: false };
  });

  // A registration that kept its category (a payment is already recorded) is described by the category it holds.
  const held = result.row.productId === product.id ? product.name : await categoryName(ctx.db, result.row.productId);
  if (!result.alreadyPaid) await confirmationEmail(ctx, result.row, held, edition.paymentMethods, edition.taxNote);
  return {
    number: result.row.number,
    categoryName: held,
    price: priceLabel(result.row.amountCents),
    paymentRequired: result.row.amountCents > 0,
    alreadyRegistered: result.alreadyPaid,
  };
}

async function categoryName(db: Executor, productId: string): Promise<string> {
  const [row] = await db.select({ name: schema.commerceProduct.name }).from(schema.commerceProduct).where(eq(schema.commerceProduct.id, productId));
  return row?.name ?? "delegate";
}

/** Nothing is owed, so there is no payment to verify: the payment is recorded as settled by the complimentary registration. */
async function completeComplimentary(db: Executor, delegate: DelegateRow, sme: SelectedSme | null): Promise<void> {
  await db
    .update(schema.commercePayment)
    .set({
      status: "confirmed",
      amountReceivedCents: 0,
      method: "complimentary",
      note: sme ? `Complimentary: selected SME ${sme.businessName}` : "Complimentary category",
      verifiedAt: new Date(),
    })
    .where(and(eq(schema.commercePayment.subjectType, "delegate"), eq(schema.commercePayment.subjectId, delegate.id)));
}

async function confirmationEmail(
  ctx: Pick<Ctx, "db" | "now">,
  row: DelegateRow,
  categoryName: string,
  methods: Parameters<typeof paymentParagraphs>[0],
  taxNote: string,
): Promise<void> {
  if (row.confirmationSentAt && ctx.now.getTime() - row.confirmationSentAt.getTime() < CONFIRMATION_WINDOW_MS) return;
  const free = row.amountCents === 0;
  const queued = await sendNotice({
    to: row.email,
    subject: `Your ADTIS registration ${row.number}`,
    heading: free ? "You are registered" : "We have your registration",
    greeting: `Hello ${firstName(row.fullName)},`,
    paragraphs: free
      ? [`Thank you for registering for the Africa Diaspora Trade & Investment Summit as a ${categoryName}. Your complimentary registration is confirmed. Your badge is below: show it on your phone, or print it, when you arrive.`]
      : [
          `Thank you for registering for the Africa Diaspora Trade & Investment Summit as a ${categoryName}.`,
          ...paymentParagraphs(methods, row.number),
          "Your badge becomes valid once your payment has been verified. You can open it now and come back to it later.",
          taxNote,
        ],
    details: [
      { label: "Reference", value: row.number },
      { label: "Category", value: categoryName },
      { label: "Amount due", value: free ? "Complimentary" : `${amountText(row.amountCents)} (USD)` },
    ],
    action: { label: "Open your badge", url: badgeUrl(row.badgeToken) },
  });
  if (queued) await ctx.db.update(schema.delegateRegistration).set({ confirmationSentAt: ctx.now }).where(eq(schema.delegateRegistration.id, row.id));
}

// ---- The badge ----

/** What the badge page shows, from the token in its address. A token that doesn't exist looks like any other wrong address. */
export async function publicBadge(ctx: Pick<Ctx, "db">, token: string): Promise<z.infer<typeof PublicBadge>> {
  const [found] = await ctx.db
    .select({ row: schema.delegateRegistration, category: schema.commerceProduct.name, edition: schema.commerceEdition })
    .from(schema.delegateRegistration)
    .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, schema.delegateRegistration.productId))
    .innerJoin(schema.commerceEdition, eq(schema.commerceEdition.id, schema.delegateRegistration.editionId))
    .where(eq(schema.delegateRegistration.badgeToken, token));
  if (!found) throw new ServiceError("not_found", "No such badge.");
  const payment = await paymentOf(ctx.db, "delegate", found.row.id);
  const [problem] = badgeProblems(found.row, payment?.status ?? null);
  return {
    number: found.row.number,
    fullName: found.row.fullName,
    organisation: found.row.organisation,
    country: found.row.country,
    category: found.category,
    edition: { name: found.edition.name, venue: found.edition.venue, datesNote: found.edition.datesNote },
    valid: problem === undefined,
    reason: problem ?? null,
    url: badgeUrl(token),
  };
}

// ---- Administrators ----

const itemFields = {
  id: schema.delegateRegistration.id,
  number: schema.delegateRegistration.number,
  status: schema.delegateRegistration.status,
  productId: schema.delegateRegistration.productId,
  categoryName: schema.commerceProduct.name,
  fullName: schema.delegateRegistration.fullName,
  email: schema.delegateRegistration.email,
  organisation: schema.delegateRegistration.organisation,
  country: schema.delegateRegistration.country,
  sector: schema.delegateRegistration.sector,
  amountCents: schema.delegateRegistration.amountCents,
  paymentStatus: schema.commercePayment.status,
  applicationId: schema.delegateRegistration.applicationId,
  checkedInAt: schema.delegateRegistration.checkedInAt,
  createdAt: schema.delegateRegistration.createdAt,
};

const joined = (db: Executor) =>
  db
    .select(itemFields)
    .from(schema.delegateRegistration)
    .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, schema.delegateRegistration.productId))
    .leftJoin(schema.commercePayment, and(eq(schema.commercePayment.subjectType, sql`'delegate'`), eq(schema.commercePayment.subjectId, schema.delegateRegistration.id)));

const toItem = ({ applicationId, ...row }: Awaited<ReturnType<typeof joined>>[number]) => ({
  ...row,
  selectedSme: applicationId !== null,
  checkedInAt: row.checkedInAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export async function listDelegates(ctx: Ctx, query: z.infer<typeof DelegateQuery>): Promise<List> {
  requireHandler(ctx, "list delegates");
  const editionId = query.editionId ?? (await currentEdition(ctx.db))?.id;
  const empty = { registered: 0, cancelled: 0, paymentConfirmed: 0, paymentPending: 0, checkedIn: 0 };
  if (!editionId) return { items: [], total: 0, totals: empty };
  const search = query.q ? `%${query.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
  const where = and(
    eq(schema.delegateRegistration.editionId, editionId),
    query.status ? eq(schema.delegateRegistration.status, query.status) : undefined,
    query.productId ? eq(schema.delegateRegistration.productId, query.productId) : undefined,
    query.paymentStatus ? eq(schema.commercePayment.status, query.paymentStatus) : undefined,
    query.checkedIn === "true" ? sql`${schema.delegateRegistration.checkedInAt} is not null` : undefined,
    query.checkedIn === "false" ? sql`${schema.delegateRegistration.checkedInAt} is null` : undefined,
    query.country ? eq(schema.delegateRegistration.country, query.country) : undefined,
    search
      ? or(
          ilike(schema.delegateRegistration.fullName, search),
          ilike(schema.delegateRegistration.organisation, search),
          ilike(schema.delegateRegistration.email, search),
          ilike(schema.delegateRegistration.number, search),
        )
      : undefined,
  );
  const [rows, [filtered], [totals]] = await Promise.all([
    joined(ctx.db).where(where).orderBy(desc(schema.delegateRegistration.createdAt), desc(schema.delegateRegistration.id)).limit(query.limit).offset(query.offset),
    ctx.db
      .select({ n: count() })
      .from(schema.delegateRegistration)
      .leftJoin(schema.commercePayment, and(eq(schema.commercePayment.subjectType, sql`'delegate'`), eq(schema.commercePayment.subjectId, schema.delegateRegistration.id)))
      .where(where),
    ctx.db
      .select({
        registered: sql<number>`count(*) filter (where ${schema.delegateRegistration.status} = 'registered')::int`,
        cancelled: sql<number>`count(*) filter (where ${schema.delegateRegistration.status} = 'cancelled')::int`,
        paymentConfirmed: sql<number>`count(*) filter (where ${schema.delegateRegistration.status} = 'registered' and ${schema.commercePayment.status} = 'confirmed')::int`,
        paymentPending: sql<number>`count(*) filter (where ${schema.delegateRegistration.status} = 'registered' and ${schema.commercePayment.status} in ('pending', 'awaiting_verification'))::int`,
        checkedIn: sql<number>`count(*) filter (where ${schema.delegateRegistration.checkedInAt} is not null)::int`,
      })
      .from(schema.delegateRegistration)
      .leftJoin(schema.commercePayment, and(eq(schema.commercePayment.subjectType, sql`'delegate'`), eq(schema.commercePayment.subjectId, schema.delegateRegistration.id)))
      .where(eq(schema.delegateRegistration.editionId, editionId)),
  ]);
  return { items: rows.map(toItem), total: filtered?.n ?? 0, totals: totals ?? empty };
}

async function loadDelegate(db: Executor, id: string, lock = false): Promise<DelegateRow> {
  const query = db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.id, id));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw new ServiceError("not_found", "No such delegate registration.");
  return row;
}

async function detail(db: Executor, row: DelegateRow): Promise<Detail> {
  const [[item], paymentRow, application, [checker]] = await Promise.all([
    joined(db).where(eq(schema.delegateRegistration.id, row.id)),
    paymentOf(db, "delegate", row.id),
    row.applicationId
      ? db.select({ id: schema.application.id, number: schema.application.number }).from(schema.application).where(eq(schema.application.id, row.applicationId))
      : Promise.resolve([]),
    row.checkedInBy ? db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, row.checkedInBy)) : Promise.resolve([]),
  ]);
  if (!item) throw new Error("A registration lost its category.");
  const payment: PaymentStatus | null = paymentRow?.status ?? null;
  return {
    ...toItem(item),
    phone: row.phone,
    jobTitle: row.jobTitle,
    needs: row.needs,
    application: application[0] ?? null,
    payment: paymentRow ? await paymentView(db, paymentRow) : null,
    badge: { state: badgeState(row, payment), problems: badgeProblems(row, payment), url: badgeUrl(row.badgeToken) },
    checkedInBy: checker ?? null,
  };
}

export async function getDelegate(ctx: Ctx, id: string): Promise<Detail> {
  requireHandler(ctx, "see a delegate registration");
  return detail(ctx.db, await loadDelegate(ctx.db, id));
}

/** Corrects a delegate's details (a misspelt name on the badge, say). The email, category and price don't change here. */
export async function updateDelegate(ctx: Ctx, id: string, patch: z.infer<typeof DelegatePatch>): Promise<Detail> {
  requireHandler(ctx, "correct a delegate registration");
  const row = await ctx.db.transaction(async (tx) => {
    const current = await loadDelegate(tx, id, true);
    const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<typeof schema.delegateRegistration.$inferInsert>;
    const changed = Object.entries(set).filter(([key, value]) => (current as Record<string, unknown>)[key] !== value);
    if (changed.length === 0) return current;
    const [updated] = await tx.update(schema.delegateRegistration).set(set).where(eq(schema.delegateRegistration.id, id)).returning();
    if (!updated) throw new Error("The registration was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.delegate.updated",
      entityType: "delegate_registration",
      entityId: id,
      organizationId: null,
      before: Object.fromEntries(changed.map(([key]) => [key, (current as Record<string, unknown>)[key]])),
      after: Object.fromEntries(changed),
    });
    return updated;
  });
  return detail(ctx.db, row);
}

/** Cancels a registration: its badge stops being valid and an unpaid payment is cancelled. A verified payment is left for a person to refund. */
export async function cancelDelegate(ctx: Ctx, id: string, body: z.infer<typeof ReasonBody>): Promise<Detail> {
  requireHandler(ctx, "cancel a registration");
  const row = await ctx.db.transaction(async (tx) => {
    const current = await loadDelegate(tx, id, true);
    if (current.status === "cancelled") throw new ServiceError("invalid_transition", "This registration is already cancelled.");
    if (current.checkedInAt) throw new ServiceError("invalid_transition", "This delegate has already checked in.");
    const [updated] = await tx.update(schema.delegateRegistration).set({ status: "cancelled" }).where(eq(schema.delegateRegistration.id, id)).returning();
    if (!updated) throw new Error("The registration was not saved.");
    await cancelOpenPayment(tx, "delegate", id);
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.delegate.cancelled",
      entityType: "delegate_registration",
      entityId: id,
      organizationId: null,
      before: { status: current.status },
      after: { status: "cancelled" },
      reason: body.reason,
    });
    return updated;
  });
  return detail(ctx.db, row);
}

/** Sends the confirmation (with the badge link) again, for a delegate who lost it. */
export async function resendConfirmation(ctx: Ctx, id: string): Promise<Detail> {
  requireHandler(ctx, "resend a confirmation");
  const row = await loadDelegate(ctx.db, id);
  if (row.status !== "registered") throw new ServiceError("invalid_transition", "This registration is cancelled.");
  const [found] = await ctx.db
    .select({ category: schema.commerceProduct.name, edition: schema.commerceEdition })
    .from(schema.commerceProduct)
    .innerJoin(schema.commerceEdition, eq(schema.commerceEdition.id, schema.commerceProduct.editionId))
    .where(eq(schema.commerceProduct.id, row.productId));
  if (!found) throw new Error("A registration lost its category.");
  await confirmationEmail({ db: ctx.db, now: new Date(ctx.now.getTime() + CONFIRMATION_WINDOW_MS) }, row, found.category, found.edition.paymentMethods, found.edition.taxNote);
  return detail(ctx.db, row);
}

// ---- The door ----

/** Finds a delegate from what a scanner or a desk typed: the badge's address, its token, or the registration reference. */
export async function lookupDelegate(ctx: Ctx, code: string): Promise<Detail> {
  requireHandler(ctx, "check delegates in");
  const parsed = parseBadgeCode(code);
  if (!parsed) throw new ServiceError("invalid", "That isn't a badge address or registration reference.");
  const [row] = await ctx.db
    .select()
    .from(schema.delegateRegistration)
    .where("token" in parsed ? eq(schema.delegateRegistration.badgeToken, parsed.token) : eq(schema.delegateRegistration.number, parsed.number));
  if (!row) throw new ServiceError("not_found", "No registration matches that badge.");
  return detail(ctx.db, row);
}

/**
 * Marks a delegate as arrived. Refused for a cancelled registration or one whose payment is not verified, with the reasons,
 * and for a badge already used, with when.
 */
export async function checkIn(ctx: Ctx, id: string): Promise<Detail> {
  requireHandler(ctx, "check delegates in");
  const row = await ctx.db.transaction(async (tx) => {
    const current = await loadDelegate(tx, id, true);
    const payment = await paymentOf(tx, "delegate", id);
    const problems = badgeProblems(current, payment?.status ?? null);
    if (problems.length) throw new ServiceError("precondition_failed", problems.join(" "));
    if (current.checkedInAt) {
      throw new ServiceError("invalid_transition", `${current.fullName} checked in at ${current.checkedInAt.toISOString()}.`);
    }
    const [updated] = await tx
      .update(schema.delegateRegistration)
      .set({ checkedInAt: ctx.now, checkedInBy: ctx.principal.userId })
      .where(and(eq(schema.delegateRegistration.id, id), inArray(schema.delegateRegistration.status, ["registered"])))
      .returning();
    if (!updated) throw new Error("The check-in was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.delegate.checked_in",
      entityType: "delegate_registration",
      entityId: id,
      organizationId: null,
      after: { number: updated.number, at: ctx.now.toISOString() },
    });
    return updated;
  });
  return detail(ctx.db, row);
}
