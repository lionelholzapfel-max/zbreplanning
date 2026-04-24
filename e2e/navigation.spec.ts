import { test, expect } from '@playwright/test';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.locator('button').filter({ has: page.locator('img') }).first().click();
  await page.click('button:has-text("C\'est parti")');
  await page.waitForURL('/');
});

test.describe('Navigation', () => {
  test('should navigate to World Cup page', async ({ page }) => {
    await page.click('text=Coupe du Monde');
    await expect(page).toHaveURL('/world-cup');
  });

  test('should navigate to Calendar page', async ({ page }) => {
    await page.click('a[href="/calendar"]');
    await expect(page).toHaveURL('/calendar');
  });

  test('should navigate back to home', async ({ page }) => {
    await page.goto('/world-cup');
    await page.click('a[href="/"]');
    await expect(page).toHaveURL('/');
  });

  test('should show notification bell', async ({ page }) => {
    // Just verify the bell emoji exists somewhere in nav
    await expect(page.locator('nav')).toContainText('🔔');
  });

  test('should have working user menu', async ({ page }) => {
    // Verify user menu button exists
    const userBtn = page.locator('nav button').filter({ has: page.locator('img') });
    await expect(userBtn).toBeVisible();
  });
});
