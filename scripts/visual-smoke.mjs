import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.TEST_BASE_URL;
if (!baseUrl) throw new Error("TEST_BASE_URL is required");

const executablePath = process.env.BROWSER_EXECUTABLE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const screenshots = resolve("client/screenshots");
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });

try {
  const published = await fetch(`${baseUrl}/api/tasks?published=true`).then((response) => response.json());
  assert.ok(published.tasks?.length, "A published task is required for the visual smoke test");
  const taskId = published.tasks[0].id;

  for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/catalog`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Каталог задач" }).waitFor();
    await page.screenshot({ path: resolve(screenshots, `${name}-catalog.png`), fullPage: true });
    await page.goto(`${baseUrl}/tasks/${taskId}`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Подать предложение" }).waitFor();
    await page.screenshot({ path: resolve(screenshots, `${name}-task.png`), fullPage: true });
    await page.goto(`${baseUrl}/business/tasks/${taskId}/review`, { waitUntil: "networkidle" });
    await page.getByText("ПОЛНОТА ЗАДАЧИ").waitFor();
    await page.screenshot({ path: resolve(screenshots, `${name}-review.png`), fullPage: true });
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(horizontalOverflow, false, `${name} review has horizontal overflow`);
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => window.scrollY);
    assert.ok(after > before, `${name} review does not scroll with mouse wheel`);
    assert.deepEqual(errors, [], `${name} console errors`);
    await page.close();
  }
  console.log(`Visual smoke passed. Screenshots: ${screenshots}`);
} finally {
  await browser.close();
}
