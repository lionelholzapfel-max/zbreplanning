import { test, expect } from '@playwright/test';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.locator('button').filter({ has: page.locator('img') }).first().click();
  await page.click('button:has-text("C\'est parti")');
  await page.waitForURL('/');
  await page.goto('/activities');
});

test.describe('Activities Page', () => {
  test('should display page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Activités');
  });

  test('should have create button', async ({ page }) => {
    await expect(page.locator('text=Créer une activité').first()).toBeVisible();
  });

  test('should open create modal', async ({ page }) => {
    await page.locator('text=Créer une activité').first().click();
    await expect(page.locator('text=Nouvelle activité')).toBeVisible();
  });

  test('should show activity types', async ({ page }) => {
    await page.locator('text=Créer une activité').first().click();
    await expect(page.locator('text=Restaurant').first()).toBeVisible();
    await expect(page.locator('text=Sport').first()).toBeVisible();
  });

  test('should show form after selecting type', async ({ page }) => {
    await page.locator('text=Créer une activité').first().click();
    // Click on Restaurant type (in the modal grid)
    await page.locator('button:has-text("Sortie resto")').click();
    await expect(page.locator('text=Titre')).toBeVisible();
  });

  test('should close modal on X', async ({ page }) => {
    await page.locator('text=Créer une activité').first().click();
    await page.locator('button:has-text("✕")').click();
    await expect(page.locator('text=Nouvelle activité')).not.toBeVisible();
  });
});
