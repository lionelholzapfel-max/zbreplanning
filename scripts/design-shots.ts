/**
 * Design review screenshots — a TOOL, not a test.
 *
 * Prereq: the dev app must be running on http://localhost:3001
 *         (npm run dev -- -p 3001).
 * Run:    npm run design:shots
 *
 * Auth: we forge the `zbre_session` JWT cookie directly, signed with the SAME
 * secret the dev app uses (.env.local — the dev app points at the PROD DB;
 * .env.test has a different secret and would produce an invalid cookie).
 * Nothing is hardcoded. Shots with `auth: false` run in an anonymous context
 * (needed for /login, which redirects to / when a session exists).
 *
 * Add a shot in one line: push to SHOTS. `actions` lets you drive UI state
 * (tabs, filters) before capturing.
 */
import { chromium, type Page, type BrowserContext } from '@playwright/test';
import { SignJWT } from 'jose';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE_URL = 'http://localhost:3001';
const OUT_DIR = 'design-shots';
const SETTLE_MS = 900; // count-up (500ms) + list stagger finished

// The dev app authenticates against the prod DB → use a real member (admin, to reach /admin/*).
const MEMBER = {
  id: '7',
  member_id: '7',
  member_name: 'Lionel Holzapfel',
  member_slug: 'lionel-holzapfel',
  is_admin: true,
};

interface Shot {
  page: string;
  name: string;
  /** CSS selector to capture a single element. Omit → full page. */
  selector?: string;
  /** false → capture without a session cookie (for /login). Default true. */
  auth?: boolean;
  /** Drive UI state (click tabs/filters) before capturing. Best-effort. */
  actions?: (page: Page) => Promise<void>;
}

/** Click a button by (case-insensitive) accessible name, best-effort. */
async function clickButton(page: Page, name: RegExp) {
  const btn = page.getByRole('button', { name }).first();
  if (await btn.count().catch(() => 0)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

const SHOTS: Shot[] = [
  { page: '/', name: '01-home' },
  { page: '/login', name: '02-login', auth: false },
  { page: '/world-cup', name: '03-worldcup-default' },
  { page: '/world-cup', name: '04-worldcup-groups', actions: (p) => clickButton(p, /groupes/i) },
  { page: '/world-cup', name: '05-worldcup-knockout', actions: (p) => clickButton(p, /16es/i) },
  { page: '/predictions', name: '06-predictions' },
  { page: '/leaderboard', name: '07-leaderboard-general' },
  { page: '/leaderboard', name: '07-leaderboard-semaine', actions: (p) => clickButton(p, /^semaine$/i) },
  { page: '/leaderboard', name: '07-leaderboard-live', actions: (p) => clickButton(p, /^live$/i) },
  { page: '/games', name: '08-games' },
  { page: '/activities', name: '09-activities' },
  { page: '/calendar', name: '10-calendar' },
  { page: '/admin/results', name: '11-admin-results' },
  { page: '/admin/members', name: '12-admin-members' },
  // Home component crops (design-language review)
  { page: '/', name: 'home-hero', selector: '[data-shot="hero"]' },
  { page: '/', name: 'home-stats', selector: '[data-shot="stats"]' },
  { page: '/', name: 'home-next-match', selector: '[data-shot="next-match"]' },
  { page: '/', name: 'home-matches', selector: '[data-shot="matches"]' },
];

function readEnvVar(file: string, key: string): string {
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not found in ${file}`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

async function forgeSessionCookie(): Promise<string> {
  const secret = new TextEncoder().encode(readEnvVar('.env.local', 'JWT_SECRET'));
  return new SignJWT({ ...MEMBER })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

async function newCtx(browser: Awaited<ReturnType<typeof chromium.launch>>, authed: boolean, token: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  if (authed) {
    await ctx.addCookies([
      { name: 'zbre_session', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' },
    ]);
  }
  return ctx;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const token = await forgeSessionCookie();

  const browser = await chromium.launch();
  const authedCtx = await newCtx(browser, true, token);
  const anonCtx = await newCtx(browser, false, token);

  // Fail fast if the dev server isn't up.
  const probe = await authedCtx.newPage();
  try {
    await probe.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 8000 });
  } catch {
    console.error(`\n✗ Dev app introuvable sur ${BASE_URL}.\n  Lance-le d'abord :  npm run dev -- -p 3001\n`);
    await browser.close();
    process.exit(1);
  }
  await probe.close();

  for (const shot of SHOTS) {
    const ctx = shot.auth === false ? anonCtx : authedCtx;
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}${shot.page}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(SETTLE_MS);
      // Run UI actions AFTER the page is interactive (segmented/tabs exist post-hydration).
      if (shot.actions) {
        await shot.actions(page);
        await page.waitForTimeout(500);
      }

      const out = `${OUT_DIR}/${shot.name}.png`;
      if (shot.selector) {
        const el = page.locator(shot.selector).first();
        await el.waitFor({ state: 'visible', timeout: 5000 });
        await el.screenshot({ path: out });
      } else {
        await page.screenshot({ path: out, fullPage: true });
      }
      console.log(`  ✓ ${out}`);
    } catch (e) {
      console.log(`  ✗ ${shot.name} (${shot.page}) — ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nCaptures dans ${OUT_DIR}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
