import { and, count, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
import { NOT_KNOWN, checkAnswers, isNotKnown, type FormDefinition, type FormQuestion } from "@entrust/forms";
import { PATHWAY_NAMES, assignPathwayFromDiagnostic } from "@entrust/trade-engine";
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

/** Entrust staff of any role may read the submissions. */
const requireStaff = (principal: Principal): void => requireRole(principal, ["admin", "facilitator", "reviewer"], "read the onboarding diagnostics");

const todayOf = (now: Date): string => now.toISOString().slice(0, 10);

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
  businessName?: string | undefined;
  /** A hash of the visitor's address, if known. */
  addressHash?: string | null | undefined;
}

function linkOf(token: string): string {
  const base = (process.env.TRADE_APP_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  return `${base}/onboarding/${token}`;
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
  const template = latestDiagnosticTemplate();
  const [row] = await ctx.db
    .insert(schema.publicDiagnostic)
    .values({
      tokenHash: await hashToken(token),
      email,
      businessName: input.businessName?.trim() || null,
      templateVersion: template.version,
      ipHash: input.addressHash ?? null,
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
        greeting: input.businessName?.trim() ? `Hello ${input.businessName.trim()},` : "Hello,",
        paragraphs: [
          "Thank you for starting the Entrust TRADE onboarding diagnostic. This is your private link. Your answers save as you go, so you can stop and carry on from this link whenever you like, on any device.",
          "Please don't forward it: anyone with the link can read and change your answers.",
        ],
        action: { label: "Continue the diagnostic", url: linkOf(token) },
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
  businessName: string | null;
  submittedAt: string | null;
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
    businessName: row.businessName,
    submittedAt: row.submittedAt?.toISOString() ?? null,
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

export interface PublicDiagnosticSummary {
  id: string;
  email: string;
  businessName: string | null;
  status: Row["status"];
  pathway: Row["pathway"];
  pathwayProvisional: boolean | null;
  liveOrder: boolean | null;
  submittedAt: string | null;
  startedAt: string;
  /** Other forms from the same email, so staff can tell a repeat from a new business. */
  sameEmail: number;
  /** An organisation on TRADE whose owner or member has this email, if any. */
  organization: { id: string; name: string } | null;
}

export interface ListInput {
  status?: Row["status"] | undefined;
  q?: string | undefined;
  limit?: number | undefined;
}

/** The forms people have started or submitted, newest first. Entrust staff only. */
export async function listPublicDiagnostics(ctx: Ctx, input: ListInput): Promise<{ items: PublicDiagnosticSummary[]; counts: { submitted: number; draft: number } }> {
  requireStaff(ctx.principal);
  const search = input.q?.trim();
  const where = and(
    input.status ? eq(schema.publicDiagnostic.status, input.status) : undefined,
    search ? or(ilike(schema.publicDiagnostic.email, `%${search}%`), ilike(schema.publicDiagnostic.businessName, `%${search}%`)) : undefined,
  );
  const rows = await ctx.db
    .select()
    .from(schema.publicDiagnostic)
    .where(where)
    .orderBy(desc(sql`coalesce(${schema.publicDiagnostic.submittedAt}, ${schema.publicDiagnostic.createdAt})`))
    .limit(Math.min(Math.max(input.limit ?? 200, 1), 1000));

  const [totals] = await ctx.db
    .select({
      submitted: sql<number>`count(*) filter (where ${schema.publicDiagnostic.status} = 'submitted')::int`,
      draft: sql<number>`count(*) filter (where ${schema.publicDiagnostic.status} = 'draft')::int`,
    })
    .from(schema.publicDiagnostic);

  const emails = [...new Set(rows.map((r) => r.email))];
  const sameEmail = new Map<string, number>();
  const organizations = new Map<string, { id: string; name: string }>();
  if (emails.length) {
    const counted = await ctx.db
      .select({ email: schema.publicDiagnostic.email, n: count() })
      .from(schema.publicDiagnostic)
      .where(sql`${schema.publicDiagnostic.email} in ${emails}`)
      .groupBy(schema.publicDiagnostic.email);
    for (const c of counted) sameEmail.set(c.email, c.n);
    const people = await ctx.db
      .select({ email: sql<string>`lower(${schema.user.email})`, id: schema.organization.id, name: schema.organization.name })
      .from(schema.user)
      .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
      .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
      .where(sql`lower(${schema.user.email}) in ${emails}`);
    for (const p of people) if (!organizations.has(p.email)) organizations.set(p.email, { id: p.id, name: p.name });
  }

  return {
    items: rows.map((r) => ({
      id: r.id,
      email: r.email,
      businessName: r.businessName,
      status: r.status,
      pathway: r.pathway,
      pathwayProvisional: r.pathwayProvisional,
      liveOrder: r.liveOrder,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      startedAt: r.createdAt.toISOString(),
      sameEmail: sameEmail.get(r.email) ?? 1,
      organization: organizations.get(r.email) ?? null,
    })),
    counts: { submitted: totals?.submitted ?? 0, draft: totals?.draft ?? 0 },
  };
}

/** One form with its answers, for staff to read. */
export async function getPublicDiagnosticForStaff(ctx: Ctx, id: string) {
  requireStaff(ctx.principal);
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new ServiceError("not_found", "Diagnostic not found.");
  const [row] = await ctx.db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.id, id));
  if (!row) throw new ServiceError("not_found", "Diagnostic not found.");
  const template = templateOf(row);
  return {
    ...viewOf(row, ctx.now),
    id: row.id,
    startedAt: row.createdAt.toISOString(),
    signedName: row.signedName,
    signedPosition: row.signedPosition,
    signedDate: row.signedDate,
    form: template as FormDefinition,
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
