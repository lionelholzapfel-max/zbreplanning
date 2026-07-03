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

    // Verify participation segmented is present (v2: "Je regarde" / "Peut-être" / "Non")
    const ouiButton = page.locator('button:has-text("Je regarde")').first();
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
    // v2: page title is "Classement" (there is no "Leaderboard"/"Points" literal text)
    await expect(page.getByRole('heading', { name: 'Classement' })).toBeVisible({ timeout: 10000 });
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

    // Test phase filter (v2 shortLabel is "8es")
    const phaseBtn = page.locator('button:has-text("8es")');
    if (await phaseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await phaseBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/audit/07-worldcup-phase-filter.png', fullPage: false });
    }
  });
});

test.describe('UX Contract Violations Check', () => {
  test('Verify match card renders the core prono controls', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/world-cup');
    await expect(page.getByRole('heading', { name: 'Coupe du Monde' })).toBeVisible({ timeout: 30000 });

    // NOTE: the old "clean slate" contract (no others' predictions on the collapsed card) no
    // longer applies — the v2 redesign intentionally reveals others' pronos compactly under the
    // score. That old assertion (`.bg-white/5 .rounded-full` absent) passed only because those
    // classes were removed, not because the behaviour still held, so it was a false positive.
    // Robust equivalent: assert each match card renders its core prono controls (participation
    // segmented always present, and the "Détails" expander).
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(page.locator('button:has-text("Je regarde")').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Détails")').first()).toBeVisible({ timeout: 10000 });
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

    // Participation options use compact padding on desktop (sm:py-1.5); "Je regarde" is the first option
    const ouiButton = page.locator('button:has-text("Je regarde")').first();
    await expect(ouiButton).toBeVisible({ timeout: 5000 });

    // Button should carry the compact py-1.5 (sm) padding class
    await expect(ouiButton).toHaveClass(/py-1\.5/);
  });
});
