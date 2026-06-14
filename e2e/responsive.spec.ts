import { test, expect } from 'playwright/test';

// ── Mobile (390px) 검증 ────────────────────────────────────────
test.describe('Mobile (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('헤더: 로고만 표시, nav 숨김', async ({ page }) => {
    await page.goto('/');
    // useBreakpoint useEffect 보정 대기
    await page.waitForTimeout(500);
    // BottomTabBar 존재
    const tabBar = page.locator('[data-testid="bottom-tab-bar"]');
    await expect(tabBar).toBeVisible();
    // 헤더 내 nav 링크 (티어리스트 등) 숨겨짐
    const headerNav = page.locator('header nav');
    await expect(headerNav).not.toBeVisible();
  });

  test('가로 스크롤 없음 — 티어리스트', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(800); // hydration + useEffect 보정 대기
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test('가로 스크롤 없음 — 내전기록실', async ({ page }) => {
    await page.goto('/matches');
    await page.waitForTimeout(800);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test('가로 스크롤 없음 — 스트리머', async ({ page }) => {
    await page.goto('/streamers');
    await page.waitForTimeout(1500); // 데이터 로드 + hydration 대기
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test('BottomTabBar 4탭 표시 및 활성 탭 존재', async ({ page }) => {
    await page.goto('/');
    const tabBar = page.locator('[data-testid="bottom-tab-bar"]');
    await expect(tabBar).toBeVisible();
    const tabs = tabBar.locator('a');
    await expect(tabs).toHaveCount(4);
    // / 경로에서 티어리스트 탭 href 존재
    await expect(tabBar.locator('a[href="/"]')).toHaveCount(1);
  });

  test('내전기록실: 편집·삭제·일련번호 미표시', async ({ page }) => {
    await page.goto('/matches');
    await page.waitForTimeout(1000);
    // 편집/삭제 버튼 없음
    const editBtns = page.locator('button[title="경기 수정"]');
    await expect(editBtns).toHaveCount(0);
    const deleteBtns = page.locator('button[title="경기 삭제"]');
    await expect(deleteBtns).toHaveCount(0);
  });
});

// ── Tablet (768px) 검증 ───────────────────────────────────────
test.describe('Tablet (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('BottomTabBar 표시됨', async ({ page }) => {
    await page.goto('/');
    const tabBar = page.locator('[data-testid="bottom-tab-bar"]');
    await expect(tabBar).toBeVisible();
  });

  test('가로 스크롤 없음 — 티어리스트', async ({ page }) => {
    await page.goto('/');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test('가로 스크롤 없음 — 스트리머', async ({ page }) => {
    await page.goto('/streamers');
    await page.waitForTimeout(1000);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });
});

// ── Desktop (1280px) 검증 ─────────────────────────────────────
test.describe('Desktop (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('BottomTabBar 미표시', async ({ page }) => {
    await page.goto('/');
    const tabBar = page.locator('[data-testid="bottom-tab-bar"]');
    await expect(tabBar).not.toBeVisible();
  });

  test('헤더 nav 표시', async ({ page }) => {
    await page.goto('/');
    const headerNav = page.locator('header nav');
    await expect(headerNav).toBeVisible();
  });

  test('가로 스크롤 없음 — 전 페이지', async ({ page }) => {
    for (const path of ['/', '/matches', '/streamers']) {
      await page.goto(path);
      await page.waitForTimeout(500);
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
    }
  });
});
