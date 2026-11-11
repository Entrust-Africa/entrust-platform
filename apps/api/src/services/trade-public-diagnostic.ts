import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { ensureAfriConnectAccount, type EnsureAccountResult } from "@entrust/auth";
import { schema } from "@entrust/db";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
import { NOT_KNOWN, checkAnswers, isNotKnown, type FormDefinition, type FormQuestion } from "@entrust/forms";
import { PATHWAY_NAMES, assignPathwayFromDiagnostic, tradeToday } from "@entrust/trade-engine";
import { findDiagnosticTemplate, findTradeRules, latestDiagnosticTemplate, latestTradeRules } from "@entrust/trade-rules";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { requireStaff as requireRole, type Ctx, type Principal } from "./access";

// The onboarding diagnostic (#78) filled in without an account. Entrust shares one public link; each visitor starts a draft
// that only they can reach, by a private link (the row keeps a hash of its token), and submits it. Nothing here needs a
// sign-in. Staff read the submissions, match each to a business when they enrol it, and export them.

type Row = typeof schema.publicDiagnostic.$inferSelect;
type Writer = Pick<Ctx, "db" | "now">;

/** The country the diagnostic's wording names ("outside {country}"). The first cohort is Ethiopian. */
const VARIABLES = { country: "Ethiopia" } as const;

/** How many drafts one address, or one email, may start in an hour. */
const STARTS_PER_ADDRESS_PER_HOUR = 20;
const STARTS_PER_EMAIL_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
/** The most answers one save may carry: the form has fewer than 200 questions. */
const MAX_ANSWERS_PER_SAVE = 400;

/** Administrators and facilitators read the submissions, to enrol businesses. A reviewer works from the cohorts they're on. */
const requireStaff = (principal: Principal): void => requireRole(principal, ["admin", "facilitator"], "read the onboarding diagnostics");

/** Today in Addis Ababa: a business filling the form in at 01:00 there is already on the new day, while UTC isn't. */
const todayOf = (now: Date): string => tradeToday(now);

const problemsText = (problems: readonly string[]): string =>
  problems.slice(0, 5).join("; ") + (problems.length > 5 ? `; and ${problems.length - 5} more` : "");

// ---- Tokens ----

const toBase64Url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** The private link's token: 32 random bytes. Only its hash is stored. */
export function newToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toBase64Url(new Uint8Array(digest));
}

/** A hash of the visitor's address, kept only to limit how many forms one address starts. */
export async function hashAddress(address: string | null | undefined): Promise<string | null> {
  if (!address) return null;
  return hashToken(`address:${address}`);
}

async function byToken(db: Executor, token: string, options: { lock?: boolean } = {}): Promise<Row> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) throw new ServiceError("not_found", "This link isn't right. Open the link from your email, or start again.");
  const query = db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.tokenHash, await hashToken(token)));
  const [row] = await (options.lock ? query.for("update") : query);
  if (!row) throw new ServiceError("not_found", "This link isn't right. Open the link from your email, or start again.");
  return row;
}

function templateOf(row: Pick<Row, "templateVersion">) {
  const template = findDiagnosticTemplate(row.templateVersion);
  if (!template) throw new Error(`The diagnostic template ${row.templateVersion} is missing`);
  return template;
}

// ---- The form ----

/** The form to show: the newest version of the diagnostic. */
export function publicTemplate() {
  const template = latestDiagnosticTemplate();
  return { kind: "diagnostic" as const, version: template.version, form: template as FormDefinition, variables: { ...VARIABLES } };
}

// ---- Starting ----

export interface StartInput {
  email: string;
  businessName: string;
  phone: string;
  /** A hash of the visitor's address, if known. */
  addressHash?: string | null | undefined;
}

/**
 * The first answers of section 1, from the three details given to start: the business's name, its email and its phone
 * number. They are only a start: the person can change them, and the form still checks them like any answer. A question
 * is found by its wording, so a later version of the form that renumbers them still works.
 */
function startingAnswers(template: { questions: readonly FormQuestion[] }, input: { email: string; businessName: string; phone: string }): Record<string, unknown> {
  const find = (pattern: RegExp) => template.questions.find((q) => q.type === "short_text" && pattern.test(q.text));
  const answers: Record<string, unknown> = {};
  const set = (question: FormQuestion | undefined, value: string) => {
    if (question && value) answers[question.id] = value;
  };
  set(find(/registered business name/i), input.businessName);
  set(find(/business email address/i), input.email);
  set(find(/business telephone number/i), input.phone);
  return answers;
}

function linkOf(token: string, proof?: string): string {
  const base = (process.env.TRADE_APP_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  return `${base}/onboarding/${token}${proof ? `?proof=${proof}` : ""}`;
}

/**
 * Starts a draft and returns its private token. The link is emailed too, so the visitor can come back from another
 * device. One address and one email can only start so many drafts an hour, which keeps the form from flooding an inbox.
 */
export async function startPublicDiagnostic(ctx: Writer, input: StartInput): Promise<{ token: string }> {
  const email = input.email.trim().toLowerCase();
  const since = new Date(ctx.now.getTime() - HOUR_MS);
  const [perEmail] = await ctx.db
    .select({ n: count() })
    .from(schema.publicDiagnostic)
    .where(and(eq(schema.publicDiagnostic.email, email), gt(schema.publicDiagnostic.createdAt, since)));
  if ((perEmail?.n ?? 0) >= STARTS_PER_EMAIL_PER_HOUR) {
    throw new ServiceError("rate_limited", "That email address has started a few forms already. Use the link we sent you, or try again in an hour.");
  }
  if (input.addressHash) {
    const [perAddress] = await ctx.db
      .select({ n: count() })
      .from(schema.publicDiagnostic)
      .where(and(eq(schema.publicDiagnostic.ipHash, input.addressHash), gt(schema.publicDiagnostic.createdAt, since)));
    if ((perAddress?.n ?? 0) >= STARTS_PER_ADDRESS_PER_HOUR) {
      throw new ServiceError("rate_limited", "Too many forms were started from this connection. Try again in an hour.");
    }
  }

  const token = newToken();
  // Only the emailed copy of the link carries this, so opening that copy proves the visitor reads the address's mail.
  const proof = newToken();
  const template = latestDiagnosticTemplate();
  const [row] = await ctx.db
    .insert(schema.publicDiagnostic)
    .values({
      tokenHash: await hashToken(token),
      email,
      businessName: input.businessName.trim(),
      phone: input.phone.trim(),
      templateVersion: template.version,
      answers: startingAnswers(template, { email, businessName: input.businessName.trim(), phone: input.phone.trim() }),
      ipHash: input.addressHash ?? null,
      emailProofHash: await hashToken(proof),
    })
    .returning({ id: schema.publicDiagnostic.id });
  if (!row) throw new Error("The diagnostic was not started.");

  // The form stands if the queue is down: that is logged, and the visitor already has the link on screen.
  try {
    await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: email,
      subject: "Your TRADE onboarding diagnostic",
      template: "summit-notice",
      props: {
        heading: "Your onboarding diagnostic",
        greeting: `Hello ${input.businessName.trim()},`,
        paragraphs: [
          "Thank you for starting the Entrust TRADE onboarding diagnostic. This is your private link. Your answers save as you go, so you can stop and carry on from this link whenever you like, on any device.",
          "Please don't forward it: anyone with the link can read and change your answers.",
        ],
        action: { label: "Continue the diagnostic", url: linkOf(token, proof) },
      },
    });
    await ctx.db.update(schema.publicDiagnostic).set({ linkEmailedAt: ctx.now }).where(eq(schema.publicDiagnostic.id, row.id));
  } catch (error) {
    console.error(`[trade] The diagnostic link for ${row.id} could not be queued`, error);
  }
  return { token };
}

// ---- The visitor's view ----

export interface PublicDiagnosticView {
  status: Row["status"];
  templateVersion: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  submittedAt: string | null;
  /** Whether the visitor has opened the link from their email, which proves the address is theirs. */
  emailVerified: boolean;
  variables: Record<string, string>;
  answers: Record<string, unknown>;
  progress: { total: number; answered: number; percent: number; bySection: Record<string, { answered: number; total: number }> };
  errors: string[];
  incomplete: string[];
  pathway: ReturnType<typeof pathwayOf>;
}

function pathwayOf(row: Row) {
  if (row.status !== "submitted" || !row.pathway) return null;
  const rules = row.rulesVersion ? findTradeRules(row.rulesVersion) : undefined;
  const texts = new Map((rules?.reasonCodes ?? []).map((c) => [c.code as string, c.text]));
  return {
    pathway: row.pathway,
    name: PATHWAY_NAMES[row.pathway],
    status: row.pathwayProvisional ? ("provisional" as const) : ("confirmed" as const),
    liveOrder: row.liveOrder ?? false,
    reasons: (row.reasonCodes ?? []).map((code) => texts.get(code)).filter((t): t is string => !!t),
  };
}

function answersOf(row: Pick<Row, "answers">): Record<string, never> {
  return (row.answers ?? {}) as Record<string, never>;
}

function viewOf(row: Row, now: Date): PublicDiagnosticView {
  const check = checkAnswers(templateOf(row), answersOf(row), { today: todayOf(now) });
  return {
    status: row.status,
    templateVersion: row.templateVersion,
    email: row.email,
    phone: row.phone,
    businessName: row.businessName,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    emailVerified: row.emailVerifiedAt !== null,
    variables: { ...VARIABLES },
    answers: row.answers ?? {},
    progress: { ...check.progress, bySection: { ...check.progress.bySection } },
    errors: check.errors.map((e) => e.message),
    incomplete: check.incomplete.map((e) => e.message),
    pathway: pathwayOf(row),
  };
}

export async function getPublicDiagnostic(ctx: Writer, token: string): Promise<PublicDiagnosticView> {
  return viewOf(await byToken(ctx.db, token), ctx.now);
}

/** Two equal-length strings compared without an early exit. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The visitor confirmed their email from the link we sent (a button on that page, not the page load, so a mail
 * scanner opening the link proves nothing): the address is theirs. From now on they have an account, on AfriConnect
 * and on Entrust (`ensureAccount`), with no password until they first sign in, and the draft records which Entrust
 * user it is.
 *
 * The draft's private link changes at that moment and the new one is emailed, so whoever started the draft with
 * this address (perhaps not its owner) can no longer read or change it. The new token comes back as `token`.
 *
 * A wrong or spent proof changes nothing and says nothing. The account is made once, after the row is saved; if
 * AfriConnect is down or the accounts disagree, that is logged and left to scripts/link-africonnect-accounts.ts,
 * so a token holder cannot make the API call AfriConnect again and again.
 */
export async function verifyPublicDiagnosticEmail(
  ctx: Writer,
  token: string,
  proof: string,
  ensureAccount: (person: { email: string }) => Promise<EnsureAccountResult> = ensureAfriConnectAccount,
): Promise<PublicDiagnosticView & { token?: string }> {
  const next = newToken();
  const confirmed = await ctx.db.transaction(async (tx) => {
    const current = await byToken(tx, token, { lock: true });
    if (current.emailVerifiedAt || !current.emailProofHash) return { row: current, now: false };
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(proof) || !sameText(await hashToken(proof), current.emailProofHash)) {
      return { row: current, now: false };
    }
    const [saved] = await tx
      .update(schema.publicDiagnostic)
      .set({ emailVerifiedAt: ctx.now, emailProofHash: null, tokenHash: await hashToken(next) })
      .where(eq(schema.publicDiagnostic.id, current.id))
      .returning();
    return { row: saved ?? current, now: true };
  });
  if (!confirmed.now) return viewOf(confirmed.row, ctx.now);
  let row = confirmed.row;

  try {
    await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: row.email,
      subject: "Your email is confirmed",
      template: "summit-notice",
      props: {
        heading: "Your email is confirmed",
        greeting: row.businessName ? `Hello ${row.businessName},` : "Hello,",
        paragraphs: [
          "Thank you for confirming your email. This is your private link to the onboarding diagnostic from now on; the earlier one no longer works.",
          "Please don't forward it: anyone with the link can read and change your answers.",
        ],
        action: { label: "Continue the diagnostic", url: linkOf(next) },
      },
    });
  } catch (error) {
    console.error(`[trade] The new diagnostic link for ${row.id} could not be queued`, error);
  }

  try {
    const result = await ensureAccount({ email: row.email });
    if (result.status === "linked") {
      const [linked] = await ctx.db
        .update(schema.publicDiagnostic)
        .set({ userId: result.userId })
        .where(eq(schema.publicDiagnostic.id, row.id))
        .returning();
      row = linked ?? row;
    } else if (result.status !== "disabled") {
      console.warn(`[trade] No account was made for diagnostic ${row.id}: ${result.status} (${"reason" in result ? result.reason : ""})`);
    }
  } catch (error) {
    console.error(`[trade] No account was made for diagnostic ${row.id}`, error);
  }
  return { ...viewOf(row, ctx.now), token: next };
}

/** The template the visitor's draft was started against, which may be older than the newest. */
export async function templateForToken(ctx: Writer, token: string) {
  const row = await byToken(ctx.db, token);
  const template = templateOf(row);
  return { kind: "diagnostic" as const, version: template.version, form: template as FormDefinition, variables: { ...VARIABLES } };
}

export interface SaveInput {
  /** A value sets an answer and null clears it. Answers not named stay. */
  answers: Readonly<Record<string, unknown>>;
}

/**
 * Saves answers as the visitor goes. An answer that isn't valid for its question is refused, and a question left
 * unanswered is not: that only blocks the submit.
 */
export async function savePublicDiagnostic(ctx: Pick<Ctx, "db" | "now">, token: string, input: SaveInput): Promise<PublicDiagnosticView> {
  const entries = Object.entries(input.answers);
  if (entries.length > MAX_ANSWERS_PER_SAVE) throw new ServiceError("invalid", "Too many answers in one save.");
  return ctx.db.transaction(async (tx) => {
    const row = await byToken(tx, token, { lock: true });
    if (row.status !== "draft") throw new ServiceError("invalid_transition", "This diagnostic has been submitted, so its answers can't be changed.");
    const template = templateOf(row);
    const known = new Set(template.questions.map((q) => q.id));

    const next: Record<string, unknown> = { ...(row.answers ?? {}) };
    for (const [id, wire] of entries) {
      if (!known.has(id)) throw new ServiceError("invalid", `${id}: this form has no such question`);
      if (wire === null) delete next[id];
      else if (isNotKnown(wire as never)) next[id] = NOT_KNOWN;
      else next[id] = wire;
    }
    const check = checkAnswers(template, next as never, { today: todayOf(ctx.now) });
    if (check.errors.length) throw new ServiceError("invalid", problemsText(check.errors.map((e) => e.message)));

    const [saved] = await tx
      .update(schema.publicDiagnostic)
      .set({ answers: next, ...(row.businessName ? {} : { businessName: businessNameFrom(template, next) }) })
      .where(eq(schema.publicDiagnostic.id, row.id))
      .returning();
    return viewOf(saved ?? row, ctx.now);
  });
}

/** The business's name as typed in section 1, for a visitor who didn't give one when they started. */
function businessNameFrom(template: { questions: readonly FormQuestion[] }, answers: Record<string, unknown>): string | null {
  const q = template.questions.find((x) => x.type === "short_text" && /registered business name/i.test(x.text));
  const value = q ? answers[q.id] : undefined;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
}

/** Section 10's signature, as the template names it. */
const SIGNATURE = { name: "D1", position: "D2", date: "D3" } as const;

/**
 * Submits the diagnostic: every shown question answered and nothing invalid, then the answers are locked and the
 * avenue (A or B) is assigned with the rules. Nothing about the avenue is decided by AI.
 */
export async function submitPublicDiagnostic(ctx: Writer, token: string): Promise<PublicDiagnosticView> {
  const view = await ctx.db.transaction(async (tx) => {
    const row = await byToken(tx, token, { lock: true });
    if (row.status !== "draft") throw new ServiceError("invalid_transition", "This diagnostic has already been submitted.");
    const template = templateOf(row);
    const answers = answersOf(row);
    const check = checkAnswers(template, answers, { today: todayOf(ctx.now) });
    if (check.errors.length || check.incomplete.length) {
      throw new ServiceError("precondition_failed", `The diagnostic isn't complete: ${problemsText([...check.errors, ...check.incomplete].map((e) => e.message))}`);
    }
    const assigned = assignPathwayFromDiagnostic(latestTradeRules(), template, answers, { asOf: todayOf(ctx.now) });
    const text = (id: string): string | null => {
      const value = (answers as Record<string, unknown>)[id];
      return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
    };
    const [saved] = await tx
      .update(schema.publicDiagnostic)
      .set({
        status: "submitted",
        submittedAt: ctx.now,
        pathway: assigned.pathway,
        pathwayProvisional: assigned.provisional,
        liveOrder: assigned.liveOrder,
        rulesVersion: assigned.rulesVersion,
        reasonCodes: [...assigned.reasonCodes],
        signedName: text(SIGNATURE.name),
        signedPosition: text(SIGNATURE.position),
        signedDate: text(SIGNATURE.date),
      })
      .where(eq(schema.publicDiagnostic.id, row.id))
      .returning();
    return viewOf(saved ?? row, ctx.now);
  });

  try {
    await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: view.email,
      subject: "We have your TRADE onboarding diagnostic",
      template: "summit-notice",
      props: {
        heading: "We have your onboarding diagnostic",
        greeting: view.businessName ? `Hello ${view.businessName},` : "Hello,",
        paragraphs: [
          "Thank you. Entrust has received your onboarding diagnostic and will use it to place you on the right learning path before the training starts.",
          "You don't need to do anything else now. A member of the Entrust team will be in touch.",
        ],
      },
    });
  } catch (error) {
    console.error("[trade] The diagnostic confirmation could not be queued", error);
  }
  return view;
}

// ---- Staff ----

/** One form a person started, with how far they got if it is still open. */
export interface PublicDiagnosticSession {
  id: string;
  businessName: string | null;
  status: Row["status"];
  pathway: Row["pathway"];
  pathwayProvisional: boolean | null;
  liveOrder: boolean | null;
  submittedAt: string | null;
  startedAt: string;
  /** The questions answered of those the form shows. Only for a form still in progress. */
  progress: { answered: number; total: number; percent: number } | null;
}

/**
 * Everything one email address has started, as one line. The same person often opens the link again, or on another
 * device, so each start would otherwise be a row of its own.
 */
export interface PublicDiagnosticPerson {
  email: string;
  phone: string | null;
  businessName: string | null;
  /** Submitted as soon as one of their forms is, in progress while every form is. */
  status: Row["status"];
  /** From their newest submitted form, if they have one. */
  pathway: Row["pathway"];
  pathwayProvisional: boolean | null;
  liveOrder: boolean | null;
  /** The latest activity: a submission or a start. */
  latestAt: string;
  submittedCount: number;
  /** An organisation on TRADE whose owner or member has this email, if any. */
  organization: { id: string; name: string } | null;
  /** Newest first. */
  sessions: PublicDiagnosticSession[];
}

export interface ListInput {
  status?: Row["status"] | undefined;
  q?: string | undefined;
  limit?: number | undefined;
}

/** `submitted` and `draft` count people, so they match the list: a person is submitted once any of their forms is. The rest count submitted forms. */
export interface PublicDiagnosticCounts {
  submitted: number;
  draft: number;
  pathwayA: number;
  pathwayB: number;
  /** Pathway B people waiting for staff to see a shipment record. */
  provisional: number;
  /** A confirmed live order, which moves M04, M06 and M08 forward. */
  liveOrder: number;
  /** Forms started and submitted on each of the last 14 days, oldest first. */
  perDay: { date: string; started: number; submitted: number }[];
}

/** The people who have started or submitted a form, the most recently active first, each with their forms. Entrust staff only. */
export async function listPublicDiagnostics(ctx: Ctx, input: ListInput): Promise<{ items: PublicDiagnosticPerson[]; counts: PublicDiagnosticCounts }> {
  requireStaff(ctx.principal);
  const table = schema.publicDiagnostic;
  // Answers are left out: they are large, and only the drafts on screen need them (below), to say how far each got.
  const rows = await ctx.db
    .select({
      id: table.id,
      email: table.email,
      phone: table.phone,
      businessName: table.businessName,
      templateVersion: table.templateVersion,
      status: table.status,
      pathway: table.pathway,
      pathwayProvisional: table.pathwayProvisional,
      liveOrder: table.liveOrder,
      submittedAt: table.submittedAt,
      createdAt: table.createdAt,
    })
    .from(table)
    .orderBy(desc(sql`coalesce(${table.submittedAt}, ${table.createdAt})`));

  // Rows come newest first, so the first form met for an email is its newest, and people are in the order they were last active.
  const byEmail = new Map<string, typeof rows>();
  for (const row of rows) {
    const forms = byEmail.get(row.email);
    if (forms) forms.push(row);
    else byEmail.set(row.email, [row]);
  }
  const people = [...byEmail.values()].map((forms) => {
    const submitted = forms.filter((f) => f.status === "submitted");
    return { forms, submitted, lead: submitted[0] ?? forms[0]! };
  });

  const leads = people.filter((p) => p.submitted.length > 0).map((p) => p.lead);
  const totals = {
    submitted: leads.length,
    draft: people.length - leads.length,
    pathwayA: leads.filter((l) => l.pathway === "A").length,
    pathwayB: leads.filter((l) => l.pathway === "B").length,
    provisional: leads.filter((l) => l.pathway === "B" && l.pathwayProvisional).length,
    liveOrder: leads.filter((l) => l.liveOrder).length,
  };

  const since = new Date(ctx.now.getTime() - 13 * 24 * HOUR_MS);
  since.setUTCHours(0, 0, 0, 0);
  const started = await ctx.db
    .select({ day: sql<string>`to_char(${table.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: count() })
    .from(table)
    .where(gt(table.createdAt, since))
    .groupBy(sql`1`);
  const submitted = await ctx.db
    .select({ day: sql<string>`to_char(${table.submittedAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: count() })
    .from(table)
    .where(gt(table.submittedAt, since))
    .groupBy(sql`1`);
  const startedBy = new Map(started.map((r) => [r.day, r.n]));
  const submittedBy = new Map(submitted.map((r) => [r.day, r.n]));
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(since.getTime() + i * 24 * HOUR_MS).toISOString().slice(0, 10);
    return { date, started: startedBy.get(date) ?? 0, submitted: submittedBy.get(date) ?? 0 };
  });

  // The search finds a person when any one of their forms matches, and then shows all of their forms.
  const search = input.q?.trim().toLowerCase();
  const matching = people
    .filter((p) => (input.status === "submitted" ? p.submitted.length > 0 : input.status === "draft" ? p.submitted.length === 0 : true))
    .filter((p) => !search || p.forms.some((f) => [f.email, f.businessName, f.phone].some((value) => value?.toLowerCase().includes(search))))
    .slice(0, Math.min(Math.max(input.limit ?? 200, 1), 1000));

  const draftIds = matching.flatMap((p) => p.forms.filter((f) => f.status === "draft").map((f) => f.id));
  const progressOf = new Map<string, { answered: number; total: number; percent: number }>();
  if (draftIds.length) {
    const drafts = await ctx.db.select({ id: table.id, answers: table.answers }).from(table).where(inArray(table.id, draftIds));
    const versionOf = new Map(rows.map((r) => [r.id, r.templateVersion]));
    for (const draft of drafts) {
      const { answered, total, percent } = checkAnswers(templateOf({ templateVersion: versionOf.get(draft.id)! }), answersOf(draft), { today: todayOf(ctx.now) }).progress;
      progressOf.set(draft.id, { answered, total, percent });
    }
  }

  const emails = matching.map((p) => p.lead.email);
  const organizations = new Map<string, { id: string; name: string }>();
  if (emails.length) {
    const members = await ctx.db
      .select({ email: sql<string>`lower(${schema.user.email})`, id: schema.organization.id, name: schema.organization.name })
      .from(schema.user)
      .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
      .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
      .where(sql`lower(${schema.user.email}) in ${emails}`);
    for (const m of members) if (!organizations.has(m.email)) organizations.set(m.email, { id: m.id, name: m.name });
  }

  return {
    items: matching.map(({ forms, submitted: done, lead }) => ({
      email: lead.email,
      phone: lead.phone ?? forms.find((f) => f.phone)?.phone ?? null,
      businessName: lead.businessName ?? forms.find((f) => f.businessName)?.businessName ?? null,
      status: done.length > 0 ? ("submitted" as const) : ("draft" as const),
      pathway: done.length > 0 ? lead.pathway : null,
      pathwayProvisional: done.length > 0 ? lead.pathwayProvisional : null,
      liveOrder: done.length > 0 ? lead.liveOrder : null,
      latestAt: (forms[0]!.submittedAt ?? forms[0]!.createdAt).toISOString(),
      submittedCount: done.length,
      organization: organizations.get(lead.email) ?? null,
      sessions: forms.map((f) => ({
        id: f.id,
        businessName: f.businessName,
        status: f.status,
        pathway: f.pathway,
        pathwayProvisional: f.pathwayProvisional,
        liveOrder: f.liveOrder,
        submittedAt: f.submittedAt?.toISOString() ?? null,
        startedAt: f.createdAt.toISOString(),
        progress: progressOf.get(f.id) ?? null,
      })),
    })),
    counts: { ...totals, perDay },
  };
}

/** One form with its answers, for staff to read. */
export async function getPublicDiagnosticForStaff(ctx: Ctx, id: string) {
  requireStaff(ctx.principal);
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new ServiceError("not_found", "Diagnostic not found.");
  const [row] = await ctx.db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.id, id));
  if (!row) throw new ServiceError("not_found", "Diagnostic not found.");
  const template = templateOf(row);
  const answers = (row.answers ?? {}) as Record<string, unknown>;
  const sections = template.sections
    .map((section) => ({
      id: section.id,
      title: section.title,
      items: template.questions
        .filter((q) => q.section === section.id && answers[q.id] !== undefined && answers[q.id] !== null)
        .map((q) => ({ id: q.id, text: q.text.replace(/\{country\}/g, VARIABLES.country), answer: answerText(q, answers[q.id]) })),
    }))
    .filter((section) => section.items.length > 0);
  const { answers: _answers, ...view } = viewOf(row, ctx.now);
  return {
    ...view,
    id: row.id,
    startedAt: row.createdAt.toISOString(),
    signedName: row.signedName,
    signedPosition: row.signedPosition,
    signedDate: row.signedDate,
    sections,
  };
}

// ---- Export ----

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  // A cell that starts like a formula would run in Excel, and these are answers typed by strangers.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** An answer as one readable cell: the option's label for a choice, "amount currency" for money. */
export function answerText(q: FormQuestion, answer: unknown): string {
  if (answer === undefined || answer === null) return "";
  if (isNotKnown(answer as never)) return "Not known";
  const label = (value: unknown) => q.options?.find((o) => o.value === value)?.label ?? String(value);
  switch (q.type) {
    case "single_choice":
      return label(answer);
    case "yes_no":
      return answer === "yes" ? "Yes" : answer === "no" ? "No" : String(answer);
    case "multiple_choice":
      return Array.isArray(answer) ? answer.map(label).join("; ") : String(answer);
    case "money": {
      const money = answer as { amount?: unknown; currency?: unknown };
      return `${money.amount} ${money.currency}`;
    }
    case "list":
      return Array.isArray(answer) ? answer.join("; ") : String(answer);
    default:
      return String(answer);
  }
}

/**
 * Every submitted diagnostic as CSV, one row each: who, the avenue, then one column per question (headed with its ID
 * and wording) from the newest version of the form. Entrust staff only.
 */
export async function exportPublicDiagnosticsCsv(ctx: Ctx): Promise<string> {
  requireStaff(ctx.principal);
  const rows = await ctx.db
    .select()
    .from(schema.publicDiagnostic)
    .where(eq(schema.publicDiagnostic.status, "submitted"))
    .orderBy(desc(schema.publicDiagnostic.submittedAt));
  const template = latestDiagnosticTemplate();
  const head = [
    "Reference",
    "Submitted",
    "Email",
    "Phone",
    "Business",
    "Pathway",
    "Provisional",
    "Live order",
    "Form version",
    "Signed by",
    "Position",
    "Signed on",
    ...template.questions.map((q) => `${q.id} ${q.text.replace(/\{country\}/g, VARIABLES.country)}`),
  ];
  const lines = [head.map(csvCell).join(",")];
  for (const r of rows) {
    const answers = (r.answers ?? {}) as Record<string, unknown>;
    // An older form's questions have the same IDs, so the same columns hold the same answers.
    lines.push(
      [
        r.id,
        r.submittedAt?.toISOString() ?? "",
        r.email,
        r.phone ?? "",
        r.businessName ?? "",
        r.pathway ?? "",
        r.pathwayProvisional ? "Yes" : "No",
        r.liveOrder ? "Yes" : "No",
        r.templateVersion,
        r.signedName ?? "",
        r.signedPosition ?? "",
        r.signedDate ?? "",
        ...template.questions.map((q) => answerText(q, answers[q.id])),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
