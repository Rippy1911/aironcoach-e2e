/**
 * § Pro user — full product slice in one flow (runs early in the suite — filename prefix).
 *   1) AI Coach chat — send a user message (assert user bubble).
 *   2) Log Workout — create a tagged workout via Log Workout UI.
 *   3) Workout Details — edit workout name/notes, save.
 *   4) Delete — hard-delete from details.
 *
 * ActivityLog cleanup first: other pro specs seed many chat logs for daily-limit tests.
 *
 * Log Workout “Workout Name” field uses placeholder `Upper body...` (not “notes”) — see LogWorkout.jsx.
 */
import { test, expect } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { cleanupForUser } from '../helpers/cleanup';

test.describe('§ pro full journey', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ api, slotEmail }) => {
    await cleanupForUser(api, {
      email: slotEmail,
      only: ['ExerciseSet', 'Workout', 'ActivityLog', 'Conversation', 'Message'],
    });
  });

  test('AI chat → log workout → edit → delete', async ({ page, api, slotEmail }) => {
    await cleanupForUser(api, {
      email: slotEmail,
      only: ['ActivityLog'],
    });

    const marker = `E2E-JOURNEY-${Date.now()}`;

    await page.goto(routes.chat);
    await expectAuthBootstrapped(page);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeEnabled({ timeout: 20_000 });
    await chatInput.fill(`Journey marker: ${marker}`);
    await chatInput.press('Enter');

    await expect(page.getByText(`Journey marker: ${marker}`, { exact: true }).first()).toBeVisible({
      timeout: 120_000,
    });

    await page.goto(routes.logWorkout);
    await expectAuthBootstrapped(page);

    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      await dateInput.fill(new Date().toISOString().slice(0, 10));
    }

    await page.getByPlaceholder(/upper body|\.\.\.|treningu/i).fill(marker);

    await page.getByRole('button', { name: /add exercise|dodaj/i }).first().click();
    await page.waitForTimeout(400);

    const exerciseNameInputs = page.locator(
      'input[placeholder*="exercise" i], input[placeholder*="\u0107wiczen" i]',
    );
    await exerciseNameInputs.first().fill('journey lift');

    const repsInputs = page.locator('input[placeholder*="reps" i], input[name*="reps" i]');
    const weightInputs = page.locator(
      'input[placeholder*="weight" i], input[placeholder*="kg" i], input[name*="weight" i]',
    );
    await repsInputs.first().fill('9');
    await weightInputs.first().fill('65');

    await page.getByRole('button', { name: /save workout/i }).click();

    await expect
      .poll(
        async () => {
          const rows = await api.filter<{ id: string; notes?: string }>(
            'Workout',
            { created_by: slotEmail },
            { sort: '-created_date', limit: 12 },
          );
          return rows.find((w) => (w.notes || '').includes(marker))?.id ?? null;
        },
        { timeout: 35_000 },
      )
      .not.toBeNull();

    const workouts = await api.filter<{ id: string }>('Workout', { created_by: slotEmail }, {
      sort: '-created_date',
      limit: 12,
    });
    const workoutId = workouts.find((w) => (w.notes || '').includes(marker))!.id;

    await page.goto(`${routes.workoutDetails}?id=${workoutId}`);
    await expectAuthBootstrapped(page);
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /edit|edytuj/i }).first().click();

    const edited = `${marker} edited`;
    await page.getByPlaceholder('Workout name').fill(edited);

    await page.getByRole('button', { name: /^save$|^zapisz$/i }).first().click();

    await expect(page.getByText(edited)).toBeVisible({ timeout: 20_000 });

    await page.locator('button.border-red-900').first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: /^delete$|^usuń$/i }).click();

    await expect
      .poll(async () => (await api.filter('Workout', { id: workoutId })).length, {
        timeout: 20_000,
      })
      .toBe(0);
  });
});
