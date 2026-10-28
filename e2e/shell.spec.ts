import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";

test.describe("CLEAR app shell and navigation (#19)", () => {
  const password = "correct horse battery staple";

  test("unauthenticated visitors are redirected to sign-in from protected shell routes", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto("/organizations");
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("forgot password and reset password pages render responsively with patchwork and navigation", async ({
    page,
  }) => {
    // 375px mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await expect(page.getByRole("link", { name: "← Return to sign in" })).toBeVisible();

    // Verify no horizontal overflow at 375px
    const forgotScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(forgotScrollWidth).toBeLessThanOrEqual(375);

    // Reset password with missing token
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "This reset link is invalid or has expired" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "← Return to sign in" })).toBeVisible();

    const resetScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(resetScrollWidth).toBeLessThanOrEqual(375);
  });

  test("signed-in shell works at 375px, 768px, and 1440px with zero horizontal scroll and keyboard navigation", async ({
    page,
  }) => {
    // Sign in first
    const testEmail = `shell-user-flow-${Date.now()}@example.com`;
    await page.goto("/sign-in");

    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill("A Very Long Name For Shell Responsive Testing User");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/check-email\?/);

    // Verify email directly in DB
    const db = getDb();
    await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, testEmail));

    // Sign in with verified credentials
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Export cases" })).toBeVisible();

    // --- 1. Test at 1440px Desktop ---
    await page.setViewportSize({ width: 1440, height: 900 });

    // Verify zero horizontal scroll
    let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1440);

    // Desktop top bar checks
    await expect(page.getByRole("link", { name: "CLEAR Export" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Active organisation:/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cases" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Organisation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();

    // Skip to content link
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();

    // Organisation switcher dropdown opens and closes with Escape
    const orgSwitcher = page.getByRole("button", { name: /Active organisation:/ });
    await orgSwitcher.click();
    await expect(page.getByRole("link", { name: "Create organisation" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Create organisation" })).not.toBeVisible();
    await expect(orgSwitcher).toBeFocused();

    // Navigation: Go to Organisation page
    await page.getByRole("link", { name: "Organisation" }).click();
    await expect(page).toHaveURL(/\/organizations$/);
    await expect(page.getByRole("heading", { name: "Organisation settings" })).toBeVisible();

    // Navigation: Go to Account page
    await page.getByRole("link", { name: "Account" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
    await expect(page.getByText(testEmail)).toBeVisible();

    // --- 2. Test at 768px Tablet ---
    await page.setViewportSize({ width: 768, height: 1024 });
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(768);

    // Verify Account menu button is within bounds and not clipped off screen
    const accountButton = page.getByRole("button", { name: "Account menu" });
    await expect(accountButton).toBeVisible();
    const accountBox = await accountButton.boundingBox();
    expect(accountBox).not.toBeNull();
    expect(accountBox!.x + accountBox!.width).toBeLessThanOrEqual(768);

    // --- 3. Test at 375px Mobile & Drawer Keyboard Navigation ---
    await page.setViewportSize({ width: 375, height: 667 });
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);

    // Focus hamburger and open drawer with Enter key
    const mobileToggle = page.getByRole("button", { name: "Open main navigation" });
    await expect(mobileToggle).toBeVisible();
    await mobileToggle.focus();
    await expect(mobileToggle).toBeFocused();
    await page.keyboard.press("Enter");

    // Focus lands inside drawer on the close button
    const closeButton = page.getByRole("button", { name: "Close drawer" });
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toBeFocused();

    // Close drawer with Escape and verify focus returns to hamburger trigger
    await page.keyboard.press("Escape");
    await expect(closeButton).not.toBeVisible();
    await expect(mobileToggle).toBeFocused();

    // Reopen drawer via click to test link navigation
    await mobileToggle.click();
    await expect(closeButton).toBeVisible();
    const mobileCases = page.getByRole("link", { name: "Cases" }).last();
    await expect(mobileCases).toBeVisible();
    await mobileCases.click();

    await expect(page).toHaveURL(/\/$/);
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});
