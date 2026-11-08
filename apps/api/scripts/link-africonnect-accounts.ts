// Gives every Entrust account whose email is verified an AfriConnect account too, tied by AfriConnect's subject, for
// people who registered before AfriConnect sign-in was switched on (Summit applicants, staff, SMEs). It also retries
// onboarding diagnostics whose email was proven but whose account could not be made at the time.
//
// Nobody is emailed and no password is set: each person chooses one the first time they sign in. Safe to run again;
// accounts already tied are skipped. Without --apply it only reports what it would do.
//
//   cd apps/api
//   DATABASE_URL=… BETTER_AUTH_SECRET=… BETTER_AUTH_URL=… \
//   AFRICONNECT_CLIENT_ID=… AFRICONNECT_CLIENT_SECRET=… \
//   ./node_modules/.bin/tsx scripts/link-africonnect-accounts.ts [--apply] [--limit 50]
//
// The AfriConnect client must be allowed to provision (idp:updateClientSettings with provisionAccounts: true).

import { and, eq, isNotNull, isNull, notExists, sql } from "drizzle-orm";
import { AFRICONNECT_PROVIDER_ID, afriConnectSignIn, ensureAfriConnectAccount } from "@entrust/auth";
import { getDb, schema } from "@entrust/db";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const limitAt = args.indexOf("--limit");
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Number.POSITIVE_INFINITY;
if (limitAt >= 0 && (!Number.isInteger(limit) || limit < 1)) {
  console.error("--limit needs a whole number of accounts, for example --limit 50.");
  process.exit(1);
}

/** Each call can wait out a 10 s timeout, so a run stops once AfriConnect looks down rather than crawling through every row. */
const MAX_UNAVAILABLE_IN_A_ROW = 5;

if (!afriConnectSignIn) {
  console.error("AFRICONNECT_CLIENT_ID and AFRICONNECT_CLIENT_SECRET are not set.");
  process.exit(1);
}

const db = getDb();

const users = await db
  .select({ id: schema.user.id, email: schema.user.email, name: schema.user.name })
  .from(schema.user)
  .where(
    and(
      eq(schema.user.emailVerified, true),
      notExists(
        db
          .select({ one: sql`1` })
          .from(schema.account)
          .where(and(eq(schema.account.userId, schema.user.id), eq(schema.account.providerId, AFRICONNECT_PROVIDER_ID))),
      ),
    ),
  )
  .orderBy(schema.user.createdAt);

const diagnostics = await db
  .select({ id: schema.publicDiagnostic.id, email: schema.publicDiagnostic.email })
  .from(schema.publicDiagnostic)
  .where(and(isNotNull(schema.publicDiagnostic.emailVerifiedAt), isNull(schema.publicDiagnostic.userId)));

console.log(`${users.length} verified Entrust accounts are not tied to AfriConnect.`);
console.log(`${diagnostics.length} diagnostics have a proven email but no account.`);
if (!apply) {
  for (const user of users.slice(0, 20)) console.log(`  would link ${user.email}`);
  if (users.length > 20) console.log(`  … and ${users.length - 20} more`);
  console.log("Dry run. Add --apply to make the accounts.");
  process.exit(0);
}

const tally: Record<string, number> = {};
let done = 0;
let unavailableInARow = 0;

/**
 * Links one person and reports what happened. A failure on one row (a database error, or someone signing in with the
 * same email at that moment) is counted and the run carries on. Returns false once the run should stop.
 */
async function link(label: string, person: { email: string; name?: string }, onLinked?: (userId: string) => Promise<void>): Promise<boolean> {
  let status: string;
  try {
    const result = await ensureAfriConnectAccount(person);
    status = result.status;
    if (result.status === "linked") await onLinked?.(result.userId);
    else console.log(`  ${label}: ${result.status}${"reason" in result ? ` (${result.reason})` : ""}`);
  } catch (error) {
    status = "error";
    console.error(`  ${label}: failed`, error);
  }
  tally[status] = (tally[status] ?? 0) + 1;
  done++;
  unavailableInARow = status === "unavailable" ? unavailableInARow + 1 : 0;
  return unavailableInARow < MAX_UNAVAILABLE_IN_A_ROW;
}

const work: Array<() => Promise<boolean>> = [
  ...users.map((user) => () => link(user.email, { email: user.email, name: user.name })),
  ...diagnostics.map((diagnostic) => () =>
    link(`diagnostic ${diagnostic.id}`, { email: diagnostic.email }, async (userId) => {
      await db.update(schema.publicDiagnostic).set({ userId }).where(eq(schema.publicDiagnostic.id, diagnostic.id));
    }),
  ),
];

let stopped = false;
for (const step of work) {
  if (done >= limit) break;
  if (!(await step())) {
    stopped = true;
    break;
  }
}
console.log("Done:", tally);
if (stopped) {
  console.error(`Stopped: AfriConnect was unavailable ${MAX_UNAVAILABLE_IN_A_ROW} times in a row. It is safe to run this again.`);
  process.exit(1);
}
process.exit(0);
