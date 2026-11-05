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

test("a ticket button opens the registration dialog with the chosen pass, and Escape closes it", async ({ page }) => {
  await page.goto("http://localhost:3002/");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Get Investor Pass" }).click();
  const dialog = page.getByRole("dialog", { name: "Register to attend" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Investor Pass");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: /Register as a participant/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Participant registration");
});
