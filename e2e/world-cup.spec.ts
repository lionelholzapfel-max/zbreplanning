import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await quickLogin(page, '1');
  await page.goto('/world-cup');

  // Wait for page to load - use h1 heading specifically
  await expect(page.getByRole('heading', { name: 'Coupe du Monde' })).toBeVisible({ timeout: 30000 });

  // Scroll down to ensure match cards are in viewport and wait for them
  await page.evaluate(() => window.scrollTo(0, 500));
  // v2: participation is a segmented control with text labels ("Je regarde" / "Peut-être" / "Non")
  await expect(page.locator('button:has-text("Je regarde")').first()).toBeVisible({ timeout: 15000 });
});

test.describe('World Cup Page', () => {
  test('should display matches', async ({ page }) => {
    // Wait for match cards to appear - look for the "Je regarde" participation button
    await expect(page.locator('button:has-text("Je regarde")').first()).toBeVisible({ timeout: 10000 });
  });

  test('should filter by phase', async ({ page }) => {
    // Phase tabs use shortLabels: Groupes / 16es / 8es / Quarts / Demis / 3e place / Finale
    const phaseBtn = page.locator('button:has-text("8es")');
    await expect(phaseBtn).toBeVisible({ timeout: 10000 });
    await phaseBtn.click();
    // v2 segmented: active tab is the one with primary text colour (inactive tabs are secondary)
    await expect(phaseBtn).toHaveClass(/text-\[var\(--text-primary\)\]/, { timeout: 5000 });
  });

  test('should respond "Je regarde" to a match', async ({ page }) => {
    // v2: participation segmented, first option = "Je regarde" (yes)
    const yesButton = page.locator('button:has-text("Je regarde")').first();
    await expect(yesButton).toBeVisible({ timeout: 10000 });
    await yesButton.click();
    // Active option is highlighted with accent text colour
    await expect(yesButton).toHaveClass(/text-\[var\(--accent\)\]/, { timeout: 5000 });
  });

  test('should respond "Peut-être" to a match', async ({ page }) => {
    // v2: participation segmented, second option = "Peut-être"
    const maybeButton = page.locator('button:has-text("Peut-être")').first();
    await expect(maybeButton).toBeVisible({ timeout: 10000 });
    await maybeButton.click();
    // Active option is highlighted with accent text colour
    await expect(maybeButton).toHaveClass(/text-\[var\(--accent\)\]/, { timeout: 5000 });
  });

  test('should expand match details', async ({ page }) => {
    const detailsBtn = page.locator('button:has-text("Détails")').first();
    await expect(detailsBtn).toBeVisible({ timeout: 10000 });
    await detailsBtn.click();
    // v2 details panel shows the "Facts équipes" section (was "Où regarder ensemble ?")
    await expect(page.locator('text=Facts équipes').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show the score-prediction CTA', async ({ page }) => {
    // The old "X/14 ont répondu" progress bar was removed in the v2 redesign (it now lives
    // on the home page). Equivalent robust check on world-cup: the score-prediction "Valider"
    // CTA — the signature action of the new prono flow — is present for an open match.
    await expect(page.locator('button:has-text("Valider")').first()).toBeVisible({ timeout: 10000 });
  });
});
