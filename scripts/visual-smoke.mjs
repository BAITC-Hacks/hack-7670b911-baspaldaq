import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import "../server/src/config/env.js";
import { prisma } from "../server/src/db/prisma.js";

const baseUrl = process.env.TEST_BASE_URL;
if (!baseUrl) throw new Error("TEST_BASE_URL is required");
if (!["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname)) throw new Error("UI smoke test only runs against a local server");

const executablePath = process.env.BROWSER_EXECUTABLE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const screenshots = resolve("client/screenshots");
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
let createdTaskId;
let createdTeamId;

try {
  const published = await fetch(`${baseUrl}/api/tasks?published=true`).then((response) => response.json());
  assert.ok(published.tasks?.length, "A published task is required for the visual smoke test");
  const taskId = published.tasks[0].id;

  for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (name === "desktop") {
      await page.goto(`${baseUrl}/business/new`, { waitUntil: "networkidle" });
      await page.locator("#task-idea").waitFor();
      await page.screenshot({ path: resolve(screenshots, "desktop-home.png"), fullPage: true });
    }
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
    await page.goto(`${baseUrl}/business/tasks/${taskId}`, { waitUntil: "networkidle" });
    await page.locator(".workspace-overlay").waitFor();
    await page.screenshot({ path: resolve(screenshots, `${name}-conversation.png`), fullPage: true });
    if (name === "desktop") {
      await page.goto(`${baseUrl}/business/tasks/${taskId}/proposals`, { waitUntil: "networkidle" });
      await page.locator(".market-proposal").first().waitFor();
      await page.screenshot({ path: resolve(screenshots, "desktop-proposals.png"), fullPage: true });
    }
    assert.deepEqual(errors, [], `${name} console errors`);
    await page.close();
  }

  const draftResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "Нужно понятнее распределять входящие заявки между сотрудниками." }),
  });
  assert.equal(draftResponse.status, 201);
  createdTaskId = (await draftResponse.json()).task.id;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${baseUrl}/business/tasks/${createdTaskId}`, { waitUntil: "networkidle" });
  await page.locator(".task-editor summary").click();
  const conversationBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(250);
  const conversationAfter = await page.evaluate(() => window.scrollY);
  assert.ok(conversationAfter > conversationBefore, "Long conversation does not scroll with mouse wheel");
  await page.goto(`${baseUrl}/business/tasks/${createdTaskId}/review`, { waitUntil: "networkidle" });
  await page.getByLabel("Название").fill("Распределение входящих заявок");
  await page.getByLabel("Потребность").fill("Распределять входящие заявки между сотрудниками без потерь.");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await page.getByText("Изменения сохранены. Оценка пересчитана.").waitFor();
  await page.getByRole("button", { name: "Подтвердить карточку" }).click();
  await page.getByText("Карточка подтверждена вами.").waitFor();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.getByText("Карточка опубликована и доступна командам в каталоге.").waitFor();
  await page.goto(`${baseUrl}/team`, { waitUntil: "networkidle" });
  await page.getByLabel("Название команды").fill("Проверка полного сценария");
  await page.getByRole("button", { name: "Создать команду" }).click();
  await page.getByText("Профиль команды сохранён.").waitFor();
  createdTeamId = await page.evaluate(() => localStorage.getItem("baspaldaq:team-id"));
  assert.ok(createdTeamId);
  await page.goto(`${baseUrl}/tasks/${createdTaskId}/proposal`, { waitUntil: "networkidle" });
  await page.getByLabel("Идея решения").fill("Единая очередь заявок с ответственным и понятным статусом.");
  await page.getByLabel("План работы").fill("Изучить процесс, сделать прототип и проверить на тестовых заявках.");
  await page.getByLabel("Сроки").fill("Три недели");
  await page.getByLabel("Ссылка на прототип").fill("https://example.org/test-prototype");
  await page.getByRole("button", { name: "Отправить предложение" }).click();
  await page.getByRole("heading", { name: "Предложение отправлено" }).waitFor();
  await page.goto(`${baseUrl}/business/tasks/${createdTaskId}/proposals`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Принять" }).click();
  await page.getByText("Принято").waitFor();
  await page.getByLabel("Команда").selectOption(createdTeamId);
  await page.getByLabel("Название этапа").fill("Прототип согласован");
  await page.getByRole("button", { name: "Добавить этап" }).click();
  await page.getByText("Прототип согласован").waitFor();
  await page.getByRole("button", { name: "Подтвердить этап" }).click();
  await page.getByText("Подтверждено, +10 баллов").waitFor();
  await page.close();
} finally {
  await browser.close();
  if (createdTaskId) await prisma.task.deleteMany({ where: { id: createdTaskId } });
  if (createdTeamId) await prisma.team.deleteMany({ where: { id: createdTeamId } });
  await prisma.$disconnect();
}
console.log(`Visual smoke passed. Screenshots: ${screenshots}`);
