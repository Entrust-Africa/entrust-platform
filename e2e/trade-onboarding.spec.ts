import { expect, test } from "@playwright/test";

const TRADE = process.env.TRADE_BASE_URL ?? "http://localhost:3001";

// SMEs filling in the public diagnostic wrote that the money questions took no typing (12 Nov 2026). The currency
// picker beside the amount had grown to the full width of the row and squeezed the amount box to nothing, so what they
// typed went in unseen. This checks the box is there to read, on a phone and on a computer.
test("an amount typed into the public diagnostic shows in a box wide enough to read", async ({ page }) => {
  await page.goto(`${TRADE}/onboarding`);
  await page.getByLabel("Business name").fill("Amount Field Exporters");
  await page.getByLabel("Your email address").fill(`e2e-onboarding-${Date.now()}@example.test`);
  await page.getByLabel("Phone number").fill("+251 91 123 4567");
  await page.getByRole("button", { name: "Start the diagnostic" }).click();
  await page.waitForURL(/\/onboarding\/[^/?]+$/);

  await page.getByRole("button", { name: /Financial readiness and bankability/ }).click();
  await expect(page.getByRole("heading", { name: "Financial readiness and bankability" })).toBeVisible();

  const amount = page.locator("#field-Q47");
  const currency = amount.locator("xpath=following-sibling::select");
  for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    await amount.fill("");
    await amount.pressSequentially("1500000");
    await expect(amount).toHaveValue("1500000");

    const box = await amount.boundingBox();
    const picker = await currency.boundingBox();
    expect(box?.width ?? 0, `amount box at ${viewport.width}px wide`).toBeGreaterThan(150);
    expect(picker?.width ?? Infinity, `currency picker at ${viewport.width}px wide`).toBeLessThan(box?.width ?? 0);
    // Nothing on the page sticks out sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
