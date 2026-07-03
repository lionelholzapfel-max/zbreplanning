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
  // Element-level captures of individual match cards (the signature moment).
  { page: '/world-cup', name: 'worldcup-filters', selector: '[data-shot="filters"]' },
  { page: '/world-cup', name: 'worldcup-match-open', selector: '[data-shot="match-open"]' },
  { page: '/world-cup', name: 'worldcup-match-done', selector: '[data-shot="match-done"]' },
  { page: '/world-cup', name: 'worldcup-match-live', selector: '[data-shot="match-live"]' },
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

async function newCtx(browser: Awaited<ReturnType<typeof chromium.launch>>, authed: boolean, token: string, mobile = false): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 3 : 2,
    colorScheme: 'dark',
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  if (authed) {
    await ctx.addCookies([
      { name: 'zbre_session', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' },
    ]);
  }
  return ctx;
}

// ── States mode: force loading / error / empty by intercepting data calls ──
// Auth (/api/auth/*) is never intercepted so the page still authenticates; only
// data endpoints (Supabase REST + data /api routes) are forced.
const STATE_PAGES = [
  { name: 'home', page: '/' },
  { name: 'leaderboard', page: '/leaderboard' },
  { name: 'worldcup', page: '/world-cup' },
  { name: 'activities', page: '/activities' },
];
const DATA_ROUTE = /\/(rest\/v1|api\/(leaderboard|results|knockout|games|activities|participations|predictions))/;

async function captureStates(browser: Awaited<ReturnType<typeof chromium.launch>>, token: string) {
  const states: Array<'loading' | 'error' | 'empty'> = ['loading', 'error', 'empty'];
  const ctx = await newCtx(browser, true, token);
  for (const state of states) {
    console.log(`\n▸ État: ${state}`);
    for (const target of STATE_PAGES) {
      const page = await ctx.newPage();
      await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (DATA_ROUTE.test(url)) {
          if (state === 'loading') return; // never resolve → loading UI stays
          if (state === 'error') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"forced"}' });
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); // empty
        }
        return route.continue();
      });
      try {
        await page.goto(`${BASE_URL}${target.page}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(state === 'loading' ? 2500 : 3500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.addStyleTag({ content: 'nav[class*="sticky"], nav[class*="fixed"] { position: static !important; }' });
        await page.waitForTimeout(200);
        const out = `${OUT_DIR}/states-${state}-${target.name}.png`;
        await page.screenshot({ path: out, fullPage: state !== 'loading' });
        console.log(`  ✓ ${out}`);
      } catch (e) {
        console.log(`  ✗ states-${state}-${target.name} — ${(e as Error).message.split('\n')[0]}`);
      } finally {
        await page.close();
      }
    }
  }
  await ctx.close();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const token = await forgeSessionCookie();

  const browser = await chromium.launch();

  // Profile via CLI arg: `mobile` → 390px m-*, `all` → both, `states` → forced
  // loading/error/empty captures, default → desktop.
  const arg = process.argv[2];

  if (arg === 'states') {
    await captureStates(browser, token);
    await browser.close();
    console.log(`\nStates dans ${OUT_DIR}/`);
    return;
  }
  const profiles =
    arg === 'mobile' ? [{ prefix: 'm-', mobile: true }]
    : arg === 'all' ? [{ prefix: '', mobile: false }, { prefix: 'm-', mobile: true }]
    : [{ prefix: '', mobile: false }];

  for (const prof of profiles) {
    console.log(`\n▸ ${prof.mobile ? 'Mobile 390×844 @3x (isMobile+touch)' : 'Desktop 1440×900 @2x'}`);
    const authedCtx = await newCtx(browser, true, token, prof.mobile);
    const anonCtx = await newCtx(browser, false, token, prof.mobile);

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

        const out = `${OUT_DIR}/${prof.prefix}${shot.name}.png`;
        if (shot.selector) {
          const el = page.locator(shot.selector).first();
          await el.waitFor({ state: 'visible', timeout: 5000 });
          await el.screenshot({ path: out });
        } else {
          // Neutralize the sticky top navbar AND the fixed mobile bottom tab bar so
          // neither re-paints/floats mid-page in fullPage shots.
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.addStyleTag({ content: 'nav[class*="sticky"], nav[class*="fixed"] { position: static !important; }' });
          await page.waitForTimeout(300);
          await page.screenshot({ path: out, fullPage: true });
        }
        console.log(`  ✓ ${out}`);
      } catch (e) {
        console.log(`  ✗ ${prof.prefix}${shot.name} (${shot.page}) — ${(e as Error).message.split('\n')[0]}`);
      } finally {
        await page.close();
      }
    }

    await authedCtx.close();
    await anonCtx.close();
  }

  await browser.close();
  console.log(`\nCaptures dans ${OUT_DIR}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
