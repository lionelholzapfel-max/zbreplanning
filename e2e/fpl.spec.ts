import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

// FPL pages are fed by the live public FPL API (+ the review table of the test DB).
test.describe('FPL — not logged in', () => {
  test('home redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('fat portraits are never served without a session', async ({ request }) => {
    const res = await request.get('/api/fpl/photo/ramzi?v=face', { maxRedirects: 0 });
    // middleware redirects to /login (307) — either way, no image
    expect([307, 401]).toContain(res.status());
    expect(res.headers()['content-type'] ?? '').not.toContain('image');
  });

  test('the stored Drère song is never served without a session', async ({ request }) => {
    const res = await request.get('/api/fpl/song/10', { maxRedirects: 0 });
    expect([307, 401]).toContain(res.status());
    expect(res.headers()['content-type'] ?? '').not.toContain('audio');
  });

  test('cron endpoint refuses calls without the secret', async ({ request }) => {
    const res = await request.get('/api/fpl/cron');
    expect(res.status()).toBe(401);
  });

  test('manual review trigger is admin-only', async ({ request }) => {
    const res = await request.post('/api/fpl/cron', { data: {} });
    expect(res.status()).toBe(403);
  });
});

test.describe('FPL — logged in as Lionel', () => {
  test.beforeEach(async ({ page }) => {
    await quickLogin(page, '7');
  });

  test('the World Cup champion announcement goes first, the GW reveal waits for the next visit', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('champion-celebration-seen'));
    await page.goto('/');
    await page.waitForTimeout(1200);
    await expect(page.getByRole('dialog').filter({ hasText: 'Drère de la semaine' })).toHaveCount(0);
    // the champion overlay marked itself as seen: the GW reveal comes on the next visit
    expect(await page.evaluate(() => localStorage.getItem('champion-celebration-seen'))).not.toBeNull();
    await page.reload();
    await expect(page.getByRole('dialog').filter({ hasText: 'Drère de la semaine' })).toBeVisible({ timeout: 10000 });
  });

  test('home shows the league, the leader, the 4 managers and the review', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('champion-celebration-seen', '2026'));
    await page.goto('/');
    // first visit of the GW: the Drère reveal shows once, then never again
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog).toContainText('Drère de la semaine');
    await dialog.getByRole('button', { name: 'Voir la review' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ziarclays Zbremiership');
    await expect(page.getByText('— en tête')).toBeVisible();
    for (const name of ['Ramzi', 'Lionel', 'Greg', 'Edu']) {
      await expect(page.locator('a[href^="/fpl/managers#"]').filter({ hasText: name })).toHaveCount(1);
    }
    await expect(page.getByText('Toi', { exact: true })).toBeVisible();
    await expect(page.getByText(/La review · GW\d+/)).toBeVisible();
    await expect(page.getByText('Drère de la semaine').first()).toBeVisible();
    await expect(page.getByText('Mzi de la semaine').first()).toBeVisible();

    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('portraits load for a logged-in member', async ({ page }) => {
    const res = await page.request.get('/api/fpl/photo/edu?v=full');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/webp');
    expect(res.headers()['cache-control']).toContain('private');
    const unknown = await page.request.get('/api/fpl/photo/__proto__?v=face');
    expect(unknown.status()).toBe(404);
  });

  test('the stored Drère song streams to members, with byte ranges for Safari', async ({ page }) => {
    const full = await page.request.get('/api/fpl/song/10');
    expect(full.status()).toBe(200);
    expect(full.headers()['content-type']).toBe('audio/mpeg');
    expect(full.headers()['accept-ranges']).toBe('bytes');
    expect(full.headers()['cache-control']).toContain('private');
    const part = await page.request.get('/api/fpl/song/10', { headers: { Range: 'bytes=0-99' } });
    expect(part.status()).toBe(206);
    expect((await part.body()).byteLength).toBe(100);
    expect(part.headers()['content-range']).toMatch(/^bytes 0-99\/\d+$/);
    expect((await page.request.get('/api/fpl/song/11')).status()).toBe(404);
    expect((await page.request.get('/api/fpl/song/abc')).status()).toBe(404);
  });

  test('stats page renders charts with faces and every section', async ({ page }) => {
    await page.goto('/fpl/stats');
    for (const title of ['La course', 'Les trophées de la saison', 'Le mercato', 'Le brassard', 'Les chips', 'Face-à-face', 'Face au monde']) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
    // faces drawn at the end of the chart lines (SVG <image>)
    await expect(page.locator('.recharts-wrapper image').first()).toBeAttached({ timeout: 10000 });
    await page.getByRole('button', { name: /Les \d+ transferts/ }).first().click();
    await expect(page.getByRole('button', { name: 'Réduire' }).first()).toBeVisible();
  });

  test('managers page has one bio per manager with stars', async ({ page }) => {
    await page.goto('/fpl/managers');
    for (const slug of ['ramzi', 'lionel', 'greg', 'edu']) {
      await expect(page.locator(`section#${slug}`)).toBeVisible();
    }
    await expect(page.locator('section#ramzi [aria-label="5 étoiles"]')).toBeVisible();
    await expect(page.locator('section#lionel [aria-label="2 étoiles"]')).toBeVisible();
    await expect(page.locator('section#lionel')).toContainText('contestée');
  });

  test('reviews archive lists finished gameweeks', async ({ page }) => {
    await page.goto('/fpl/reviews');
    await expect(page.getByRole('heading', { name: 'Les reviews' })).toBeVisible();
    await expect(page.getByText(/La review · GW1\b/)).toBeVisible();
  });

  test('World Cup section is still reachable under its own tab', async ({ page }) => {
    await page.goto('/cdm');
    for (const tab of ['Matchs', 'Classement', 'Pronos']) {
      await expect(page.getByRole('link', { name: tab, exact: true }).first()).toBeVisible();
    }
    await page.getByRole('link', { name: 'Classement', exact: true }).first().click();
    await expect(page).toHaveURL(/\/leaderboard/);
  });
});
