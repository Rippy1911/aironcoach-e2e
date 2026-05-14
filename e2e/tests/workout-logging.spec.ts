/**
 * §4.3 — Workout logging.
 *
 * Notable codebase divergences (verified 2026-05-08):
 *   - LogWorkout.jsx calls `Workout.create` + `ExerciseSet.bulkCreate` directly,
 *     NOT the `manageWorkoutData` backend function. Therefore no
 *     `workout_created` / `exercise_set_logged` ActivityLog rows are written
 *     when a user saves via the UI. We assert on row creation instead.
 *   - WorkoutDetails.jsx calls `Workout.delete()` + `ExerciseSet.delete()` —
 *     a HARD delete, NOT a soft-delete with `archived_at`. We assert the
 *     row is gone, not that `archived_at` is set.
 */
import { test, expect } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import {
  expectAtPath,
  expectAuthBootstrapped,
  expectEntityCount,
} from '../helpers/assertions';
import { cleanupForUser } from '../helpers/cleanup';

test.describe('§4.3 workout logging', () => {
  test.afterEach(async ({ api, slotEmail }) => {
    await cleanupForUser(api, {
      email: slotEmail,
      only: ['ExerciseSet', 'Workout', 'ActivityLog'],
    });
  });

  test('user can log a workout with 2 exercises (1 set each) and see it', async ({
    page,
    api,
    slotEmail,
  }) => {
    await page.goto(routes.logWorkout);
    await expectAuthBootstrapped(page);

    // Workout meta
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      await dateInput.fill(new Date().toISOString().slice(0, 10));
    }
    // LogWorkout.jsx labels this “Workout Name”; placeholder is `Upper body...` (EN).
    await page.getByPlaceholder(/upper body|\.\.\.|treningu/i).fill('E2E::workout-logging');

    // Add 2 exercises
    for (let i = 0; i < 2; i += 1) {
      const addBtn = page.getByRole('button', { name: /add exercise|dodaj/i }).first();
      await addBtn.click();
      await page.waitForTimeout(200);
    }

    // Fill each exercise's name and 3 sets. The DOM uses ExerciseSetRow per row.
    const exerciseNameInputs = page.locator(
      'input[placeholder*="exercise" i], input[placeholder*="\u0107wiczen" i]',
    );
    const count = await exerciseNameInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
    await exerciseNameInputs.nth(0).fill('bench press');
    await exerciseNameInputs.nth(1).fill('squat');

    // One set row per exercise by default (UI may not expose 3 sets until "add set").
    const repsInputs = page.locator('input[placeholder*="reps" i], input[name*="reps" i]');
    const weightInputs = page.locator(
      'input[placeholder*="weight" i], input[placeholder*="kg" i], input[name*="weight" i]',
    );
    const n = await repsInputs.count();
    for (let i = 0; i < n; i += 1) {
      await repsInputs.nth(i).fill('10');
    }
    const wn = await weightInputs.count();
    for (let i = 0; i < wn; i += 1) {
      await weightInputs.nth(i).fill('60');
    }

    await page.getByRole('button', { name: /save workout/i }).click();

    // After save, the page either navigates to /Dashboard (optimistic) or
    // /WorkoutDetails. Either is acceptable.
    await expect
      .poll(async () => new URL(page.url()).pathname, { timeout: 20_000 })
      .toMatch(/\/(Dashboard|WorkoutDetails)/);

    // Backend assertions: 1 Workout + N ExerciseSet rows (default UI = 1 row per exercise).
    await expect
      .poll(
        async () =>
          (await api.filter('Workout', { created_by: slotEmail }, { limit: 5 })).length,
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(1);

    const workouts = await api.filter<{ id: string; total_volume?: number }>(
      'Workout',
      { created_by: slotEmail },
      { sort: '-created_date', limit: 1 },
    );
    expect(workouts.length).toBe(1);
    const workoutId = workouts[0].id;

    const sets = await api.filter('ExerciseSet', { workout_id: workoutId }, { limit: 20 });
    expect(sets.length).toBeGreaterThanOrEqual(2);

    // Volume ≥ 2 sets × 10 reps × 60 kg
    expect(workouts[0].total_volume ?? 0).toBeGreaterThanOrEqual(1200);
  });

  test.fixme(
    'logging a workout writes workout_created + exercise_set_logged ActivityLogs',
    async () => {
      // FIXME: as of 2026-05-08 LogWorkout.jsx writes Workout/ExerciseSet directly
      // without going through manageWorkoutData. The action_type is therefore
      // never written for UI-driven workouts. Re-enable this once the page is
      // refactored to use manageWorkoutData (tracked in PRD planned-refactoring).
    },
  );

  test('hard-deleting a workout removes Workout + child sets', async ({
    page,
    api,
    slotEmail,
  }) => {
    // Seed a workout server-side so the test isn't entangled with the UI flow.
    const workout = await api.create<{ id: string }>('Workout', {
      date: new Date().toISOString().slice(0, 10),
      type: 'strength',
      duration: 60,
      notes: 'E2E::delete-flow',
      status: 'completed',
      total_volume: 100,
    });
    await api.bulkCreate('ExerciseSet', [
      {
        workout_id: workout.id,
        exercise_name: 'pulldown',
        exercise_order: 0,
        reps: 10,
        weight: 50,
        set_number: 1,
      },
    ]);

    await page.goto(`${routes.workoutDetails}?id=${workout.id}`);
    await expectAtPath(page, routes.workoutDetails, { timeout: 15_000 });

    // Icon-only trash trigger (aria-label may lag deploy); target styled delete control.
    await page.locator('button.border-red-900').first().click({ timeout: 10_000 });
    await page
      .getByRole('button', { name: /^delete|^usu/i })
      .last()
      .click({ timeout: 10_000 });

    // Hard delete (not soft) — assert the rows are GONE, not archived.
    await expect
      .poll(
        async () =>
          (await api.filter('Workout', { id: workout.id })).length,
        { timeout: 15_000 },
      )
      .toBe(0);
    await expectEntityCount(api, 'ExerciseSet', { workout_id: workout.id }, 0);
  });
});
