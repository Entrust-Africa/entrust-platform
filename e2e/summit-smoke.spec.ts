import { expect, test } from "@playwright/test";

const TRADE_URL = process.env.TRADE_BASE_URL ?? "http://localhost:3001";

test("the Summit page opens without signing in, and Sign in brings a returning applicant back to the application", async ({ page }) => {
  await page.goto(`${TRADE_URL}/summit`);

  await expect(page.getByRole("heading", { level: 1, name: "Africa Diaspora Trade and Investment Summit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who can apply" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is TRADE?" })).toBeVisible();

  // The page works on a phone: nothing sticks out sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // "Sign in" is for someone who already applied, and brings them back to the application.
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsummit%2Fapply$/);
  await expect(page.getByRole("heading", { name: "Sign in to TRADE" })).toBeVisible();

  // The rest of an application is not open to a visitor who is not signed in.
  await page.goto(`${TRADE_URL}/summit/applications/00000000-0000-4000-8000-000000000000`);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsummit%2Fapplications%2F/);
});

test("a visitor who clicks to apply sees the application's first step, not a sign-in screen, and starts it by creating an account", async ({ page }) => {
  await page.goto(`${TRADE_URL}/summit/apply`);
  await expect(page).toHaveURL(/\/summit\/apply$/);
  await expect(page.getByRole("heading", { level: 1, name: "Apply to the Summit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tell us about your business" })).toBeVisible();

  // Returning applicants have a way in, but it isn't the first thing the visitor meets.
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();

  const email = `e2e-summit-apply-${Date.now()}@example.test`;
  await page.getByLabel("Business name").fill("ZEBU Coffee");
  await page.getByLabel("Country").selectOption("ET");
  await page.getByLabel("Your full name").fill("Amina Bekele");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Start my application" }).click();

  // The account is created and a confirmation link is on its way; the business is kept for when they return.
  await expect(page).toHaveURL(/\/check-email\?/);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const kept = (await page.context().cookies()).find((c) => c.name === "summit-business");
  expect(decodeURIComponent(kept?.value ?? "")).toContain("ZEBU Coffee");
});
