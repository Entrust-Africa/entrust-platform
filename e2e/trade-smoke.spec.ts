import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";

test("a session started on CLEAR is signed in on TRADE, and TRADE opens with role-based navigation", async ({ page }) => {
  const email = `playwright-trade-${Date.now()}@example.com`;
  const password = "correct horse battery staple";
  const orgId = `trade-smoke-org-${Date.now()}`;

  // 1. Sign up on CLEAR
  await page.goto("http://localhost:3000/");
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Trade Smoke User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/check-email\?/);

  // 2. Verify email and set up organization with clear and trade platform access
  const db = getDb();
  const [userRow] = await db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.email, email))
    .returning();

  if (userRow) {
    await db.insert(schema.organization).values({
      id: orgId,
      name: "Trade Smoke Exporters",
      slug: orgId,
      createdAt: new Date(),
      metadata: JSON.stringify({ kind: "sme" }),
    });
    await db.insert(schema.member).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: userRow.id,
      role: "owner",
      createdAt: new Date(),
    });
    await db.insert(schema.platformAccess).values([
      { organizationId: orgId, platform: "clear", grantedBy: userRow.id },
      { organizationId: orgId, platform: "trade", grantedBy: userRow.id },
    ]);
  }

  // 3. Sign in on CLEAR
  await page.goto("http://localhost:3000/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // 4. Navigate to TRADE (http://localhost:3001/) using the shared session
  await page.goto("http://localhost:3001/");
  await expect(page).toHaveURL("http://localhost:3001/");

  // 5. Verify TRADE shell and role-based navigation are visible
  await expect(page.getByRole("heading", { name: "My Learning Plan" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main Navigation" });
  await expect(nav.getByRole("link", { name: "Modules" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Portfolio" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Pipeline" })).toBeVisible();

  // 6. Verify platform switcher in account menu
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("link", { name: "CLEAR" })).toBeVisible();
  await expect(page.getByRole("link", { name: "TRADE" })).toBeVisible();

  // Cleanup database
  await db.delete(schema.platformAccess).where(eq(schema.platformAccess.organizationId, orgId));
  await db.delete(schema.member).where(eq(schema.member.organizationId, orgId));
  await db.delete(schema.organization).where(eq(schema.organization.id, orgId));
  if (userRow) {
    await db.delete(schema.session).where(eq(schema.session.userId, userRow.id));
    await db.delete(schema.user).where(eq(schema.user.id, userRow.id));
  }
});
