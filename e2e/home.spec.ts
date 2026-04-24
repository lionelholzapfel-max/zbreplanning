import { test, expect } from '@playwright/test';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.locator('button').filter({ has: page.locator('img') }).first().click();
  await page.click('button:has-text("C\'est parti")');
  await page.waitForURL('/');
});

test.describe('Home Page', () => {
  test('should display team title', async ({ page }) => {
    await expect(page.locator('text=La Zbre Team').first()).toBeVisible();
  });

  test('should display team members section', async ({ page }) => {
    await expect(page.locator('text=La Team').first()).toBeVisible();
  });

  test('should display World Cup card', async ({ page }) => {
    await expect(page.locator('text=Coupe du Monde 2026').first()).toBeVisible();
  });

  test('should display user greeting', async ({ page }) => {
    await expect(page.locator('text=Salut').first()).toBeVisible();
  });

  test('should toggle castor easter egg', async ({ page }) => {
    await page.click('text=🦫');
    await expect(page.locator('text=Castor Edition')).toBeVisible();
  });

  test('should navigate to World Cup', async ({ page }) => {
    await page.click('a[href="/world-cup"]');
    await expect(page).toHaveURL('/world-cup');
  });

  test('should show hero image', async ({ page }) => {
    await expect(page.locator('img[alt="Zbre Team"]').first()).toBeVisible();
  });
});
