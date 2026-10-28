import { expect, test } from "@playwright/test";

test.describe("Workflow components on /design (#20)", () => {
  test("renders all workflow components, empty states, and foundation sections responsively starting at 375px", async ({
    page,
  }) => {
    // 1. Mobile viewport 375px first
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to design showcase
    await page.goto("/design");
    await expect(page).toHaveTitle(/Design system/);

    // Verify all 7 component section headings are present
    await expect(page.getByRole("heading", { name: "1. Case Header" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Phase Stepper" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Step Row" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "4. Evidence Item" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "5. Gate Summary Card" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "6. Flag Banner" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "7. Empty State Primitive" })).toBeVisible();

    // Verify restored foundation sections are present
    await expect(page.getByRole("heading", { name: "Design Foundations · Colour" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Design Foundations · Type" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Design Foundations · Buttons" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Design Foundations · Fields" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Design Foundations · Statuses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Design Foundations · Case card" })).toBeVisible();

    // Verify specific component elements
    // 1. Case Header: Reference and unified parties heading
    await expect(page.getByText("CLR-ET-2026-000145", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /ZEBU Coffee Exporters to Artisan Coffee Roasters USA/i }),
    ).toBeVisible();

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
      page.getByText(
        "The consignment net weight on line 4 (18,400 kg) does not reconcile with the bill of lading manifest (19,200 kg).",
      ),
    ).toBeVisible();
    // Issued / Valid Until metadata check
    await expect(page.getByText(/Issued:\s*12 Oct 2026/)).toBeVisible();
    await expect(page.getByText(/Valid until:\s*12 Nov 2026/)).toBeVisible();

    // 4. Gate Summary Card: Counter and progress
    await expect(page.getByText("Milestone Gate · Phase 3")).toBeVisible();
    await expect(page.getByText("14 of 18 steps completed")).toBeVisible();
    await expect(page.getByText("78%")).toBeVisible();

    // 5. Flag Banner: Critical, High, and Medium alerts
    await expect(page.getByText("FL-02", { exact: true })).toBeVisible();
    await expect(page.getByText("Destination port regulatory trade sanction")).toBeVisible();
    await expect(page.getByText("STEP-024", { exact: true })).toBeVisible();

    // 6. Empty States across workflow components
    await expect(page.getByText("No phases available.")).toBeVisible();
    await expect(page.getByText("No compliance steps configured")).toBeVisible();
    await expect(page.getByText("No documents uploaded")).toBeVisible();
    await expect(page.getByText("No active compliance flags")).toBeVisible();
    await expect(page.getByText("No records found")).toBeVisible();

    // 7. Loading & Error States
    await expect(page.getByLabel("Loading case header")).toBeVisible();
    await expect(page.getByLabel("Loading phases")).toBeVisible();
    await expect(page.getByText("Failed to fetch case header details. Please refresh.")).toBeVisible();
    await expect(page.getByText("Unable to load phase sequence from engine.")).toBeVisible();

    // --- Bounding Box / Overflow Check helper ---
    const assertNoHorizontalOverflow = async (viewportName: string) => {
      const overflowingElements = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll("main section"));
        const bad: string[] = [];
        for (const s of sections) {
          const rect = s.getBoundingClientRect();
          // Subpixel tolerance +1px
          if (rect.right > window.innerWidth + 1) {
            bad.push(s.querySelector("h2, h3")?.textContent?.trim() ?? "unnamed section");
          }
        }
        return bad;
      });
      expect(
        overflowingElements,
        `Expected no horizontal section overflow at ${viewportName}`,
      ).toEqual([]);
    };

    // Assert bounding box containment at 375px mobile
    await assertNoHorizontalOverflow("375px mobile");

    // --- Viewport Check: 768px Tablet ---
    await page.setViewportSize({ width: 768, height: 1024 });
    await assertNoHorizontalOverflow("768px tablet");

    // --- Viewport Check: 1440px Desktop ---
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow("1440px desktop");
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
