import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
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

  // Clean up any existing 1.1.0 version for clean test run
  await db.delete(schema.moduleContentVersion).where(eq(schema.moduleContentVersion.version, "1.1.0"));

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
  await expect(page.getByRole("heading", { name: "Course Content Studio" })).toBeVisible();
  await expect(page.getByText("Curriculum Modules")).toBeVisible();
  await page.waitForTimeout(1000);

  await maybeScreenshot(page, "51_course_studio_catalog.png");

  // ----------------------------------------------------
  // STEP 2: Create a new draft version for M01
  // ----------------------------------------------------
  // Find M01 card and click New Draft Version
  const m01Card = page.locator("div").filter({ hasText: /^M01/ }).first();
  await page.getByRole("button", { name: "New Draft Version" }).first().click();

  // Modal opens
  await expect(page.getByRole("heading", { name: /New Draft Version for M01/ })).toBeVisible();
  const targetVersionInput = page.locator('input[placeholder*="1.1.0"]');
  await targetVersionInput.fill("1.1.0");

  const notesTextarea = page.locator('textarea[placeholder*="Describe what is being changed"]');
  await notesTextarea.fill("Clarified quiz question explanations per #210 and improved lesson guidance");

  await maybeScreenshot(page, "52_course_studio_create_draft_modal.png");

  await page.getByRole("button", { name: "Create Draft" }).click();
  await page.waitForTimeout(1500);

  // Navigate to the editor for the new 1.1.0 draft
  await page.goto("http://localhost:3001/admin/modules/M01/editor?version=1.1.0");
  await expect(page.getByRole("heading", { name: /Diagnostic and Deal Selection/ })).toBeVisible();
  await expect(page.getByText(/v1.1.0 \(DRAFT\)/)).toBeVisible();

  await maybeScreenshot(page, "53_course_studio_draft_editor.png");

  // ----------------------------------------------------
  // STEP 3: Test Real-time Validation Error (Pass Mark > 100)
  // ----------------------------------------------------
  await page.getByRole("button", { name: /Knowledge Check Quiz/ }).click();
  await page.waitForTimeout(500);

  const passMarkInput = page.locator('input[type="number"]').first();
  await passMarkInput.fill("150"); // Invalid! Must be <= 100

  // Click Save Draft
  await page.getByRole("button", { name: "Save Draft" }).click();
  await page.waitForTimeout(1000);

  // Verify Validation Error banner appears
  await expect(page.getByText("Validation Error")).toBeVisible();
  await expect(page.getByText(/passMark/)).toBeVisible();

  await maybeScreenshot(page, "54_course_studio_validation_error.png");

  // ----------------------------------------------------
  // STEP 4: Correct Validation & Edit Quiz Explanation (Fixes #210)
  // ----------------------------------------------------
  await passMarkInput.fill("85"); // Valid pass mark

  // Edit first question explanation
  const explanationTextarea = page.locator("textarea").first();
  await explanationTextarea.fill("Export readiness requires formal governance, documented trade processes, and international compliance per ICC guidelines.");

  await page.getByRole("button", { name: "Save Draft" }).click();
  await page.waitForTimeout(1000);

  // Verify success banner appears
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();

  await maybeScreenshot(page, "55_course_studio_quiz_question_edited.png");

  // ----------------------------------------------------
  // STEP 5: Preview as Learner (Simulator)
  // ----------------------------------------------------
  await page.getByRole("button", { name: "Preview as Learner" }).click();
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
  await page.getByRole("button", { name: "Submit for Review" }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText(/v1.1.0 \(IN_REVIEW\)/)).toBeVisible();
  await expect(page.getByText("Draft successfully submitted for review!")).toBeVisible();

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
  await expect(page.getByText(/v1.1.0 \(IN_REVIEW\)/)).toBeVisible();

  // Click Approve Version
  await page.getByRole("button", { name: "Approve Version" }).click();
  await expect(page.getByRole("heading", { name: /Approve Version 1.1.0/ })).toBeVisible();

  const approveNotesTextarea = page.locator('textarea[placeholder*="Reviewed with trade advisory board"]');
  await approveNotesTextarea.fill("Reviewed with trade advisory board and approved for live production deployment.");

  await page.getByRole("button", { name: "Confirm & Approve" }).click();
  await page.waitForTimeout(2000);

  // Verify status is APPROVED and immutability notice is shown
  await expect(page.getByText(/v1.1.0 \(APPROVED\)/)).toBeVisible();
  await expect(page.getByText("Approved Version is Frozen & Immutable")).toBeVisible();
  await expect(page.getByText("Branch New Draft")).toBeVisible();

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
