import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await quickLogin(page, '1');
});

test.describe('Navigation', () => {
  test('should navigate to World Cup page', async ({ page }) => {
    await page.locator('a[href="/world-cup"]').first().click();
    await expect(page).toHaveURL('/world-cup');
    await expect(page.locator('text=Coupe du Monde').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Activities page', async ({ page }) => {
    await page.locator('a[href="/activities"]').first().click();
    await expect(page).toHaveURL('/activities');
    // Wait for activities page content
    await expect(page.locator('text=Créer une activité').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to leaderboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
    // Click the leaderboard link and verify navigation (use .first() to avoid strict mode with desktop/mobile nav)
    await page.locator('nav').first().locator('a:has-text("Classement")').first().click();
    await page.waitForURL('/leaderboard', { timeout: 10000 });
  });

  test('should have working user menu', async ({ page }) => {
    // Verify user menu button exists (use .first() for strict mode)
    const userBtn = page.locator('nav').first().locator('button').filter({ has: page.locator('img') });
    await expect(userBtn).toBeVisible({ timeout: 10000 });
  });
});
