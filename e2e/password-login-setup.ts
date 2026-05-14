/**
 * Optional: capture storage state using Base44 email + password (no Google OAuth).
 *
 * Requires env (never commit passwords — pass inline only):
 *   E2E_LOGIN_EMAIL    same as TEST_<SLOT>_EMAIL usually
 *   E2E_LOGIN_PASSWORD from your terminal session only
 *
 *   cd aironcoach-e2e
 *   E2E_LOGIN_EMAIL=xrivosx@gmail.com E2E_LOGIN_PASSWORD='…' npx tsx e2e/password-login-setup.ts --slot=pro
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
  const email = process.env.E2E_LOGIN_EMAIL?.trim();
  const password = process.env.E2E_LOGIN_PASSWORD;
  const baseUrl = (process.env.BASE_URL ?? 'https://break-through-ai.base44.app').replace(/\/$/, '');

  if (!email || !password) {
    console.error(
      'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD in the environment (do not put the password in .env files that might be committed).',
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

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/Landing`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Landing uses buttons that call redirectToLogin — click primary login entry
  const loginBtn = page.getByRole('button', { name: /login|zaloguj/i }).first();
  await loginBtn.click({ timeout: 15_000 });

  await page.waitForURL(/base44|login|auth|sign/i, { timeout: 45_000 }).catch(() => {});

  // Hosted page may show provider picker — prefer email/password if visible
  const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="username"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();

  await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  await emailInput.fill(email);
  await passInput.fill(password);

  const submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Zaloguj")').first();
  await submit.click();

  // Redirect lands on app origin with token in localStorage
  await page
    .waitForFunction(
      () => !!window.localStorage.getItem('base44_access_token'),
      undefined,
      { timeout: 90_000 },
    )
    .catch(() => {});

  let token = await page.evaluate(() => localStorage.getItem('base44_access_token'));
  if (!token) {
    console.warn('⚠ No token yet — navigating to app Dashboard…');
    await page.goto(`${baseUrl}/Dashboard`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    token = await page.evaluate(() => localStorage.getItem('base44_access_token'));
  }
  if (!token) {
    throw new Error(
      'Login did not produce base44_access_token. The hosted page may be Google-only — use npm run e2e:auth-setup instead.',
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
