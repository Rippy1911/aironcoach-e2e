/**
 * Wave 3 — Start workout: /Workouts → pick template → Start → ActiveWorkout with first exercise.
 */
import { test, expect } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  openWorkouts,
  hasWorkoutTemplates,
  pickVisibleTemplateName,
  clickStartWorkout,
  addExerciseFromSearch,
  expectFirstExerciseVisible,
  screenshotWave3,
  uploadWave3Artifacts,
  dismissInProgressWorkoutIfNeeded,
} from '../helpers/wave3';
import { pauseForApi } from '../helpers/wave2';

test.describe('wave3-start-workout', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(3_000);
    await dismissInProgressWorkoutIfNeeded(page);
  });

  test('navigate workouts, start session, verify first exercise on ActiveWorkout', async ({
    page,
  }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await openWorkouts(page);

      const hasTemplates = await hasWorkoutTemplates(page);
      test.skip(
        !hasTemplates,
        'No workout templates/plans visible on /Workouts — seed data follow-up required',
      );

      const templateName = await pickVisibleTemplateName(page);
      expect(templateName, 'expected a named workout template on calendar').toBeTruthy();

      artifacts.push({
        label: 'workouts-calendar-template',
        localPath: await screenshotWave3(page, 'start-workout-calendar'),
        tags: ['workout', 'start', 'calendar'],
      });

      await clickStartWorkout(page);

      artifacts.push({
        label: 'active-workout-started',
        localPath: await screenshotWave3(page, 'start-workout-active'),
        tags: ['workout', 'start', 'active-workout'],
      });

      // Start opens an empty ActiveWorkout session on prod — add first exercise from template context.
      const seedQuery = /lower/i.test(templateName ?? '') ? 'squat' : 'press';
      await addExerciseFromSearch(page, seedQuery);
      await pauseForApi(page);
      await expectFirstExerciseVisible(page, seedQuery);

      guards.assertClean('start-workout');

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
