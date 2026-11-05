import { expect, test } from "@playwright/test";

const TRADE_URL = process.env.TRADE_BASE_URL ?? "http://localhost:3001";

test("the Summit page opens without signing in, and a visitor who wants to apply is sent to sign in and back", async ({ page }) => {
  await page.goto(`${TRADE_URL}/summit`);

  await expect(page.getByRole("heading", { level: 1, name: "Africa Diaspora Trade and Investment Summit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who can apply" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is TRADE?" })).toBeVisible();

  // The page works on a phone: nothing sticks out sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Applying needs an account. The sign-in page remembers where the visitor was headed.
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsummit%2Fapply$/);
  await expect(page.getByRole("heading", { name: "Sign in to TRADE" })).toBeVisible();

  // The application itself is not open to a visitor who is not signed in.
  await page.goto(`${TRADE_URL}/summit/apply`);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsummit%2Fapply$/);
});
