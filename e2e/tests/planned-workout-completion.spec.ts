/**
 * §4.4 — Planned workout completion.
 *
 * Verified against aironcoach/src/pages/WorkoutCalendar.jsx where line 161
 * writes `planned_workout_completed` ActivityLog. Uses the
 * `PlannedExerciseSet.bulkCreate` for seeding (avoids undeployed edge functions).
 */
import { test, expect } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import { expectActivityLog, expectAuthBootstrapped } from '../helpers/assertions';
import { cleanupForUser } from '../helpers/cleanup';
import { calendarEnsureMonthForDate } from '../helpers/calendarNav';
import { addCalendarDaysPlaywrightTZ, seedPlannedWorkout } from '../helpers/seed';

test.describe('§4.4 planned workout completion', () => {
  test.afterEach(async ({ api, slotEmail }) => {
    await cleanupForUser(api, {
      email: slotEmail,
      only: [
        'PlannedExerciseSet',
        'PlannedWorkout',
        'ExerciseSet',
        'Workout',
        'ActivityLog',
      ],
    });
  });

  test('completing a plan creates a Workout + writes planned_workout_completed log', async ({
    page,
    api,
    slotEmail,
  }) => {
    // Seed via backend (drag-create on a real DnD calendar is fragile and not
    // worth fighting in v1 — exercise the completion path instead).
    // Future day: compact calendar hides planned titles when a completed workout exists that day.
    const seedDate = addCalendarDaysPlaywrightTZ(21);
    const { planId, plannedSetIds } = await seedPlannedWorkout(api, {
      exerciseCount: 2,
      date: seedDate,
    });
    expect(plannedSetIds.length).toBeGreaterThanOrEqual(2);

    // Detailed DnD view lists every plan with its own Complete control (see DnDCalendarView).
    await page.goto(`${routes.workoutCalendar}?dnd=1`);
    await expectAuthBootstrapped(page);
    await page.waitForLoadState('networkidle');
    await calendarEnsureMonthForDate(page, seedDate);

    // Closest `WorkoutItemDetail` root from the title span (outer `div.rounded-lg.border` wrappers exist).
    const titleEl = page
      .locator('span.text-xs.font-medium.text-white.truncate')
      .filter({ hasText: /^E2E::\s*seed plan$/i })
      .first();
    await expect(titleEl).toBeVisible({ timeout: 15_000 });
    const planCard = titleEl.locator(
      'xpath=ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border")][1]',
    );
    await planCard.getByRole('button', { name: /^complete$|uko\u0144cz/i }).click({ timeout: 10_000 });

    // Backend assertions
    await expect
      .poll(
        async () =>
          (await api.filter<{ status?: string }>('PlannedWorkout', { id: planId }))[0]
            ?.status,
        { timeout: 20_000 },
      )
      .toBe('completed');

    const workouts = await api.filter<{ id: string }>(
      'Workout',
      { created_by: slotEmail },
      { sort: '-created_date', limit: 5 },
    );
    expect(workouts.length).toBeGreaterThanOrEqual(1);

    const newSets = await api.filter(
      'ExerciseSet',
      { workout_id: workouts[0].id },
      { limit: 50 },
    );
    expect(newSets.length).toBeGreaterThanOrEqual(2);

    await expectActivityLog(api, {
      email: slotEmail,
      actionType: 'planned_workout_completed',
      withinMs: 5 * 60_000,
    });
  });
});
