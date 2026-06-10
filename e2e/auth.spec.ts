import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

test.describe('Authentication', () => {
  test('should redirect to login if not authenticated', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.goto('/');
    // Should redirect to login
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Salut ! Qui es-tu ?')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=14 membres actifs')).toBeVisible({ timeout: 10000 });
  });

  test('should show PIN input when clicking avatar', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Salut ! Qui es-tu ?')).toBeVisible({ timeout: 10000 });
    await page.locator('button').filter({ has: page.locator('img') }).first().click();
    // Should show PIN input
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with PIN', async ({ page }) => {
    await quickLogin(page, '1');
    // quickLogin already verified nav is visible (use .first() for strict mode)
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('should have user menu in navbar after login', async ({ page }) => {
    await quickLogin(page, '1');
    // Verify user menu button exists in navbar (use .first() for strict mode)
    const userBtn = page.locator('nav').first().locator('button').filter({ has: page.locator('img') });
    await expect(userBtn).toBeVisible({ timeout: 10000 });
  });
});
