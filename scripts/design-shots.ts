/**
 * Design review screenshots — a TOOL, not a test.
 *
 * Prereq: the dev app must be running on http://localhost:3001
 *         (npm run dev -- -p 3001).
 * Run:    npm run design:shots
 *
 * Auth: we forge the `zbre_session` JWT cookie directly (simpler + reliable),
 * signed with the SAME secret the dev app uses. The dev app points at the PROD
 * DB via .env.local, so we read JWT_SECRET from .env.local (NOT .env.test — its
 * secret differs and would produce an invalid cookie). Nothing is hardcoded.
 *
 * Add a shot in one line: push to SHOTS ({ page, name, selector? }).
 */
import { chromium } from '@playwright/test';
import { SignJWT } from 'jose';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE_URL = 'http://localhost:3001';
const OUT_DIR = 'design-shots';
const SETTLE_MS = 800; // count-up (500ms) + list stagger finished

// The dev app authenticates against the prod DB → use a real member.
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
}

const SHOTS: Shot[] = [
  { page: '/', name: 'home-full' },
  { page: '/', name: 'home-next-match', selector: '[data-shot="next-match"]' },
  { page: '/', name: 'home-hero', selector: '[data-shot="hero"]' },
  // Add more here, e.g.:
  // { page: '/leaderboard', name: 'leaderboard-full' },
  // { page: '/login', name: 'login-select' },
];

/** Read a single var from an env file without pulling a dep. */
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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const token = await forgeSessionCookie();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  await context.addCookies([
    {
      name: 'zbre_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  // Fail fast with a clear message if the dev server isn't up.
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 8000 });
  } catch {
    console.error(`\n✗ Dev app introuvable sur ${BASE_URL}.\n  Lance-le d'abord :  npm run dev -- -p 3001\n`);
    await browser.close();
    process.exit(1);
  }

  let currentPage = '';
  for (const shot of SHOTS) {
    if (shot.page !== currentPage) {
      await page.goto(`${BASE_URL}${shot.page}`, { waitUntil: 'networkidle' });
      currentPage = shot.page;
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(SETTLE_MS);

    const out = `${OUT_DIR}/${shot.name}.png`;
    if (shot.selector) {
      const el = page.locator(shot.selector).first();
      await el.waitFor({ state: 'visible', timeout: 5000 });
      await el.screenshot({ path: out });
    } else {
      await page.screenshot({ path: out, fullPage: true });
    }
    console.log(`  ✓ ${out}`);
  }

  await browser.close();
  console.log(`\n${SHOTS.length} captures dans ${OUT_DIR}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
