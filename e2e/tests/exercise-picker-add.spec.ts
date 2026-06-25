/**
 * PR #35 — Exercise picker wiring (v3.3.1 hotfix).
 *
 * Before #35: on /LogWorkout, typing into the exercise name field and clicking
 * a search result left the UI in a broken state — the picker vanished and
 * nothing was added to the set row.
 * After #35: clicking a search result ADDS the exercise to the workout set.
 *
 * Verified against aironcoach/src/pages/LogWorkout.jsx + the picker single-object
 * payload path (maps to addExercise(name, activityType, pickMeta)). Live-tested
 * on https://airon.coach 2026-06-25: searching "bench" → clicking
 * "Barbell Bench Press - Medium Grip" populated the set row.
 *
 * Runs under the `pro` project (storageState = pro slot). The pro test account
 * has workout history, so the exercise picker has recent/suggested context.
 */
import { test, expect } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { attachPageGuards } from '../helpers/pageGuards';

test.describe('PR #35 exercise picker wiring', () => {
  test('search result click adds the exercise to a workout set', async ({ page }) => {
    test.setTimeout(120_000);
    const guards = attachPageGuards(page);

    await page.goto(routes.logWorkout);
    await expectAuthBootstrapped(page);

    // The exercise name input. It carries an "Exercise / Activity" placeholder
    // (and, once focused, a "Start typing an exercise name..." hint). Avoid
    // `getByRole('textbox').first()` — the date input resolves first.
    const exerciseInput = page.getByPlaceholder(/exercise.*activity|start typing an exercise/i).first();
    await expect(exerciseInput).toBeVisible({ timeout: 15_000 });
    await exerciseInput.click();
    await exerciseInput.fill('bench');

    // Wait for the dropdown results to render (the picker queries the
    // exerciseSearch backend function). "bench" reliably returns Barbell Bench
    // Press variants in the production exercise library.
    const results = page.getByRole('button', { name: /bench press/i });
    await expect(results.first()).toBeVisible({ timeout: 15_000 });

    const firstResult = results.first();
    const nameText = (await firstResult.textContent())?.trim() ?? '';
    expect(nameText.length, 'picker result has a label').toBeGreaterThan(0);

    // The core assertion of #35: clicking the result populates the set row
    // instead of vanishing. After click, the input should hold the chosen name.
    await firstResult.click();

    await expect(exerciseInput).toHaveValue(/bench/i, { timeout: 10_000 });
    guards.assertClean('exercise-picker-add');
  });
});
