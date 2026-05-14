/**
 * Promo capture (mobile) — companion to promo-capture.spec.ts.
 * Lives in its own file because Playwright forbids changing video/viewport
 * inside a describe block.
 */
import { test } from '../fixtures/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';

const PROMO = process.env.PROMO_CAPTURE === '1';
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../promo-assets/screenshots');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

test.describe('promo (mobile): walkthrough at 390px', () => {
  test.skip(
    !PROMO,
    'Run with PROMO_CAPTURE=1 (or `npm run e2e:promo`) to enable promo asset capture.',
  );

  test.beforeAll(() => {
    ensureDir(SCREENSHOTS_DIR);
  });

  test('mobile: dashboard → coach → log workout → settings', async ({ page }) => {
    test.setTimeout(180_000);

    let step = 100;
    const shot = async (slug: string) => {
      step += 1;
      const out = path.join(SCREENSHOTS_DIR, `${step}-mobile-${slug}.png`);
      await page.screenshot({ path: out, fullPage: true, animations: 'disabled' });
    };

    await page.goto(routes.dashboard);
    await expectAuthBootstrapped(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('dashboard');

    await page.goto(routes.chat);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('chat');

    await page.goto(routes.logWorkout);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('log-workout');

    await page.goto(routes.settings);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('settings');
  });
});
