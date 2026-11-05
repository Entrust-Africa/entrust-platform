import { and, count, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { schema } from "@entrust/db";
import { isDiagnosticWorkbook, isYes, readApplications, timesApplied, type ApplicationInput } from "@entrust/trade-engine";
import type { ApplicationListView, ApplicationsImportedView } from "../schemas/trade";
import { requireStaff, type Ctx } from "./access";
import { ServiceError } from "./errors";
import { readUploadedWorkbook } from "./register-workbook";

// Applications to a programme, from the form's responses. Every response is kept. Only those from Ethiopia are ever listed:
// the list asks the database for them alone, so a response from elsewhere never reaches this code, and what is said about the
// rest is a count. Staff only.

const SHOWN = "ET" as const;

/** An object's JSON with its keys in order, so two answers can be compared however the database ordered them. */
const stable = (value: Record<string, string>): string => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));

/** The responses from Ethiopia, newest first, and how many others are kept without being shown. */
export async function listApplications(ctx: Ctx): Promise<ApplicationListView> {
  requireStaff(ctx.principal, ["admin", "facilitator", "reviewer"], "see applications");
  const [rows, [others]] = await Promise.all([
    ctx.db.select().from(schema.programApplication).where(eq(schema.programApplication.country, SHOWN)).orderBy(desc(schema.programApplication.submittedAt), desc(schema.programApplication.id)),
    ctx.db
      .select({ n: count() })
      .from(schema.programApplication)
      .where(or(isNull(schema.programApplication.country), ne(schema.programApplication.country, SHOWN))),
  ]);
  const times = timesApplied(rows);
  return {
    items: rows.map((row, i) => ({
      id: row.id,
      program: row.program,
      submittedAt: row.submittedAt.toISOString(),
      email: row.email,
      businessName: row.businessName,
      contactName: row.contactName,
      phone: row.phone,
      location: row.location,
      country: SHOWN,
      answers: row.answers,
      timesApplied: times[i] ?? 1,
    })),
    summary: {
      shown: rows.length,
      notShown: others?.n ?? 0,
      exportedBefore: rows.filter((r) => isYes(r.answers.exportedBefore)).length,
      interestedInZemen: rows.filter((r) => isYes(r.answers.zemenInterest)).length,
      repeatApplications: times.filter((t) => t > 1).length,
    },
  };
}

/** Loads a Google Form's responses for a programme: new responses are added, changed ones updated, the rest left as they are. */
export async function importApplications(
  ctx: Ctx,
  input: { program: string; fileName?: string | undefined; contentBase64: string },
): Promise<ApplicationsImportedView> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "load application responses");
  const sheets = readUploadedWorkbook(input.contentBase64);
  if (isDiagnosticWorkbook(sheets)) {
    throw new ServiceError("invalid", "That is the diagnostic workbook, not a form's responses. Load it on the Register tab.");
  }
  let read: ReturnType<typeof readApplications>;
  try {
    read = readApplications(sheets);
  } catch (error) {
    throw new ServiceError("invalid", error instanceof Error ? error.message : "The responses couldn't be read.");
  }
  const { applications, warnings } = read;

  return ctx.db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(schema.programApplication)
      .where(and(eq(schema.programApplication.program, input.program), inArray(schema.programApplication.email, [...new Set(applications.map((a) => a.email))])));
    const responseKey = (submittedAt: string, email: string) => `${submittedAt}|${email}`;
    const byResponse = new Map(existing.map((row) => [responseKey(row.submittedAt.toISOString(), row.email), row]));

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const application of applications) {
      const values = { program: input.program, ...application, submittedAt: new Date(application.submittedAt), answers: application.answers as Record<string, string> };
      const row = byResponse.get(responseKey(application.submittedAt, application.email));
      if (!row) {
        await tx.insert(schema.programApplication).values(values);
        created += 1;
      } else if (differs(row, application)) {
        await tx.update(schema.programApplication).set(values).where(eq(schema.programApplication.id, row.id));
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    const shown = applications.filter((a) => a.country === SHOWN).length;
    // The audit entry counts responses and names none, so the audit log holds nobody's details.
    await tx.insert(schema.auditLog).values({
      actorUserId: ctx.principal.userId,
      platform: "trade",
      action: "program_application.import",
      entityType: "program_application",
      entityId: crypto.randomUUID(),
      after: { program: input.program, fileName: input.fileName ?? null, total: applications.length, created, updated, unchanged, shown, notShown: applications.length - shown },
    });
    return { total: applications.length, created, updated, unchanged, shown, notShown: applications.length - shown, warnings };
  });
}

function differs(row: typeof schema.programApplication.$inferSelect, next: ApplicationInput): boolean {
  return (
    row.businessName !== next.businessName ||
    row.contactName !== next.contactName ||
    row.phone !== next.phone ||
    row.location !== next.location ||
    row.country !== next.country ||
    stable(row.answers) !== stable(next.answers as Record<string, string>)
  );
}
