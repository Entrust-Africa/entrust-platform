import { expect, test } from "@playwright/test";

// The ADTIS site is public and runs on its own app (and, in production, its own domain). These checks hold whether or not
// an edition has been set up: the commercial pages then say they open soon instead of showing packages.
const SITE = "http://localhost:3002";

test("the landing page loads without signing in, leads with the ADTIS headline and keeps SME registration separate", async ({ page }) => {
  const response = await page.goto(`${SITE}/`);
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Connecting Africa and its global diaspora");

  // EXHIBIT | SPONSOR | PARTICIPATE is one item of the main navigation, each word a link.
  const nav = page.getByRole("navigation", { name: "Main" });
  const group = nav.getByRole("group", { name: "Exhibit, sponsor or participate" });
  await expect(group.getByRole("link", { name: "Exhibit" })).toHaveAttribute("href", "/exhibit");
  await expect(group.getByRole("link", { name: "Sponsor" })).toHaveAttribute("href", "/sponsor");
  await expect(group.getByRole("link", { name: "Participate" })).toHaveAttribute("href", "/participate");

  // The SME application is TRADE's, not a form on this site.
  await expect(page.getByRole("link", { name: /Register as an SME/ })).toHaveAttribute("href", /\/summit\/apply$/);
  await expect(page.getByRole("link", { name: /Register as a buyer or investor/ })).toHaveAttribute("href", /category=investor-buyer/);
});

test("the page says January 2027 with dates to be announced, and never an October date", async ({ page }) => {
  await page.goto(`${SITE}/`);
  const text = await page.locator("body").innerText();
  expect(text).toMatch(/January 2027/);
  expect(text).toMatch(/to be announced/i);
  expect(text).not.toMatch(/October/i);
});

test("the page names the host, the Pan African Chamber of Commerce", async ({ page }) => {
  await page.goto(`${SITE}/`);
  const logos = page.getByRole("img", { name: "Pan African Chamber of Commerce", exact: true });
  await expect(logos.first()).toBeVisible();
  // The hero and the footer each carry it, and the picture really loads.
  await expect(logos).toHaveCount(2);
  expect(await logos.first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

for (const path of ["/exhibit", "/exhibit/apply", "/sponsor", "/sponsor/enquire", "/participate", "/participate/register", "/smes"]) {
  test(`${path} loads without signing in and has a heading`, async ({ page }) => {
    const response = await page.goto(`${SITE}${path}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Every page has the same header with the commercial navigation.
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Participate" })).toBeVisible();
  });
}

test("a badge or a business that doesn't exist is a 404, not an error", async ({ page }) => {
  expect((await page.goto(`${SITE}/badge/AAAAAAAAAAAAAAAAAAAAAAAA`))?.status()).toBe(404);
  expect((await page.goto(`${SITE}/smes/no-such-business`))?.status()).toBe(404);
});

test("the pages fit a phone: nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/exhibit", "/sponsor", "/participate", "/participate/register", "/smes"]) {
    await page.goto(`${SITE}${path}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
