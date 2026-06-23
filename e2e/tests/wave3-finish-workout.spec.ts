/**
 * Wave 3 — Finish workout: complete sets → Finish → summary shows volume / sets / duration.
 */
import { test, expect } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  clickStartWorkout,
  addExerciseFromSearch,
  logSet,
  finishWorkout,
  expectFinishSummary,
  closeFinishSummary,
  screenshotWave3,
  uploadWave3Artifacts,
  dismissInProgressWorkoutIfNeeded,
} from '../helpers/wave3';
import { pauseForApi } from '../helpers/wave2';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';

const FINISH_MARKER = 'Wave3 Finish';

test.describe('wave3-finish-workout', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(3_000);
    await dismissInProgressWorkoutIfNeeded(page);
  });

  test('finish workout shows summary with exercises, sets, and volume', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await page.goto(routes.training);
      await expectAuthBootstrapped(page);
      await pauseForApi(page);

      await clickStartWorkout(page);

      const nameInput = page.getByPlaceholder(/workout name/i);
      if (await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await nameInput.fill(FINISH_MARKER);
      }

      await addExerciseFromSearch(page, 'lateral raise');
      await logSet(page, 0, 15, 12);
      await pauseForApi(page);

      artifacts.push({
        label: 'pre-finish-active',
        localPath: await screenshotWave3(page, 'finish-workout-pre'),
        tags: ['workout', 'finish', 'pre'],
      });

      await finishWorkout(page);
      await expectFinishSummary(page);

      artifacts.push({
        label: 'finish-summary',
        localPath: await screenshotWave3(page, 'finish-workout-summary'),
        tags: ['workout', 'finish', 'summary'],
      });

      await closeFinishSummary(page);
      guards.assertClean('finish-workout');

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
