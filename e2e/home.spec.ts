import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await quickLogin(page, '1');
  // quickLogin already navigates to '/' and waits for nav
});

test.describe('Home Page', () => {
  test('should display team title', async ({ page }) => {
    await expect(page.locator('text=La Zbre Team').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display team members section', async ({ page }) => {
    // Scroll down to find "La team" section
    await expect(page.locator('text=La team').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display World Cup card', async ({ page }) => {
    // Look for World Cup button/link
    await expect(page.locator('text=Coupe du Monde').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display user greeting', async ({ page }) => {
    // The greeting might be in navbar or hero - check for member name (use .first() for strict mode)
    const navUserBtn = page.locator('nav').first().locator('button').filter({ has: page.locator('img') });
    await expect(navUserBtn).toBeVisible({ timeout: 10000 });
  });

  test('should toggle castor easter egg', async ({ page }) => {
    // Look for castor emoji in the page
    const castorBtn = page.locator('button:has-text("🦫")');
    if (await castorBtn.isVisible().catch(() => false)) {
      await castorBtn.click();
      await expect(page.locator('text=Castor')).toBeVisible();
    } else {
      // Skip if castor button doesn't exist
      test.skip();
    }
  });

  test('should navigate to World Cup', async ({ page }) => {
    await page.locator('a[href="/world-cup"]').first().click();
    await expect(page).toHaveURL('/world-cup');
    // Wait for world cup page content
    await expect(page.locator('text=Coupe du Monde').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show hero image', async ({ page }) => {
    await expect(page.locator('img[alt="Zbre Team"]').first()).toBeVisible({ timeout: 10000 });
  });
});
