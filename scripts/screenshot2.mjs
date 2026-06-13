import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

const BASE = 'http://localhost:3001';

// 스트리머 프로필 — /streamers 접속 후 첫 번째 카드 클릭
await page.goto(BASE + '/streamers', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(3000);

// cursor:pointer 를 가진 div 중 스트리머 카드 (첫 번째)
const cards = page.locator('div[style*="cursor: pointer"]');
await cards.first().click();
await page.waitForURL(/\/streamers\/.+/, { timeout: 10000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'public/screenshots/streamer-profile.png' });
console.log('✓ streamer-profile', page.url());

// 경기 입력 — DEV 관리자 로그인 후 /matches/new
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(2000);

// DEV 관리자 버튼 클릭
const devBtn = page.getByText('DEV 관리자');
if (await devBtn.isVisible()) {
  await devBtn.click();
  await page.waitForTimeout(2000);
  console.log('dev login done');
}

await page.goto(BASE + '/matches/new', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'public/screenshots/matches-new.png' });
console.log('✓ matches-new');

await browser.close();
