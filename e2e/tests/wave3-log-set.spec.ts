/**
 * Wave 3 — Log sets in ActiveWorkout: reps + weight → verify set rows in history list.
 */
import { test } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  startWorkoutFromTraining,
  addExerciseFromSearch,
  logSet,
  addSetRow,
  expectSetInHistory,
  expectFirstExerciseVisible,
  screenshotWave3,
  uploadWave3Artifacts,
  dismissInProgressWorkoutIfNeeded,
  cleanupActiveWorkout,
  wave3PaceBetweenSpecs,
} from '../helpers/wave3';
import { pauseForApi } from '../helpers/wave2';

const EXERCISE = 'pulldown';

test.describe('wave3-log-set', () => {
  test.beforeEach(async ({ page }) => {
    await wave3PaceBetweenSpecs(page);
    await dismissInProgressWorkoutIfNeeded(page);
  });

  test('log two sets and verify they appear in the exercise set list', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await startWorkoutFromTraining(page);
      await addExerciseFromSearch(page, EXERCISE);
      await expectFirstExerciseVisible(page, EXERCISE);

      await logSet(page, 0, 10, 50, EXERCISE);
      await expectSetInHistory(page, 10, 50, EXERCISE);

      artifacts.push({
        label: 'set-1-logged',
        localPath: await screenshotWave3(page, 'log-set-first'),
        tags: ['workout', 'log-set', 'set-1'],
      });

      await addSetRow(page, EXERCISE);
      await pauseForApi(page);
      await logSet(page, 1, 10, 52, EXERCISE);
      await expectSetInHistory(page, 10, 52, EXERCISE);

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
      await cleanupActiveWorkout(page).catch(() => {});
    }
  });
});
