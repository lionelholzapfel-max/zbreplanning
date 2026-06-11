import { test, expect } from '@playwright/test';
import { quickLogin } from './helpers';

// Helper to login before each test
test.beforeEach(async ({ page }) => {
  await quickLogin(page, '1');
  await page.goto('/activities');
  // Wait for page heading to appear (handles loading state)
  await expect(page.getByRole('heading', { name: 'Activités' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('text=Créer une activité').first()).toBeVisible({ timeout: 10000 });
});

test.describe('Activities Page', () => {
  test('should display page title', async ({ page }) => {
    await expect(page.locator('text=Activités').first()).toBeVisible();
  });

  test('should have create button', async ({ page }) => {
    await expect(page.locator('text=Créer une activité').first()).toBeVisible({ timeout: 10000 });
  });

  test('should open create modal', async ({ page }) => {
    await page.locator('text=Créer une activité').first().click();
    await expect(page.locator('text=Nouvelle activité')).toBeVisible({ timeout: 10000 });
  });

  test('should show activity types', async ({ page }) => {
    await page.locator('text=Créer une activité').first().click();
    await expect(page.locator('text=Nouvelle activité')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Restaurant').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Sport').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show form after selecting type', async ({ page }) => {
    await page.locator('text=Créer une activité').first().click();
    await expect(page.locator('text=Nouvelle activité')).toBeVisible({ timeout: 10000 });
    // Click on Restaurant type (in the modal grid) - look for the button with "Sortie resto"
    const restoBtn = page.locator('button:has-text("Sortie resto")');
    await expect(restoBtn).toBeVisible({ timeout: 5000 });
    await restoBtn.click();
    await expect(page.locator('input[placeholder*="Titre"]').or(page.locator('label:has-text("Titre")'))).toBeVisible({ timeout: 5000 });
  });

  test('should close modal on X', async ({ page }) => {
    await page.locator('text=Créer une activité').first().click();
    await expect(page.locator('text=Nouvelle activité')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("✕")').click();
    await expect(page.locator('text=Nouvelle activité')).not.toBeVisible({ timeout: 5000 });
  });
});
