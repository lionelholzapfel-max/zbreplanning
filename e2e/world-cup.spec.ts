import { test, expect } from '@playwright/test';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.locator('button').filter({ has: page.locator('img') }).first().click();
  await page.click('button:has-text("C\'est parti")');
  await page.waitForURL('/');
  await page.goto('/world-cup');
});

test.describe('World Cup Page', () => {
  test('should display matches', async ({ page }) => {
    await expect(page.locator('text=VS').first()).toBeVisible();
  });

  test('should filter by phase', async ({ page }) => {
    await page.click('button:has-text("8e")');
    await expect(page.locator('button:has-text("8e")')).toHaveClass(/from-\[#fbbf24\]/);
  });

  test('should respond "Oui" to a match', async ({ page }) => {
    const yesButton = page.locator('button:has-text("Oui !")').first();
    await yesButton.click();
    // Wait for state update
    await page.waitForTimeout(500);
    // Check button is now active
    await expect(yesButton).toHaveClass(/bg-\[#22c55e\]/);
  });

  test('should respond "Peut-être" to a match', async ({ page }) => {
    const maybeButton = page.locator('button:has-text("Peut-être")').first();
    await maybeButton.click();
    await page.waitForTimeout(500);
    await expect(maybeButton).toHaveClass(/bg-\[#fbbf24\]/);
  });

  test('should expand match details', async ({ page }) => {
    await page.locator('button:has-text("Détails")').first().click();
    await expect(page.locator('text=Où regarder ensemble ?').first()).toBeVisible();
  });

  test('should propose a location', async ({ page }) => {
    // Expand first match
    await page.locator('button:has-text("Détails")').first().click();

    // Type location
    const locationInput = page.locator('input[placeholder="Proposer un lieu..."]').first();
    await locationInput.fill('Test Location ' + Date.now());

    // Click propose button
    await page.locator('button:has-text("Proposer")').first().click();

    // Input should be cleared
    await expect(locationInput).toHaveValue('');
  });

  test('should show progress bar', async ({ page }) => {
    await expect(page.locator('text=/\\d+\\/14 ont répondu/').first()).toBeVisible();
  });
});
