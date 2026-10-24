import { expect, test } from "@playwright/test";

test("a user can sign up, sign out, sign in, and is redirected when signed out", async ({ page }) => {
  const email = `playwright-${Date.now()}@example.com`;
  const password = "correct horse battery staple";

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Playwright User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Export cases" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in to CLEAR" })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Export cases" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
