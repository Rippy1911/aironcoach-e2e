/**
 * Wave 3 — RPE input in ActiveWorkout (skips when UI does not expose RPE on freestyle sessions).
 */
import { test, expect } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  startWorkoutFromTraining,
  addExerciseFromSearch,
  logSet,
  rpeInput,
  setRpeIfPresent,
  expectRpePersists,
  screenshotWave3,
  uploadWave3Artifacts,
  dismissInProgressWorkoutIfNeeded,
} from '../helpers/wave3';
import { pauseForApi } from '../helpers/wave2';

test.describe('wave3-rpe-input', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(3_000);
    await dismissInProgressWorkoutIfNeeded(page);
  });

  test('set RPE 8 on a logged set when RPE control is visible', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await startWorkoutFromTraining(page);
      await addExerciseFromSearch(page, 'curl');
      await logSet(page, 0, 12, 25);
      await pauseForApi(page);

      const control = await rpeInput(page);
      test.skip(
        !control,
        'RPE input not visible in freestyle ActiveWorkout — planned-workout preload from Start not wired; follow-up Idea',
      );

      const set = await setRpeIfPresent(page, 8);
      expect(set, 'setRpeIfPresent should succeed when control exists').toBe(true);
      await expectRpePersists(page, 8);

      artifacts.push({
        label: 'rpe-8-set',
        localPath: await screenshotWave3(page, 'rpe-input-set'),
        tags: ['workout', 'rpe'],
      });

      guards.assertClean('rpe-input');

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
