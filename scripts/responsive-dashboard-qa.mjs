import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.QA_ORIGIN ?? "https://kiwi-router.vercel.app";
const founderEmail = process.env.QA_FOUNDER_EMAIL;
const founderPassword = process.env.FOUNDER_BOOTSTRAP_PASSWORD;
const outputDir = "/home/ubuntu/screenshots/kiwi-router-dashboard-qa";
const routes = [
  ["overview", "/app"],
  ["playground", "/app/playground"],
  ["models", "/app/models"],
  ["api-keys", "/app/api-keys"],
  ["analytics", "/app/analytics"],
  ["admin", "/app/admin"],
];

if (!founderEmail || !founderPassword) throw new Error("QA_FOUNDER_EMAIL and FOUNDER_BOOTSTRAP_PASSWORD are required for dashboard QA.");

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 375, height: 812 }]]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${origin}/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Email").fill(founderEmail);
  await page.getByPlaceholder("Password").fill(founderPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app/, { timeout: 20_000 });

  for (const [name, path] of routes) {
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const screenshot = `${outputDir}/${label}-${name}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    results.push({ viewport: label, route: path, finalUrl: page.url(), screenshot, bodyPreview: body.slice(0, 220) });
  }
  await context.close();
}

await browser.close();
await writeFile(`${outputDir}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
