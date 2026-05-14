/**
 * Interactive storage-state capture for one slot.
 *
 *   npx tsx e2e/auth-setup.ts --slot=pro
 *
 * Steps:
 *   1. Opens a real Chromium window pointed at BASE_URL.
 *   2. You log in via Google manually (the only path airon.coach supports).
 *   3. Once you're logged in and see /Dashboard, return to the terminal
 *      and press ENTER. The script saves cookies + localStorage to
 *      e2e/.auth/<slot>.json.
 *
 * Re-run this every ~30 days (or when a slot starts failing with auth errors).
 *
 * The captured file is gitignored. To share between machines, store it
 * encrypted (e.g. as a GitHub Actions repo secret) and decrypt at CI time.
 */
import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const SLOTS = ['free', 'pro', 'admin', 'fresh'] as const;
type Slot = (typeof SLOTS)[number];

const EMAIL_FOR_SLOT: Record<Slot, string | undefined> = {
  free: process.env.TEST_FREE_EMAIL,
  pro: process.env.TEST_PRO_EMAIL,
  admin: process.env.TEST_ADMIN_EMAIL,
  fresh: process.env.TEST_FRESH_EMAIL,
};

function parseArgs(): { slot: Slot } {
  const arg = process.argv.find((a) => a.startsWith('--slot='));
  const slot = arg?.split('=')[1] as Slot | undefined;
  if (!slot || !SLOTS.includes(slot)) {
    console.error(`Usage: tsx e2e/auth-setup.ts --slot=<${SLOTS.join('|')}>`);
    process.exit(1);
  }
  return { slot };
}

async function main() {
  const { slot } = parseArgs();
  const baseUrl = process.env.BASE_URL ?? 'https://airon.coach';
  const expectedEmail = EMAIL_FOR_SLOT[slot];

  if (!expectedEmail) {
    console.error(
      `Missing TEST_${slot.toUpperCase()}_EMAIL in .env — copy .env.example and fill it in.`,
    );
    process.exit(1);
  }

  const authDir = path.resolve(__dirname, '.auth');
  await fs.mkdir(authDir, { recursive: true });
  const target = path.join(authDir, `${slot}.json`);

  console.log(`\nCapturing storage state for slot="${slot}"`);
  console.log(`  Expected email: ${expectedEmail}`);
  console.log(`  Target URL:     ${baseUrl}`);
  console.log(`  Output file:    ${target}\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  console.log('Browser opened. Please:');
  console.log('  1) Click Login and complete Google OAuth.');
  console.log(`  2) Make sure you signed in as ${expectedEmail}.`);
  console.log('  3) Land on /Dashboard or /Onboarding (whichever you expect for this slot).');
  console.log('  4) Then return here and press ENTER.\n');

  const rl = readline.createInterface({ input, output });
  await rl.question('Press ENTER once you have logged in successfully... ');
  rl.close();

  const me = await page.evaluate(() => {
    try {
      return localStorage.getItem('base44_access_token') ? 'token-present' : 'no-token';
    } catch {
      return 'eval-failed';
    }
  });

  if (me !== 'token-present') {
    console.warn(
      '  ⚠ No base44_access_token found in localStorage. Storage state will still be saved,',
    );
    console.warn(
      '    but the captured session may not authenticate. Re-run after a successful login.',
    );
  }

  await context.storageState({ path: target });
  await browser.close();

  const stat = await fs.stat(target);
  console.log(`\n✔ Wrote ${target} (${stat.size} bytes).`);
  console.log(`  Slot "${slot}" is ready.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
