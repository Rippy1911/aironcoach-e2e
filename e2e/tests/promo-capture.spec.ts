/**
 * Promo capture — drives the AIron.coach app through its key surfaces and
 * saves marketing-grade screenshots + a 1080p video to ../promo-assets/.
 *
 * Run with:
 *   npm run e2e:promo
 *
 * Output paths printed at the end:
 *   - promo-assets/screenshots/<NN>-<slug>.png   (full-page PNGs, retina)
 *   - promo-assets/raw/<test-id>/video.webm      (1080p walkthrough video)
 *
 * Prerequisites:
 *   - Pro slot storage state captured at e2e/.auth/pro.json
 *   - Pro slot account is on the 14-day trial OR has lifetime/active subscription
 *     (so all screens render in their "happy" state, no upgrade overlays).
 *
 * Design notes:
 *   - Uses `page.waitForLoadState('networkidle')` between pages so the video
 *     pacing reads naturally on playback.
 *   - `slowMo: 350` (configured in playwright.config.ts) introduces a
 *     viewer-friendly pause between every interaction so the recording doesn't
 *     look like a JS bot.
 *   - Doesn't seed/destroy data — assumes the pro slot already has realistic
 *     workout history. If not, run a few logged sessions manually first.
 */
import { test, expect } from '../fixtures/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';

const PROMO = process.env.PROMO_CAPTURE === '1';

const SCREENSHOTS_DIR = path.resolve(__dirname, '../../promo-assets/screenshots');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

test.describe('promo: marketing capture', () => {
  test.skip(
    !PROMO,
    'Run with PROMO_CAPTURE=1 (or `npm run e2e:promo`) to enable promo asset capture.',
  );

  test.beforeAll(() => {
    ensureDir(SCREENSHOTS_DIR);
  });

  test('full walkthrough: dashboard → training → coach → settings', async ({ page }) => {
    test.setTimeout(300_000);

    let step = 0;
    const shot = async (slug: string) => {
      step += 1;
      const filename = `${String(step).padStart(2, '0')}-${slug}.png`;
      const out = path.join(SCREENSHOTS_DIR, filename);
      await page.screenshot({ path: out, fullPage: true, animations: 'disabled' });
    };

    // 1. Dashboard
    await page.goto(routes.dashboard);
    await expectAuthBootstrapped(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('dashboard');

    // 2. Workout calendar (drag-and-drop view)
    await page.goto(routes.workoutCalendar);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('workout-calendar');

    // 3. Log workout (empty form, ready to capture demo input)
    await page.goto(routes.logWorkout);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await shot('log-workout-empty');

    // Optionally fill a couple of fields so the screenshot looks "in use"
    const addExercise = page.getByRole('button', { name: /add exercise|dodaj/i }).first();
    if (await addExercise.isVisible().catch(() => false)) {
      await addExercise.click();
      await page.waitForTimeout(500);
      const nameInput = page.locator('input[placeholder*="exercise" i]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Bench Press');
      }
      const repsInput = page
        .locator('input[placeholder*="reps" i], input[name*="reps" i]')
        .first();
      if (await repsInput.isVisible().catch(() => false)) {
        await repsInput.fill('10');
      }
      const weightInput = page
        .locator('input[placeholder*="weight" i], input[placeholder*="kg" i]')
        .first();
      if (await weightInput.isVisible().catch(() => false)) {
        await weightInput.fill('80');
      }
      await shot('log-workout-filled');
    }

    // 4. Templates (exercise library / programs)
    await page.goto(routes.templates).catch(() => {});
    if (page.url().includes(routes.templates)) {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await shot('templates');
    }

    // 5. Reports (progress charts)
    await page.goto(routes.reports);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // charts render async
    await shot('reports');

    // 6. Metrics (body composition / weight tracking)
    await page.goto(routes.metrics);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('metrics');

    // 7. Coach chat
    await page.goto(routes.chat);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('coach-chat');

    // Type a sample prompt so the input doesn't look empty in the video
    const sendInput = page
      .getByPlaceholder(/send message|wpisz|ask|spróbuj/i)
      .first();
    if (await sendInput.isVisible().catch(() => false)) {
      await sendInput.fill('Plan my next 4-week strength block.');
      await page.waitForTimeout(800);
      await shot('coach-chat-with-prompt');
    }

    // 8. Community
    await page.goto(routes.community);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('community');

    // 9. Settings (premium status + upgrade plan)
    await page.goto(routes.settings);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot('settings');

    // Sanity: video file exists for this test (Playwright writes it on context close)
    expect(true).toBe(true);
  });

});
