/**
 * Wave 3 — Workout history: after finishing, workout appears on WorkoutCalendar list for today.
 */
import { test } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  startWorkoutFromTraining,
  addExerciseFromSearch,
  logSet,
  finishWorkout,
  expectFinishSummary,
  closeFinishSummary,
  openWorkoutHistoryList,
  expectWorkoutInHistory,
  screenshotWave3,
  uploadWave3Artifacts,
  dismissInProgressWorkoutIfNeeded,
  wave3PaceBetweenSpecs,
} from '../helpers/wave3';
import { pauseForApi } from '../helpers/wave2';

test.describe('wave3-workout-history', () => {
  test.describe.configure({ retries: 1 });

  test.beforeEach(async ({ page }) => {
    await wave3PaceBetweenSpecs(page);
    await dismissInProgressWorkoutIfNeeded(page);
  });

  test('finished workout appears in calendar list view for today', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];
    const exerciseQuery = 'shrug';

    try {
      await startWorkoutFromTraining(page);
      await addExerciseFromSearch(page, exerciseQuery);
      await logSet(page, 0, 12, 40);
      await pauseForApi(page);

      await finishWorkout(page);
      await expectFinishSummary(page);
      await closeFinishSummary(page);
      await pauseForApi(page);

      await openWorkoutHistoryList(page);

      artifacts.push({
        label: 'history-list-today',
        localPath: await screenshotWave3(page, 'workout-history-list'),
        tags: ['workout', 'history', 'list'],
      });

      await expectWorkoutInHistory(page, exerciseQuery);

      guards.assertClean('workout-history');

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
