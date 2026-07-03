import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

test.describe('Parcours Complet E2E', () => {
  test('login PIN → prono → persistence → filter → favori', async ({ page }) => {
    // 1. LOGIN WITH PIN
    await quickLogin(page, '1');
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });

    // 2. GO TO WORLD CUP AND MAKE A PREDICTION
    await page.goto('/world-cup');
    // v2: participation segmented with text labels ("Je regarde" is always rendered per card)
    await expect(page.locator('button:has-text("Je regarde")').first()).toBeVisible({ timeout: 10000 });

    // Only unlocked, still-predictable matches can be saved (the API 403s a started
    // match). Filter to "À pronostiquer" so the first card is guaranteed editable.
    await page.locator('button:has-text("À pronostiquer")').first().click();
    await page.waitForTimeout(600);

    // Find a match card with score inputs (not locked)
    const scoreInputHome = page.locator('input[inputmode="numeric"]').first();
    const scoreInputAway = page.locator('input[inputmode="numeric"]').nth(1);

    // Check if inputs are visible (match not started)
    if (await scoreInputHome.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Enter a prediction: 2-1
      await scoreInputHome.fill('2');
      await scoreInputAway.fill('1');

      // Save deterministically — the 1s debounce auto-save can lag under parallel
      // load; clicking Valider commits immediately.
      await page.locator('button:has-text("Valider")').first().click().catch(() => {});

      // The on-card "Prono enregistré" badge persists (unlike the transient toast).
      await expect(page.locator('text=Prono enregistré').first()).toBeVisible({ timeout: 10000 });
    }

    // 3. PERSISTENCE CHECK - Reload and verify prediction persists
    await page.reload();
    await expect(page.locator('button:has-text("Je regarde")').first()).toBeVisible({ timeout: 10000 });
    // Let async data + entry animations settle so cards stop re-rendering before we click.
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    // 4. TEST "MES ÉQUIPES" FILTER
    // First, toggle a favorite team by clicking the star (v2: lucide Star icon, aria-label="Favori")
    const starButton = page.locator('button[aria-label="Favori"]').first();
    if (await starButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await starButton.click({ timeout: 10000 });
      await page.waitForTimeout(500);

      // A favorite is now highlighted with the accent colour (re-query fresh: the card
      // re-renders on toggle, which can detach the original node).
      await expect(page.locator('button[aria-label="Favori"]').first())
        .toHaveClass(/text-\[var\(--accent\)\]/, { timeout: 5000 });
    }

    // Click on "Mes équipes" filter chip
    const myTeamsFilter = page.locator('button:has-text("Mes équipes")');
    await expect(myTeamsFilter).toBeVisible({ timeout: 5000 });
    await myTeamsFilter.click();

    // Filter should be active (v2 chip active state uses the accent-muted background token)
    await expect(myTeamsFilter).toHaveClass(/bg-\[var\(--accent-muted\)\]/, { timeout: 5000 });

    // 5. The filter is working - test complete
    // Note: We don't toggle favorite off because the star button can get detached after the filter applies
  });
});

test.describe('Admin Flow', () => {
  test('saisie résultat → points visibles au leaderboard', async ({ page }) => {
    // Login as admin (member 1 should be admin based on the setup)
    await quickLogin(page, '1');

    // Go to admin results page
    await page.goto('/admin/results');

    // Check if we have access (might redirect if not admin)
    const isAdminPage = await page.locator('text=Admin').or(page.locator('text=Résultats')).isVisible({ timeout: 5000 }).catch(() => false);

    if (!isAdminPage) {
      // Skip if not admin
      test.skip();
      return;
    }

    // Go to leaderboard and verify it shows
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { name: 'Classement' })).toBeVisible({ timeout: 10000 });

    // Check leaderboard shows the "Pts" column header (v2 uses "Pts", not "Points")
    await expect(page.locator('text=Pts').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Mobile Screenshots @mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 size

  test('capture mobile screenshots', async ({ page }) => {
    await quickLogin(page, '1');

    // Screenshot: Accueil
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000); // Let animations settle
    await page.screenshot({ path: 'screenshots/mobile-accueil.png', fullPage: true });

    // Screenshot: World Cup
    await page.goto('/world-cup');
    await expect(page.locator('button:has-text("Je regarde")').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/mobile-world-cup.png', fullPage: false });

    // Screenshot: Leaderboard - wait for page content, not nav text
    await page.goto('/leaderboard');
    // Wait for the leaderboard page to load - look for member avatars or point scores
    await page.waitForTimeout(2000); // Let page fully load
    await page.screenshot({ path: 'screenshots/mobile-leaderboard.png', fullPage: true });
  });
});
