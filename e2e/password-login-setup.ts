/**
 * Optional: capture storage state using Base44 email + password (no Google OAuth).
 *
 * Credentials (never commit passwords):
 *   USER_NAME + USER_PASS     — Cursor sandbox env (Wave 1 pro slot)
 *   E2E_LOGIN_EMAIL + E2E_LOGIN_PASSWORD — explicit override
 *
 *   cd aironcoach-e2e
 *   npm run e2e:auth-password -- --slot=pro
 *
 * If the hosted login page is Google-only or blocks automation, use interactive
 *   npm run e2e:auth-setup -- --slot=pro
 */
import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const SLOTS = ['free', 'pro', 'admin', 'fresh'] as const;
type Slot = (typeof SLOTS)[number];

function parseArgs(): { slot: Slot } {
  const arg = process.argv.find((a) => a.startsWith('--slot='));
  const slot = arg?.split('=')[1] as Slot | undefined;
  if (!slot || !SLOTS.includes(slot)) {
    console.error(`Usage: tsx e2e/password-login-setup.ts --slot=<${SLOTS.join('|')}>`);
    process.exit(1);
  }
  return { slot };
}

async function main() {
  const { slot } = parseArgs();
  const email = (
    process.env.E2E_LOGIN_EMAIL ??
    process.env.USER_NAME ??
    ''
  ).trim();
  const password = process.env.E2E_LOGIN_PASSWORD ?? process.env.USER_PASS ?? '';
  const baseUrl = (process.env.BASE_URL ?? 'https://airon.coach').replace(/\/$/, '');
  const channel = process.env.PLAYWRIGHT_CHANNEL;

  if (!email || !password) {
    console.error(
      'Set USER_NAME + USER_PASS (or E2E_LOGIN_EMAIL + E2E_LOGIN_PASSWORD) in the environment.',
    );
    process.exit(1);
  }

  const authDir = path.resolve(__dirname, '.auth');
  await fs.mkdir(authDir, { recursive: true });
  const target = path.join(authDir, `${slot}.json`);

  console.log(`\nPassword login capture for slot="${slot}"`);
  console.log(`  Email:       ${email}`);
  console.log(`  Base URL:    ${baseUrl}`);
  console.log(`  Output:      ${target}\n`);

  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
    ...(channel ? { channel } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Direct email/password login page
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const acceptCookies = page.getByRole('button', { name: /^Accept$/i });
  if (await acceptCookies.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await acceptCookies.click();
  }

  const emailInput = page
    .locator('input[type="email"], input[name="email"], input[autocomplete="username"]')
    .first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();

  await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  await emailInput.fill(email);
  await passInput.fill(password);

  // EXACT match — do NOT use /sign in/i (also matches "Continue with Google")
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 90_000 }).catch(() => {}),
    page.getByRole('button', { name: /^Sign in$/ }).click(),
  ]);

  await page.waitForLoadState('domcontentloaded').catch(() => {});

  await page
    .waitForFunction(
      () => !!window.localStorage.getItem('base44_access_token'),
      undefined,
      { timeout: 90_000 },
    )
    .catch(() => {});

  let token: string | null = null;
  for (let attempt = 0; attempt < 5 && !token; attempt++) {
    try {
      token = await page.evaluate(() => localStorage.getItem('base44_access_token'));
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1_000);
    }
  }
  if (!token) {
    console.warn('⚠ No token yet — navigating to /Home…');
    await page.goto(`${baseUrl}/Home`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    token = await page.evaluate(() => localStorage.getItem('base44_access_token'));
  }
  if (!token) {
    throw new Error(
      'Login did not produce base44_access_token. Try npm run e2e:auth-setup for interactive OAuth.',
    );
  }

  await context.storageState({ path: target });
  await browser.close();

  const stat = await fs.stat(target);
  console.log(`\n✔ Wrote ${target} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
