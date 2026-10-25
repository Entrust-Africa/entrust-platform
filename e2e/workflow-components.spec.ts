import { expect, test } from "@playwright/test";

test.describe("Workflow components on /design (#20)", () => {
  test("renders all 6 workflow components and verifies responsive viewports at 375px, 768px, and 1440px", async ({
    page,
  }) => {
    // Navigate to design showcase
    await page.goto("/design");
    await expect(page).toHaveTitle(/Design system/);

    // Verify all 6 component section headings are present
    await expect(page.getByRole("heading", { name: "1. Case Header" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Phase Stepper" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Step Row" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "4. Evidence Item" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "5. Gate Summary Card" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "6. Flag Banner" })).toBeVisible();

    // Verify specific component elements
    // 1. Case Header: Reference and parties
    await expect(page.getByText("CLR-ET-2026-000145")).toBeVisible();
    await expect(page.getByRole("heading", { name: "ZEBU Coffee Exporters" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Artisan Coffee Roasters USA" })).toBeVisible();

    // 2. Step Row: In progress, blocked, and overdue items
    await expect(
      page.getByText("Submit export permit application to commercial bank", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Blocked: Awaiting commercial bank verification of deposit prior to permit clearance."),
    ).toBeVisible();
    await expect(page.getByText(/Overdue: 24 Oct 2026/)).toBeVisible();

    // 3. Evidence Item: Approved and changes required
    await expect(page.getByText("Commercial Invoice (Signed & Stamped)")).toBeVisible();
    await expect(page.getByText("Reviewer feedback", { exact: true })).toBeVisible();
    await expect(
      page.getByText("The consignment net weight on line 4 (18,400 kg) does not reconcile with the bill of lading manifest (19,200 kg)."),
    ).toBeVisible();

    // 4. Gate Summary Card: Counter and progress
    await expect(page.getByText("Milestone Gate · Phase 3")).toBeVisible();
    await expect(page.getByText("14 of 18 steps completed")).toBeVisible();
    await expect(page.getByText("78%")).toBeVisible();

    // 5. Flag Banner: Critical, High, and Medium alerts
    await expect(page.getByText("FL-02")).toBeVisible();
    await expect(page.getByText("Destination port regulatory trade sanction")).toBeVisible();
    await expect(page.getByText("STEP-024")).toBeVisible();

    // 6. Loading & Error States
    await expect(page.getByLabel("Loading case header")).toBeVisible();
    await expect(page.getByLabel("Loading phases")).toBeVisible();
    await expect(page.getByText("Failed to fetch case header details. Please refresh.")).toBeVisible();
    await expect(page.getByText("Unable to load phase sequence from engine.")).toBeVisible();

    // --- Viewport Check: 1440px Desktop ---
    await page.setViewportSize({ width: 1440, height: 900 });
    let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1440);

    // --- Viewport Check: 768px Tablet ---
    await page.setViewportSize({ width: 768, height: 1024 });
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(768);

    // --- Viewport Check: 375px Mobile ---
    await page.setViewportSize({ width: 375, height: 667 });
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });

  test("supports keyboard navigation and interactive phase selection", async ({ page }) => {
    await page.goto("/design");

    // Interactive PhaseStepper check
    const phase2Button = page.getByRole("button", { name: /Phase 2: Buyer contracting/ });
    await expect(phase2Button).toBeVisible();

    // Click Phase 2 to change active phase
    await phase2Button.click();
    await expect(page.getByText("Interactive Stepper (Active: Phase 2)")).toBeVisible();

    // Test keyboard selection on Phase 4
    const phase4Button = page.getByRole("button", { name: /Phase 4: Sourcing, processing/ });
    await phase4Button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Interactive Stepper (Active: Phase 4)")).toBeVisible();

    // Verify retry button on error state is focusable and clickable
    const retryButton = page.getByRole("button", { name: "Retry" }).first();
    await expect(retryButton).toBeVisible();
    await retryButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Interactive Stepper (Active: Phase 3)")).toBeVisible();
  });
});
