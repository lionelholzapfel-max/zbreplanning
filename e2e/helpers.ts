import { Page, expect } from '@playwright/test';

// Member data for setting localStorage (must match src/data/members.ts)
const MEMBERS = [
  { id: '1', name: 'Benjamin Oyowe', slug: 'benjamin-oyowe' },
  { id: '2', name: 'Edu Rodger Martinez', slug: 'edu-rodger-martinez' },
  { id: '3', name: 'Gregory Longueville', slug: 'gregory-longueville' },
  { id: '4', name: 'Ian Poznanski', slug: 'ian-poznanski' },
  { id: '5', name: 'Kevin Nounomo', slug: 'kevin-nounomo' },
  { id: '6', name: 'Killian Bohan', slug: 'killian-bohan' },
  { id: '7', name: 'Lionel Holzapfel', slug: 'lionel-holzapfel' },
  { id: '8', name: 'Martin Bracken', slug: 'martin-bracken' },
  { id: '9', name: 'Maximilien Piquet', slug: 'maximilien-piquet' },
  { id: '10', name: 'Nicolas Reuter', slug: 'nicolas-reuter' },
  { id: '11', name: 'Ramzi Lahouegue', slug: 'ramzi-lahouegue' },
  { id: '12', name: 'Ruairi Doyle', slug: 'ruairi-doyle' },
  { id: '13', name: 'Sacha Convens', slug: 'sacha-convens' },
  { id: '14', name: 'Sam Spinnael', slug: 'sam-spinnael' },
];

/**
 * Quick login for tests - uses data-testid for robust selection
 */
export async function quickLogin(page: Page, memberId: string = '1') {
  // Go to login page first to establish browser context
  await page.goto('/login');

  // Wait for login page to be ready (look for member grid)
  await expect(page.locator('[data-testid="member-benjamin-oyowe"]')).toBeVisible({ timeout: 15000 });

  // Find the member by ID
  const memberIndex = parseInt(memberId, 10) - 1;
  const member = MEMBERS[memberIndex];

  // Click on member using data-testid (robust selector)
  const memberButton = page.locator(`[data-testid="member-${member.slug}"]`);
  await expect(memberButton).toBeVisible({ timeout: 5000 });
  await memberButton.click();

  // Wait for PIN input to appear
  const pinInputs = page.locator('input[type="password"]');
  await expect(pinInputs.first()).toBeVisible({ timeout: 10000 });

  // Small delay to let the UI settle
  await page.waitForTimeout(300);

  // Check if we're in setup mode (has "Configurer mon PIN" button)
  const setupButton = page.locator('button:has-text("Configurer mon PIN")');
  const isSetupMode = await setupButton.isVisible().catch(() => false);

  if (isSetupMode) {
    // Setup new PIN: type 1, 2, 3, 4 in first 4 inputs using keyboard
    for (let i = 0; i < 4; i++) {
      await pinInputs.nth(i).focus();
      await page.keyboard.press((i + 1).toString());
      await page.waitForTimeout(100);
    }

    // Wait for confirm PIN inputs to be ready
    await page.waitForTimeout(500);

    // Confirm PIN: type 1, 2, 3, 4 in next 4 inputs
    for (let i = 4; i < 8; i++) {
      const input = pinInputs.nth(i);
      if (await input.isVisible().catch(() => false)) {
        await input.focus();
        await page.keyboard.press((i - 3).toString());
        await page.waitForTimeout(100);
      }
    }

    // Click setup button
    await setupButton.click();
  } else {
    // Login with existing PIN: type 1, 2, 3, 4 using keyboard
    // The 4th digit triggers auto-submit via useEffect
    for (let i = 0; i < 4; i++) {
      await pinInputs.nth(i).focus();
      await page.keyboard.press((i + 1).toString());
      await page.waitForTimeout(100);
    }
  }

  // Wait for redirect to home page
  await page.waitForURL('/', { timeout: 20000 });

  // Set localStorage with user data (workaround for session handling)
  await page.evaluate((m) => {
    const user = {
      id: m.id,
      email: `${m.slug}@zbre.team`,
      member_id: m.id,
      member_name: m.name,
      member_slug: m.slug,
      is_admin: m.id === '7', // Lionel is admin
    };
    localStorage.setItem('zbre_current_user', JSON.stringify(user));
  }, member);

  // Reload to pick up the localStorage user
  await page.reload();

  // Wait for the home page nav to be visible
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 15000 });
}

/**
 * Wait for page to be interactive
 */
export async function waitForPageReady(page: Page, selector: string = 'nav') {
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 10000 });
}
