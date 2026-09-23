import { chromium } from 'playwright-core';
import '../../server/src/config/env.js';
import { prisma } from '../../server/src/db/prisma.js';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
let taskId;
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('response', async (response) => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/tasks' && response.ok()) {
      taskId = (await response.json()).task.id;
    }
  });
  await page.goto(process.env.TEST_BASE_URL, { waitUntil: 'networkidle' });
  await page.locator('canvas').waitFor();
  await page.locator('#task-idea').fill('Хотим сократить время обработки заказов в нашей сети магазинов.');
  await page.locator('#task-idea').press('Enter');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'client/screenshots/rocket-launch.png' });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'client/screenshots/rocket-turn.png' });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'client/screenshots/rocket-arrival.png' });
  await page.locator('.workspace-overlay').waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'client/screenshots/planet-system.png', style: '.workspace-overlay, .experience-header { visibility: hidden !important; } .experience::after { display: none !important; }' });
  await page.screenshot({ path: 'client/screenshots/ai-workspace.png' });
  console.log('Captured five desktop views.');
} finally {
  await browser.close();
  if (taskId) await prisma.task.deleteMany({ where: { id: taskId } });
  await prisma.$disconnect();
}
