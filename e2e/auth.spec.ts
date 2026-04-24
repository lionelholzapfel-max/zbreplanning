import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Salut ! Qui es-tu ?')).toBeVisible();
    await expect(page.locator('text=14 membres actifs')).toBeVisible();
  });

  test('should select a member when clicking avatar', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button').filter({ has: page.locator('img') }).first().click();
    await expect(page.locator('text=Prêt à rejoindre la team')).toBeVisible();
  });

  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button').filter({ has: page.locator('img') }).first().click();
    await page.click('button:has-text("C\'est parti")');
    await expect(page).toHaveURL('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should have user menu in navbar', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.locator('button').filter({ has: page.locator('img') }).first().click();
    await page.click('button:has-text("C\'est parti")');
    await page.waitForURL('/');

    // Verify user menu button exists in navbar
    const userBtn = page.locator('nav button').filter({ has: page.locator('img') });
    await expect(userBtn).toBeVisible();
  });
});
