import { expect, test, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";

// The three people TRADE is for, each through the screens they use (audit #217: only sign-in and the studio ran in a
// browser). A learner passes a knowledge check, an assessor scores a practical, and a sponsor bank reads its cohort.
// Accounts are made through the sign-up screen; what would take dozens of screens to reach (an enrolment, a plan, a
// submission) is put in the database first, as the other browser tests do.

const TRADE = "http://localhost:3001";
const PASSWORD = "correct horse battery staple";

const db = getDb();
const run = Date.now();
const entrustOrgId = process.env.ENTRUST_ORG_ID || "org-entrust-hq";

async function signUp(page: Page, name: string, email: string) {
  await page.context().clearCookies();
  await page.goto(`${TRADE}/sign-in`);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/check-email\?/);
  const [user] = await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email)).returning();
  await page.context().clearCookies();
  return user!;
}

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(`${TRADE}/sign-in`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

async function organization(id: string, name: string, kind: "sme" | "sponsor" | "entrust") {
  await db.insert(schema.organization).values({ id, name, slug: id, createdAt: new Date(), metadata: JSON.stringify({ kind }) }).onConflictDoNothing();
  if (kind === "sme") {
    await db.insert(schema.smeProfile).values({ organizationId: id, smeId: `E2E-${id}`, legalName: name, country: "ET" }).onConflictDoNothing();
    await db.insert(schema.platformAccess).values({ organizationId: id, platform: "trade" }).onConflictDoNothing();
  }
}

const member = (organizationId: string, userId: string, role: string) => db.insert(schema.member).values({ id: crypto.randomUUID(), organizationId, userId, role, createdAt: new Date() });

/** A cohort with one business enrolled and a plan of M05, the business pinned to M05's current approved version. */
async function enrolled(tag: string, extra: { sponsorOrganizationId?: string } = {}) {
  const orgId = `e2e-sme-${tag}-${run}`;
  await organization(orgId, `Journey Exporters ${tag} ${run}`, "sme");
  const [program] = await db.insert(schema.program).values({ name: `E2E journeys ${tag} ${run}` }).returning();
  const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `E2E cohort ${tag} ${run}`, ...extra }).returning();
  const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: orgId, status: "active" }).returning();
  const [plan] = await db.insert(schema.learningPlan).values({ enrollmentId: enrollment!.id, rulesVersion: "0.2.0", pathway: "A", status: "active", requiresHumanReview: false, acknowledgedAt: new Date() }).returning();
  await db.insert(schema.moduleAssignment).values({ planId: plan!.id, moduleId: "M05", status: "required", sequence: 1, reasonCodes: ["NO_QUALIFIED_BUYER"], source: "engine" });
  return { orgId, cohortId: cohort!.id, enrollmentId: enrollment!.id };
}

/** M05's approved content as the API serves it, with its answer key and rubric. */
async function m05() {
  const rows = await db.select().from(schema.moduleContentVersion).where(and(eq(schema.moduleContentVersion.moduleId, "M05"), eq(schema.moduleContentVersion.status, "approved")));
  const newest = rows.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0]!;
  return newest.content as {
    version: string;
    knowledgeCheck: { questions: { id: string; options: { id: string; text: string }[]; correct: string[] }[] };
    rubric: { criteria: { id: string; title: string; maxPoints: number }[] };
  };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test.describe("TRADE journeys in a browser", () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    await organization(entrustOrgId, "Entrust Africa Staff HQ", "entrust");
  });

  test("a learner opens a module in their plan, marks a lesson done and passes its knowledge check", async ({ page }) => {
    const email = `e2e-learner-${run}@example.test`;
    const learner = await signUp(page, "Journey Learner", email);
    const { orgId } = await enrolled("learner");
    await member(orgId, learner.id, "owner");

    await signIn(page, email);
    await page.goto(`${TRADE}/modules/M05`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The first lesson: marked done, and it stays done.
    await page.getByRole("button", { name: /Mark complete/ }).first().click();
    await expect(page.getByRole("button", { name: /Completed/ }).first()).toBeVisible();

    // The knowledge check, answered from the module's own key. The options come in a shuffled order, so each answer is
    // picked by its text.
    const content = await m05();
    await page.getByRole("button", { name: "Knowledge Check", exact: true }).click();
    for (const q of content.knowledgeCheck.questions) {
      for (const id of q.correct) {
        const text = q.options.find((o) => o.id === id)!.text;
        await page.locator("label", { has: page.locator(`input[name="question-${q.id}"]`) }).filter({ hasText: new RegExp(`^\\s*${escape(text)}\\s*$`) }).locator("input").check();
      }
    }
    await page.getByRole("button", { name: "Submit Knowledge Check" }).click();
    await expect(page.getByText("Knowledge Check Passed!")).toBeVisible();

    // The progress is the learner's, on the version they started.
    const [progress] = await db.select().from(schema.moduleProgress).innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.moduleProgress.enrollmentId)).where(eq(schema.enrollment.organizationId, orgId));
    expect(progress!.module_progress.contentVersion).toBe(content.version);
    expect(progress!.module_progress.theoryCompletedAt).not.toBeNull();
  });

  test("an assessor on the cohort scores a practical waiting in the review queue", async ({ page }) => {
    const email = `e2e-assessor-${run}@entrust.test`;
    const assessor = await signUp(page, "Journey Assessor", email);
    await member(entrustOrgId, assessor.id, "reviewer");
    const { cohortId, enrollmentId } = await enrolled("assessor");
    await db.insert(schema.cohortStaff).values({ cohortId, userId: assessor.id });
    const content = await m05();
    await db.insert(schema.moduleProgress).values({ enrollmentId, moduleId: "M05", contentVersion: content.version, status: "submitted", lessonProgress: {}, theoryCompletedAt: new Date() });
    const [submission] = await db
      .insert(schema.moduleSubmission)
      .values({ enrollmentId, moduleId: "M05", contentVersion: content.version, version: 1, status: "submitted", worksheetSnapshot: { worksheets: [] }, submittedAt: new Date() })
      .returning();

    await signIn(page, email);
    await page.goto(`${TRADE}/review-queue`);
    await expect(page.getByRole("heading", { name: "Assessor Workspace" })).toBeVisible();
    await page.goto(`${TRADE}/review-queue/${submission!.id}`);

    // Four of six on every criterion: 24 of 36, the pass mark.
    for (const c of content.rubric.criteria) {
      await page.getByRole("button", { name: `${c.title}: 4 of ${c.maxPoints}`, exact: true }).click();
    }
    await page.getByPlaceholder(/Overall observations/).fill("Clear buyer profile and a credible pipeline.");
    await page.getByRole("button", { name: "Submit Assessor Score" }).click();

    await expect
      .poll(async () => (await db.select().from(schema.rubricAssessment).where(eq(schema.rubricAssessment.submissionId, submission!.id)))[0]?.passed, { timeout: 15_000 })
      .toBe(true);
    const [scored] = await db.select().from(schema.rubricAssessment).where(eq(schema.rubricAssessment.submissionId, submission!.id));
    expect(scored).toMatchObject({ totalPoints: 24, maxPoints: 36, assessorUserId: assessor.id, isFirstScore: true });
  });

  test("an administrator sets up a sponsor bank, opens a business's plan and asks it for evidence, which the business answers", async ({ page }) => {
    const adminEmail = `e2e-admin-${run}@entrust.test`;
    const admin = await signUp(page, "Journey Admin", adminEmail);
    await member(entrustOrgId, admin.id, "admin");
    const ownerEmail = `e2e-owner-${run}@example.test`;
    const owner = await signUp(page, "Journey Owner", ownerEmail);
    const { orgId } = await enrolled("staff-screens");
    await member(orgId, owner.id, "owner");

    await signIn(page, adminEmail);
    // A sponsor bank, made on its screen.
    await page.goto(`${TRADE}/admin/sponsors`);
    await page.getByLabel("Bank name").fill(`Journey Admin Bank ${run}`);
    await page.getByRole("button", { name: "Add bank" }).click();
    await expect(page.getByRole("heading", { name: `Journey Admin Bank ${run}` })).toBeVisible();

    // The business's plan, as staff see it.
    await page.goto(`${TRADE}/plan?organizationId=${orgId}`);
    await expect(page.getByRole("heading", { name: "Modules in the plan" })).toBeVisible();
    await expect(page.getByText("M05", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete by override" })).toBeVisible();

    // A request for evidence, then the business answers it.
    await page.goto(`${TRADE}/evidence?organizationId=${orgId}`);
    await page.getByLabel("What you need").fill("Last quarter's bank statement");
    await page.getByLabel("What to send, in the business's words").fill("The statement for July to September.");
    await page.getByRole("button", { name: "Ask for it" }).click();
    await expect(page.getByRole("heading", { name: "Waiting for the business" })).toBeVisible();

    await signIn(page, ownerEmail);
    await page.goto(`${TRADE}/evidence`);
    await expect(page.getByRole("heading", { name: "Asked of you" })).toBeVisible();
    await page.getByLabel(/A note about/).fill("Statement sent to your email, account ending 4411.");
    await page.getByRole("button", { name: "Send to Entrust" }).first().click();
    await expect(page.getByText("Waiting for review")).toBeVisible();
    const [record] = await db.select().from(schema.evidenceRecord).where(eq(schema.evidenceRecord.organizationId, orgId));
    expect(record).toMatchObject({ status: "submitted", responseNote: "Statement sent to your email, account ending 4411." });
  });

  test("a sponsor bank reads the cohort it sponsors, and its report", async ({ page }) => {
    const email = `e2e-sponsor-${run}@bank.test`;
    const viewer = await signUp(page, "Journey Sponsor", email);
    const sponsorId = `e2e-bank-${run}`;
    await organization(sponsorId, `Journey Bank ${run}`, "sponsor");
    await member(sponsorId, viewer.id, "sponsor_viewer");
    const { cohortId } = await enrolled("sponsor", { sponsorOrganizationId: sponsorId });

    await signIn(page, email);
    await page.goto(`${TRADE}/sponsor`);
    await expect(page.getByRole("heading", { name: "Sponsored cohorts" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(`E2E cohort sponsor ${run}`) }).first().click();
    await page.waitForURL(new RegExp(`/sponsor/${cohortId}`));

    await page.goto(`${TRADE}/reports`);
    await expect(page.getByRole("heading", { name: "Programme reports" })).toBeVisible();
    await expect(page.getByText("This report couldn't be loaded")).toHaveCount(0);
    // A sponsor sees each cohort whole: there is no pathway filter to split it.
    await expect(page.getByLabel("Pathway")).toHaveCount(0);
  });
});
