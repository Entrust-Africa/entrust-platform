import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";

const MIZAN = process.env.MIZAN_BASE_URL ?? "http://localhost:3003";

test("a visitor who isn't signed in goes to MIZAN's sign-in, which fits on a phone", async ({ page }) => {
  await page.goto(`${MIZAN}/`);
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in to MIZAN" }).first()).toBeVisible();

  await page.goto(`${MIZAN}/methodology`);
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("someone with no MIZAN access is told so, and an SME given MIZAN sees its reports area and MIZAN in the switcher", async ({ page }) => {
  const email = `playwright-mizan-${Date.now()}@example.com`;
  const password = "correct horse battery staple";
  const orgId = `mizan-smoke-org-${Date.now()}`;
  const db = getDb();

  try {
    await page.goto(`${MIZAN}/sign-in`);
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill("Mizan Smoke User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/check-email\?/);

    const [user] = await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email)).returning();
    await db.insert(schema.organization).values({ id: orgId, name: "Mizan Smoke Traders", slug: orgId, createdAt: new Date(), metadata: JSON.stringify({ kind: "sme" }) });
    await db.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: orgId, userId: user!.id, role: "owner", createdAt: new Date() });
    await db.insert(schema.platformAccess).values({ organizationId: orgId, platform: "trade", grantedBy: user!.id });

    await page.goto(`${MIZAN}/sign-in`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "You don't have access to MIZAN" })).toBeVisible();

    await db.insert(schema.platformAccess).values({ organizationId: orgId, platform: "mizan", grantedBy: user!.id });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your reports" })).toBeVisible();
    await expect(page.getByText("Mizan Smoke Traders")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Methodology" })).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("link", { name: "MIZAN", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "TRADE", exact: true })).toBeVisible();
  } finally {
    await db.delete(schema.platformAccess).where(eq(schema.platformAccess.organizationId, orgId));
    await db.delete(schema.member).where(eq(schema.member.organizationId, orgId));
    await db.delete(schema.organization).where(eq(schema.organization.id, orgId));
    const [row] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
    if (row) {
      await db.delete(schema.session).where(eq(schema.session.userId, row.id));
      await db.delete(schema.user).where(eq(schema.user.id, row.id));
    }
  }
});
