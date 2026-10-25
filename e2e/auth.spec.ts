import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";

test("a user can sign up, is blocked when unverified, verifies email, and can sign in and sign out", async ({ page }) => {
  const email = `playwright-${Date.now()}@example.com`;
  const password = "correct horse battery staple";

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);

  // 1. Sign up
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Playwright User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/check-email\?/);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // 2. Return to sign-in and assert that unverified sign-in is blocked
  await page.getByRole("link", { name: "Return to sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in to CLEAR" })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Please verify your email address before signing in.")).toBeVisible();

  // 3. Verify user's email in the database (simulating email verification completion)
  const db = getDb();
  await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email));

  // 4. Visit email verified confirmation screen
  await page.goto("/email-verified");
  await expect(page).toHaveURL(/\/email-verified$/);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();

  // 5. Continue to sign in
  await page.getByRole("link", { name: "Continue to sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  // 6. Sign in with verified credentials
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Export cases" })).toBeVisible();

  // 7. Sign out and confirm redirection
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
