import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";
import * as fs from "node:fs";
import * as path from "node:path";

const SCREENSHOT_DIR =
  process.env.SCREENSHOT_DIR ||
  "/home/fenkin/.gemini/antigravity/brain/b781e4ed-7a97-4649-a811-fd12b44ad9aa/screenshots";

async function maybeScreenshot(page: { screenshot: (opts: { path: string }) => Promise<Buffer> }, name: string) {
  if (process.env.CI) return;
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, name) });
  } catch {
    // Ignore screenshot errors
  }
}

test("Staff course content studio full lifecycle: draft, validate, preview, review, approve, and learner verification (#212)", async ({
  page,
}) => {
  test.setTimeout(90000);
  const timestamp = Date.now();
  const db = getDb();

  const facilitatorEmail = `facil-${timestamp}@entrust.test`;
  const adminEmail = `admin-${timestamp}@entrust.test`;
  const learnerEmail = `learner-${timestamp}@example.test`;
  const password = "correct horse battery staple";
  const entrustOrgId = process.env.ENTRUST_ORG_ID || "org-entrust-hq";
  const learnerOrgId = `org-sme-${timestamp}`;

  // This test removes M01 1.1.0 so it can make it again, so it runs only against a database on this machine: never
  // whatever a stray .env points at, such as production.
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(databaseUrl)) {
    throw new Error("The course studio test changes content versions, so it runs only against a local database (DATABASE_URL on localhost).");
  }
  await db.delete(schema.moduleContentVersion).where(and(eq(schema.moduleContentVersion.moduleId, "M01"), eq(schema.moduleContentVersion.version, "1.1.0")));

  // 1. Ensure Entrust organization exists in DB
  await db
    .insert(schema.organization)
    .values({
      id: entrustOrgId,
      name: "Entrust Africa Staff HQ",
      slug: entrustOrgId,
      createdAt: new Date(),
      metadata: { kind: "entrust" },
    })
    .onConflictDoNothing();

  // 2. Helper to register and prepare a user
  async function createVerifiedUser(name: string, email: string, role?: string, orgId?: string) {
    await page.context().clearCookies();
    await page.goto("http://localhost:3001/sign-in");
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/check-email\?/);

    const [userRow] = await db
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.email, email))
      .returning();

    if (role && orgId && userRow) {
      await db.insert(schema.member).values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId: userRow.id,
        role,
        createdAt: new Date(),
      });
    }

    await page.context().clearCookies();
    return userRow!;
  }

  // Create staff users and SME learner
  await createVerifiedUser("Staff Facilitator", facilitatorEmail, "facilitator", entrustOrgId);
  await createVerifiedUser("Super Administrator", adminEmail, "admin", entrustOrgId);

  // Create SME organisation with TRADE platform access
  await db
    .insert(schema.organization)
    .values({
      id: learnerOrgId,
      name: `SME Exporter ${timestamp}`,
      slug: learnerOrgId,
      createdAt: new Date(),
      metadata: { kind: "sme" },
    })
    .onConflictDoNothing();

  const learnerUser = await createVerifiedUser("SME Learner User", learnerEmail, "owner", learnerOrgId);
  await db.insert(schema.platformAccess).values([
    { organizationId: learnerOrgId, platform: "trade", grantedBy: learnerUser.id },
  ]);

  // ----------------------------------------------------
  // STEP 1: Facilitator logs in and views Course Studio
  // ----------------------------------------------------
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().clearCookies();
  await page.goto("http://localhost:3001/sign-in");
  await page.getByLabel("Email").fill(facilitatorEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("http://localhost:3001/");

  // Navigate to Course Studio catalog
  await page.goto("http://localhost:3001/admin/modules");
  await expect(page.getByRole("heading", { name: "Course studio" })).toBeVisible();
  await expect(page.getByText("Drafts being written")).toBeVisible();
  await page.waitForTimeout(1000);

  await maybeScreenshot(page, "51_course_studio_catalog.png");

  // ----------------------------------------------------
  // STEP 2: Create a new draft version for M01
  // ----------------------------------------------------
  // M01's card comes first: start a new draft from it
  await page.getByRole("button", { name: "Start a new draft" }).first().click();

  // The dialog opens with the next free version number filled in
  await expect(page.getByRole("heading", { name: "Start a new draft of M01" })).toBeVisible();
  await page.getByLabel("New version number").fill("1.1.0");
  await page.getByLabel("What you're changing (optional)").fill("Clarified quiz question explanations per #210 and improved lesson guidance");

  await maybeScreenshot(page, "52_course_studio_create_draft_modal.png");

  // Starting it opens the new draft in the editor, which says it's a draft and that learners keep the live version
  await page.getByRole("button", { name: "Start draft", exact: true }).click();
  await page.waitForURL(/\/admin\/modules\/M01\/editor\?version=1\.1\.0/);
  await expect(page.getByRole("heading", { name: /Diagnostic and Deal Selection/ })).toBeVisible();
  await expect(page.getByText("You are editing draft v1.1.0.")).toBeVisible();
  await expect(page.getByText("Draft v1.1.0 started.", { exact: false })).toBeVisible();

  await maybeScreenshot(page, "53_course_studio_draft_editor.png");

  // ----------------------------------------------------
  // STEP 3: Test Real-time Validation Error (Pass Mark > 100)
  // ----------------------------------------------------
  await page.getByRole("button", { name: /Knowledge Check Quiz/ }).click();
  await page.waitForTimeout(500);

  const passMarkInput = page.locator('input[type="number"]').first();
  await passMarkInput.fill("150"); // Invalid! Must be <= 100

  // Click Save draft
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForTimeout(1000);

  // Verify the error banner appears
  await expect(page.getByText("That didn't work")).toBeVisible();
  await expect(page.getByText(/passMark/)).toBeVisible();

  await maybeScreenshot(page, "54_course_studio_validation_error.png");

  // ----------------------------------------------------
  // STEP 4: Correct Validation & Edit Quiz Explanation (Fixes #210)
  // ----------------------------------------------------
  await passMarkInput.fill("80"); // Entrust's standard: a version can't go for review at any other pass mark

  // Edit first question explanation
  const explanationTextarea = page.locator("textarea").first();
  await explanationTextarea.fill("Export readiness requires formal governance, documented trade processes, and international compliance per ICC guidelines.");

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForTimeout(1000);

  // Verify success banner appears
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();

  await maybeScreenshot(page, "55_course_studio_quiz_question_edited.png");

  // ----------------------------------------------------
  // STEP 5: Preview as Learner (Simulator)
  // ----------------------------------------------------
  await page.getByRole("button", { name: "Preview as learner" }).click();
  await expect(page.getByRole("heading", { name: "Learner View Simulator" })).toBeVisible();
  await expect(page.getByText(/Answer keys hidden/)).toBeVisible();
  await page.waitForTimeout(1000);

  await maybeScreenshot(page, "56_course_studio_learner_preview_simulator.png");

  // Close simulator
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.waitForTimeout(500);

  // ----------------------------------------------------
  // STEP 6: Submit Draft for Review
  // ----------------------------------------------------
  await page.getByRole("button", { name: "Send for review" }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText("v1.1.0 is waiting for an administrator's approval.")).toBeVisible();
  await expect(page.getByText(/^Sent for review\./)).toBeVisible();

  await maybeScreenshot(page, "57_course_studio_submitted_for_review.png");

  // ----------------------------------------------------
  // STEP 7: Super Admin Logs in & Approves Version
  // ----------------------------------------------------
  await page.context().clearCookies();
  await page.goto("http://localhost:3001/sign-in");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("http://localhost:3001/");

  await page.goto("http://localhost:3001/admin/modules/M01/editor?version=1.1.0");
  await expect(page.getByText("v1.1.0 is waiting for an administrator's approval.")).toBeVisible();

  // Click Approve
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Approve Version 1.1.0/ })).toBeVisible();

  const approveNotesTextarea = page.locator('textarea[placeholder*="Reviewed with trade advisory board"]');
  await approveNotesTextarea.fill("Reviewed with trade advisory board and approved for live production deployment.");

  await page.getByRole("button", { name: "Confirm & Approve" }).click();
  await page.waitForTimeout(2000);

  // Verify it is live, can't be edited, and offers a new draft
  await expect(page.getByText("v1.1.0 is live: this is what learners see.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a new draft" })).toBeVisible();

  await maybeScreenshot(page, "58_course_studio_approved_immutable.png");

  // ----------------------------------------------------
  // STEP 8: Learner View Verification
  // ----------------------------------------------------
  await page.context().clearCookies();
  await page.goto("http://localhost:3001/sign-in");
  await page.getByLabel("Email").fill(learnerEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("http://localhost:3001/");

  // Navigate to module M01
  await page.goto("http://localhost:3001/modules/M01");
  await expect(page.getByRole("heading", { name: /Diagnostic and Deal Selection/ })).toBeVisible();
  await expect(page.getByText(/1.1.0/)).toBeVisible();
  await page.waitForTimeout(1000);

  await maybeScreenshot(page, "59_learner_view_updated_version.png");
});
