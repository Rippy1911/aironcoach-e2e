/**
 * Wave 3 — Log sets in ActiveWorkout: reps + weight → verify set rows in history list.
 */
import { test, expect } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  clickStartWorkout,
  addExerciseFromSearch,
  logSet,
  addSetRow,
  expectSetInHistory,
  expectFirstExerciseVisible,
  screenshotWave3,
  uploadWave3Artifacts,
  dismissInProgressWorkoutIfNeeded,
  openWorkouts,
} from '../helpers/wave3';
import { pauseForApi } from '../helpers/wave2';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';

test.describe('wave3-log-set', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(3_000);
    await dismissInProgressWorkoutIfNeeded(page);
  });

  test('log two sets and verify they appear in the exercise set list', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await page.goto(routes.training);
      await expectAuthBootstrapped(page);
      await pauseForApi(page);

      await clickStartWorkout(page);
      await addExerciseFromSearch(page, 'row');
      await expectFirstExerciseVisible(page, /row/i);

      await logSet(page, 0, 10, 50);
      await expectSetInHistory(page, 10, 50);

      artifacts.push({
        label: 'set-1-logged',
        localPath: await screenshotWave3(page, 'log-set-first'),
        tags: ['workout', 'log-set', 'set-1'],
      });

      await addSetRow(page);
      await pauseForApi(page);
      await logSet(page, 1, 10, 52);
      await expectSetInHistory(page, 10, 52);

      artifacts.push({
        label: 'set-2-logged',
        localPath: await screenshotWave3(page, 'log-set-second'),
        tags: ['workout', 'log-set', 'set-2'],
      });

      guards.assertClean('log-set');

      const uploads = await uploadWave3Artifacts(artifacts);
      test.info().attach('fcv-uploads', {
        body: JSON.stringify(uploads, null, 2),
        contentType: 'application/json',
      });
    } finally {
      guards.detach();
    }
  });
});
