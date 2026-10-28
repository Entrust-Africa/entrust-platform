import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";

test.describe("Platform audit log viewer (#21)", () => {
  test("SME users receive 403 Access Denied and layout is responsive across viewports", async ({
    page,
  }) => {
    // 1. Mobile viewport 375px first
    await page.setViewportSize({ width: 375, height: 667 });

    const email = `sme-audit-${Date.now()}@example.com`;
    const password = "correct horse battery staple";

    // Sign up a user
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill("SME Audit Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/check-email\?/);

    // Verify email directly in DB
    const db = getDb();
    await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email));

    // Sign in
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);

    // 2. Navigate to /audit as SME user
    await page.goto("/audit");

    // 3. Assert SME user gets 403 Access Denied
    const accessDeniedHeading = page.getByRole("heading", { name: /Access Denied \(403\)/i });
    await expect(accessDeniedHeading).toBeVisible();

    await expect(
      page.getByText(/The platform audit trail is restricted exclusively to Entrust staff/i),
    ).toBeVisible();

    const returnLink = page.getByRole("link", { name: /Return to Cases/i });
    await expect(returnLink).toBeVisible();

    // 4. Bounding-box horizontal containment check on 375px mobile
    const assertNoHorizontalOverflow = async (viewportName: string) => {
      const overflowingElements = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll("main, section, div"));
        const bad: string[] = [];
        for (const s of sections) {
          const rect = s.getBoundingClientRect();
          // 1px subpixel tolerance
          if (rect.right > window.innerWidth + 1) {
            bad.push(s.tagName + (s.id ? `#${s.id}` : "") + (s.className ? `.${s.className.split(" ")[0]}` : ""));
          }
        }
        return bad;
      });
      expect(overflowingElements, `Expected no horizontal overflow at ${viewportName}`).toEqual([]);
    };

    await assertNoHorizontalOverflow("375px mobile");

    // 5. Check tablet viewport (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await assertNoHorizontalOverflow("768px tablet");

    // 6. Check desktop viewport (1440px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow("1440px desktop");

    // 7. Test return to cases action link
    await returnLink.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
