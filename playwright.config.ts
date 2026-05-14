import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import * as path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '.env') });

const BASE_URL = process.env.BASE_URL ?? 'https://break-through-ai.base44.app';
const HEADED = process.env.HEADED === '1';
const isCI = !!process.env.CI;
const PROMO = process.env.PROMO_CAPTURE === '1';
const BROWSER_CHANNEL = process.env.PLAYWRIGHT_CHANNEL;

const STORAGE_DIR = path.resolve(__dirname, 'e2e/.auth');
const storageStateFor = (slot: 'free' | 'pro' | 'admin' | 'fresh') =>
  path.join(STORAGE_DIR, `${slot}.json`);

// Marketing-grade output goes to a deterministic folder so links can be
// shared without rewriting paths every run.
const PROMO_OUTPUT_DIR = path.resolve(__dirname, 'promo-assets');

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: PROMO ? path.join(PROMO_OUTPUT_DIR, 'raw') : './test-results',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : 4,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: !HEADED,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Europe/Warsaw',
  },
  projects: [
    {
      name: 'anonymous',
      testMatch: /smoke-anonymous\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'pro',
      // Same storage state + DB user: parallel specs wipe each other's ActivityLog / workouts.
      workers: 1,
      testMatch:
        /(01-pro-full-journey|smoke-pro-routing|workout-logging|planned-workout-completion|ai-coach-chat-pro)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: storageStateFor('pro'),
      },
    },
    {
      name: 'free',
      testMatch:
        /(ai-coach-chat-free|premium-upgrade|payu-upgrade|coupon-redemption)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: storageStateFor('free'),
      },
    },
    {
      name: 'admin',
      testMatch: /smoke-admin-routing\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: storageStateFor('admin'),
      },
    },
    {
      name: 'fresh',
      testMatch: /(onboarding|account-deletion)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: storageStateFor('fresh'),
      },
    },
    {
      name: 'mobile-pro',
      testMatch: /smoke-mobile-nav\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        storageState: storageStateFor('pro'),
      },
    },

    // -----------------------------------------------------------------------
    // Promo capture projects
    // -----------------------------------------------------------------------
    // `npm run e2e:promo` runs both. Records video + saves named full-page
    // screenshots to ./promo-assets/. Uses the pro slot so paywalled surfaces
    // (Chat, premium UI states) capture cleanly.
    {
      name: 'promo',
      testMatch: /promo-capture\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: storageStateFor('pro'),
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
        video: { mode: 'on', size: { width: 1920, height: 1080 } },
        screenshot: 'off',
        trace: 'off',
        actionTimeout: 30_000,
        launchOptions: { slowMo: 350 },
      },
    },
    {
      name: 'promo-mobile',
      testMatch: /promo-capture-mobile\.spec\.ts/,
      use: {
        ...devices['iPhone 13 Pro'],
        storageState: storageStateFor('pro'),
        viewport: { width: 390, height: 844 },
        video: { mode: 'on', size: { width: 390, height: 844 } },
        screenshot: 'off',
        trace: 'off',
        actionTimeout: 30_000,
        launchOptions: { slowMo: 350 },
      },
    },
  ],
});
