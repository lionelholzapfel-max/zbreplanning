import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';
import { testLocationName } from './test-constants';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await quickLogin(page, '1');
  await page.goto('/world-cup');
  // Wait for world cup page to load - wait for filter buttons (use .first() for strict mode)
  await expect(page.locator('button:has-text("Oui !")').first()).toBeVisible({ timeout: 10000 });
});

test.describe('World Cup Page', () => {
  test('should display matches', async ({ page }) => {
    // Wait for match cards to appear - look for team flags or match elements
    await expect(page.locator('button:has-text("Oui !")').first()).toBeVisible({ timeout: 10000 });
  });

  test('should filter by phase', async ({ page }) => {
    const phaseBtn = page.locator('button:has-text("8e")');
    await expect(phaseBtn).toBeVisible({ timeout: 10000 });
    await phaseBtn.click();
    // Check button is now active (has gold gradient background)
    await expect(phaseBtn).toHaveClass(/from-\[#fbbf24\]/, { timeout: 5000 });
  });

  test('should respond "Oui" to a match', async ({ page }) => {
    const yesButton = page.locator('button:has-text("Oui !")').first();
    await expect(yesButton).toBeVisible({ timeout: 10000 });
    await yesButton.click();
    // Wait for state update - button should have green background
    await expect(yesButton).toHaveClass(/bg-\[#22c55e\]/, { timeout: 5000 });
  });

  test('should respond "Peut-être" to a match', async ({ page }) => {
    const maybeButton = page.locator('button:has-text("Peut-être")').first();
    await expect(maybeButton).toBeVisible({ timeout: 10000 });
    await maybeButton.click();
    // Wait for state update - button should have gold background
    await expect(maybeButton).toHaveClass(/bg-\[#fbbf24\]/, { timeout: 5000 });
  });

  test('should expand match details', async ({ page }) => {
    const detailsBtn = page.locator('button:has-text("Détails")').first();
    await expect(detailsBtn).toBeVisible({ timeout: 10000 });
    await detailsBtn.click();
    await expect(page.locator('text=Où regarder ensemble ?').first()).toBeVisible({ timeout: 5000 });
  });

  test('should propose a location', async ({ page }) => {
    // Expand first match
    const detailsBtn = page.locator('button:has-text("Détails")').first();
    await expect(detailsBtn).toBeVisible({ timeout: 10000 });
    await detailsBtn.click();

    // Wait for expanded section
    await expect(page.locator('text=Où regarder ensemble ?').first()).toBeVisible({ timeout: 5000 });

    // Type location
    const locationInput = page.locator('input[placeholder="Proposer un lieu..."]').first();
    await expect(locationInput).toBeVisible({ timeout: 5000 });
    await locationInput.fill(testLocationName(Date.now().toString()));

    // Click propose button
    await page.locator('button:has-text("Proposer")').first().click();

    // Input should be cleared after proposal
    await expect(locationInput).toHaveValue('', { timeout: 5000 });
  });

  test('should show progress bar', async ({ page }) => {
    await expect(page.locator('text=/\\d+\\/14 ont répondu/').first()).toBeVisible({ timeout: 10000 });
  });
});
