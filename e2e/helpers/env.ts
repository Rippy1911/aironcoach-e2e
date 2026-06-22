import { config as loadEnv } from 'dotenv';
import * as path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '..', '..', '.env') });

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return v;
}

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export const env = {
  baseUrl: optional('BASE_URL', 'https://airon.coach')!,
  appId: optional('BASE44_APP_ID'),
  appBaseUrl: optional('BASE44_APP_BASE_URL'),
  /**
   * Lazy so `playwright test --project=anonymous` can run with only `BASE_URL`
   * set — full suite still requires all four `TEST_*_EMAIL` when a slotted
   * project runs.
   */
  get emails(): Record<Slot, string> {
    return {
      free: required('TEST_FREE_EMAIL'),
      pro: required('TEST_PRO_EMAIL'),
      admin: required('TEST_ADMIN_EMAIL'),
      fresh: required('TEST_FRESH_EMAIL'),
    };
  },
  stripe: {
    enabled: !!process.env.STRIPE_TEST_KEY,
    testCard: optional('STRIPE_TEST_CARD', '4242424242424242')!,
  },
  isCI: !!process.env.CI,
};

export type Slot = 'free' | 'pro' | 'admin' | 'fresh';

export function emailForSlot(slot: Slot): string {
  return env.emails[slot];
}
