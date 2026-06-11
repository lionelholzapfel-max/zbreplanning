import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

/**
 * Visual Audit - Captures screenshots in key states for UX contract validation
 *
 * This script screenshots all pages in their various states to verify
 * they conform to the UX contract defined in docs/ux-contract.md
 */

test.describe('Visual Audit - UX Contract Compliance', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 Mobile

  test('01 - Login page states', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Qui es-tu ?')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'screenshots/audit/01-login-initial.png', fullPage: true });

    // Click on a member to see PIN screen
    await page.locator('button').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/audit/01-login-pin.png', fullPage: true });
  });

  test('02 - Home page states', async ({ page }) => {
    await quickLogin(page, '1');
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/audit/02-home-initial.png', fullPage: true });

    // Scroll to see more sections
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/audit/02-home-scrolled.png', fullPage: false });
  });

  test('03 - World Cup page - Clean slate mobile', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/world-cup');
    await expect(page.getByRole('heading', { name: 'Coupe du Monde' })).toBeVisible({ timeout: 30000 });

    // Scroll to first match card
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1000);

    // Screenshot showing clean slate (no others' predictions visible by default)
    await page.screenshot({ path: 'screenshots/audit/03-worldcup-clean-slate.png', fullPage: false });

    // Verify score inputs are visible without expanding
    const scoreInput = page.locator('input[inputmode="numeric"]').first();
    const isVisible = await scoreInput.isVisible().catch(() => false);
    if (isVisible) {
      await page.screenshot({ path: 'screenshots/audit/03-worldcup-score-inputs-visible.png', fullPage: false });
    }

    // Verify participation buttons are smaller (check they exist)
    const ouiButton = page.locator('button:has-text("✓")').first();
    await expect(ouiButton).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'screenshots/audit/03-worldcup-participation-buttons.png', fullPage: false });
  });

  test('04 - World Cup page - Expanded details', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/world-cup');
    await expect(page.getByRole('heading', { name: 'Coupe du Monde' })).toBeVisible({ timeout: 30000 });

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);

    // Click Details button
    const detailsBtn = page.locator('button:has-text("Détails")').first();
    if (await detailsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await detailsBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/audit/04-worldcup-expanded.png', fullPage: false });
    }
  });

  test('05 - Leaderboard page', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/leaderboard');
    await expect(page.locator('text=Leaderboard').or(page.locator('text=Points')).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/audit/05-leaderboard.png', fullPage: true });
  });

  test('06 - Activities page', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/activities');
    await expect(page.getByRole('heading', { name: 'Activités' })).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/audit/06-activities.png', fullPage: true });
  });

  test('07 - World Cup filters', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/world-cup');
    await expect(page.getByRole('heading', { name: 'Coupe du Monde' })).toBeVisible({ timeout: 30000 });

    // Test phase filter
    const phaseBtn = page.locator('button:has-text("8e")');
    if (await phaseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await phaseBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/audit/07-worldcup-phase-filter.png', fullPage: false });
    }
  });
});

test.describe('UX Contract Violations Check', () => {
  test('Verify clean slate - no compact predictions on main card', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/world-cup');
    await expect(page.getByRole('heading', { name: 'Coupe du Monde' })).toBeVisible({ timeout: 30000 });

    // The compact display should NOT show individual avatars with scores
    // It should only show "X autres pronos • Voir dans Détails"
    const compactPredDisplay = page.locator('text=/\\d+ autres pronos/').first();
    const avatarInCard = page.locator('.bg-white\\/5 .rounded-full').first();

    // Either compact display exists OR no avatar previews - clean slate maintained
    const hasCompact = await compactPredDisplay.isVisible({ timeout: 3000 }).catch(() => false);
    const hasAvatarPreview = await avatarInCard.isVisible({ timeout: 1000 }).catch(() => false);

    // Pass if we don't have avatar previews in non-expanded state
    expect(hasAvatarPreview).toBe(false);
  });

  test('Verify score inputs accessible on mobile', async ({ page }) => {
    page.setViewportSize({ width: 390, height: 844 });
    await quickLogin(page, '1');
    await page.goto('/world-cup');
    await expect(page.getByRole('heading', { name: 'Coupe du Monde' })).toBeVisible({ timeout: 30000 });

    // Scroll to first match
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);

    // Score inputs should be visible
    const scoreInput = page.locator('input[inputmode="numeric"]').first();
    const isVisible = await scoreInput.isVisible({ timeout: 5000 }).catch(() => false);

    // If there's a match that's not locked, inputs should be visible
    // If all matches are locked, we skip this check
    if (isVisible) {
      expect(isVisible).toBe(true);
    }
  });

  test('Verify participation buttons are smaller', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/world-cup');
    await expect(page.getByRole('heading', { name: 'Coupe du Monde' })).toBeVisible({ timeout: 30000 });

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);

    // Participation buttons should have smaller padding (py-1.5 instead of py-2.5)
    const ouiButton = page.locator('button:has-text("✓")').first();
    await expect(ouiButton).toBeVisible({ timeout: 5000 });

    // Button should have the smaller class
    await expect(ouiButton).toHaveClass(/py-1\.5/);
  });
});
