import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('docs/screenshots', { recursive: true });
mkdirSync('public/screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

const BASE = 'http://localhost:3001';

async function shot(url, name) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  await page.screenshot({ path: `public/screenshots/${name}.png` });
  console.log(`✓ ${name}`);
}

await shot('/', 'home');
await shot('/matches', 'matches');
await shot('/streamers', 'streamers');

await browser.close();
