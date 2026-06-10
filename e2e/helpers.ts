import { Page } from '@playwright/test';

/**
 * Login helper for E2E tests
 * Handles both new PIN setup and existing PIN login flows
 */
export async function loginAsMember(page: Page, memberIndex: number = 0) {
  await page.goto('/login');

  // Click on member avatar
  await page.locator('button').filter({ has: page.locator('img') }).nth(memberIndex).click();

  // Wait for PIN input or setup screen
  await page.waitForSelector('input[type="password"]', { timeout: 5000 });

  // Check if we're in setup mode (has "Configurer mon PIN" button)
  const setupButton = page.locator('button:has-text("Configurer mon PIN")');
  const isSetupMode = await setupButton.isVisible().catch(() => false);

  if (isSetupMode) {
    // Setup new PIN: enter 1234 twice
    const pinInputs = page.locator('input[type="password"]');
    const count = await pinInputs.count();

    // First 4 inputs are PIN, next 4 are confirm PIN
    for (let i = 0; i < 4; i++) {
      await pinInputs.nth(i).fill('1');
      await pinInputs.nth(i).press('1');
    }
    // Small delay to allow focus to move
    await page.waitForTimeout(100);

    // Fill confirm PIN (inputs 4-7)
    for (let i = 4; i < 8; i++) {
      if (await pinInputs.nth(i).isVisible()) {
        await pinInputs.nth(i).fill('2');
        await pinInputs.nth(i).press((i - 4 + 1).toString());
      }
    }

    // Wait and fill confirm PIN properly
    await page.waitForTimeout(100);
    const confirmInputs = page.locator('input[type="password"]');
    const confirmCount = await confirmInputs.count();

    // Re-fill both sets
    for (let i = 0; i < Math.min(4, confirmCount); i++) {
      await confirmInputs.nth(i).fill((i + 1).toString().slice(-1));
    }
    for (let i = 4; i < Math.min(8, confirmCount); i++) {
      await confirmInputs.nth(i).fill((i - 3).toString().slice(-1));
    }

    // Click setup button
    await setupButton.click();
  } else {
    // Login with existing PIN: enter 1234 (auto-submits on 4th digit)
    const pinInputs = page.locator('input[type="password"]');
    for (let i = 0; i < 4; i++) {
      await pinInputs.nth(i).fill((i + 1).toString());
    }
  }

  // Wait for redirect to home
  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * Simple login for tests that just need to be on a page
 * Uses direct API call to set up session cookie
 */
export async function quickLogin(page: Page, memberId: string = '1') {
  // First, try to set up PIN via API
  const setupResponse = await page.request.post('/api/auth/setup-pin', {
    data: {
      member_id: memberId,
      pin: '1234',
    },
  });

  if (setupResponse.ok()) {
    // PIN was set up, we're logged in
    return;
  }

  // PIN already exists, login with it
  const loginResponse = await page.request.post('/api/auth/login', {
    data: {
      member_id: memberId,
      pin: '1234',
    },
  });

  if (!loginResponse.ok()) {
    throw new Error('Failed to login: ' + await loginResponse.text());
  }
}
