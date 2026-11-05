import { expect, test } from "@playwright/test";

// The Summit landing page is public and runs on its own app (and, in production, its own domain).
test("the Summit landing page loads without signing in and sends buyers and sellers to the application", async ({ page }) => {
  const response = await page.goto("http://localhost:3002/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Black-owned business meets the world");
  await expect(page.getByRole("heading", { name: "Two ways to take part" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Tickets" })).toHaveAttribute("href", "#tickets");

  const buyerSeller = page.getByRole("link", { name: /Register as a buyer \/ seller/ });
  await expect(buyerSeller).toHaveAttribute("href", /\/summit\/apply$/);
});

test("the page names the host, the Pan African Chamber of Commerce and Industry", async ({ page }) => {
  await page.goto("http://localhost:3002/");
  const logos = page.getByRole("img", { name: "Pan African Chamber of Commerce and Industry" });
  await expect(logos.first()).toBeVisible();
  // The hero and the footer each carry it, and the picture really loads.
  await expect(logos).toHaveCount(2);
  expect(await logos.first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("a ticket button opens the registration form with the chosen pass, and Escape closes it", async ({ page }) => {
  await page.goto("http://localhost:3002/");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Get Investor Pass" }).click();
  const dialog = page.getByRole("dialog", { name: "Register to attend" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Pass")).toHaveValue("investor");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // The generic button opens the same form with no pass chosen.
  await page.getByRole("button", { name: /Register as a participant/ }).click();
  await expect(dialog.getByLabel("Pass")).toHaveValue("");
});

test("a visitor can register to attend, and the registration is confirmed with a reference", async ({ page }) => {
  await page.goto("http://localhost:3002/");
  await page.getByRole("button", { name: "Get Diaspora Pass" }).click();
  const dialog = page.getByRole("dialog", { name: "Register to attend" });

  // The browser's own validation stops an empty form before anything is sent.
  await dialog.getByRole("button", { name: "Register", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "You're registered" })).toBeHidden();

  const email = `e2e-summit-${Date.now()}@example.test`;
  await dialog.getByLabel("Full name").fill("Amina Bekele");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Organisation").fill("ZEBU Coffee");
  await dialog.getByLabel("Job title").fill("Export manager");
  await dialog.getByLabel("Country you are based in").selectOption("ET");
  await dialog.getByLabel(/I agree that/).check();
  await dialog.getByRole("button", { name: "Register", exact: true }).click();

  await expect(dialog.getByRole("heading", { name: "You're registered" })).toBeVisible();
  await expect(dialog).toContainText("Diaspora Pass");
  await expect(dialog).toContainText(email);
  await expect(dialog).toContainText(/Reference DTS-\d{5}/);
});
