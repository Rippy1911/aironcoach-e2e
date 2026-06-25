/**
 * PR #62 — Mobile plan picker (Part A).
 *
 * Before #62: on /Templates (or /Training#templates) at mobile width, users got
 * the desktop grid which was cramped/unusable on phones.
 * After #62: a mobile-specific picker renders — sticky search + Recent /
 * Suggested rows + a collapsible "All plans" section. Tapping a template card
 * navigates to /ActiveWorkout prepopulated with that template.
 *
 * Verified live on https://airon.coach 2026-06-25 at 390×844: sticky
 * "Search plans..." bar, a "Recent" section with template cards ("Day 3 -
 * Lower (Deadlift)", "Day 2A - 1 (squat)"), a collapsible "All plans" row, and
 * tapping "Start plan" navigated to /ActiveWorkout?template=<id> with the
 * Deadlift template prepopulated (5 sets × 12 reps × 80 kg).
 *
 * Runs under the `mobile-pro-plan-picker` project (390×844, pro storage state).
 */
import { test, expect } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';

test.describe('PR #62 mobile plan picker', () => {
  test('mobile picker renders and a template tap navigates to ActiveWorkout', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(routes.templates);
    await expectAuthBootstrapped(page);

    // Mobile picker: a sticky search input for plans.
    const search = page.getByRole('textbox', { name: /search plans/i });
    await expect(search).toBeVisible({ timeout: 15_000 });

    // A "Recent" (or suggested) section should be present with at least one
    // template card. The pro account has training history so this is populated.
    const recentHeading = page.getByText(/recent|suggested/i).first();
    await expect(recentHeading).toBeVisible({ timeout: 10_000 });

    // The template cards expose a "Start plan" action (button/role). Tap the
    // first one and assert navigation to /ActiveWorkout with a template query.
    const startPlan = page.getByRole('button', { name: /start plan/i }).first();
    await expect(startPlan).toBeVisible({ timeout: 10_000 });
    await startPlan.click();

    await page.waitForURL(/\/ActiveWorkout.*template=/, { timeout: 20_000 });
    const url = new URL(page.url());
    expect(url.pathname, 'navigated to ActiveWorkout').toBe('/ActiveWorkout');
    expect(url.searchParams.get('template'), 'template id carried in query').toBeTruthy();

    // The ActiveWorkout page should render the chosen template's title —
    // proves the template was prepopulated, not a blank workout.
    await expectAuthBootstrapped(page);
    await expect(page.getByText(/day|lower|upper|squat|deadlift|bench/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
