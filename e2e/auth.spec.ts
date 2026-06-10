import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

test.describe('Authentication', () => {
  test('should redirect to login if not authenticated', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Salut ! Qui es-tu ?')).toBeVisible();
    await expect(page.locator('text=14 membres actifs')).toBeVisible();
  });

  test('should show PIN input when clicking avatar', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button').filter({ has: page.locator('img') }).first().click();
    // Should show PIN input
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('should login successfully with PIN', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should have user menu in navbar after login', async ({ page }) => {
    await quickLogin(page, '1');
    await page.goto('/');

    // Verify user menu button exists in navbar
    const userBtn = page.locator('nav button').filter({ has: page.locator('img') });
    await expect(userBtn).toBeVisible();
  });
});
