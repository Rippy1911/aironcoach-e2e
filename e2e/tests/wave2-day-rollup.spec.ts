/**
 * Wave 2 — Daily macro rollup updates after logging a meal.
 */
import { test, expect } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  openNutrition,
  openFoodSearch,
  searchAndPickFirst,
  setPortionGrams,
  confirmAddMeal,
  readDailyMacros,
  screenshotWave2,
  uploadWave2Artifacts,
  pauseForApi,
} from '../helpers/wave2';

test.describe('wave2-day-rollup', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(3_000);
  });

  test('daily macros increase after logging a meal', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await openNutrition(page);
      const before = await readDailyMacros(page);

      artifacts.push({
        label: 'macros-before',
        localPath: await screenshotWave2(page, 'day-rollup-before'),
        tags: ['nutrition', 'day-rollup', 'before'],
      });

      await openFoodSearch(page);
      await searchAndPickFirst(page, 'kefir');
      await setPortionGrams(page, 200);
      await confirmAddMeal(page);
      await pauseForApi(page);

      await openNutrition(page);
      const after = await readDailyMacros(page);

      artifacts.push({
        label: 'macros-after',
        localPath: await screenshotWave2(page, 'day-rollup-after'),
        tags: ['nutrition', 'day-rollup', 'after'],
      });

      test.info().attach('macro-delta', {
        body: JSON.stringify({ before, after }, null, 2),
        contentType: 'application/json',
      });

      const kcalDelta = after.kcal - before.kcal;
      const proteinDelta = after.protein - before.protein;
      const carbsDelta = after.carbs - before.carbs;
      const fatDelta = after.fat - before.fat;

      expect(
        kcalDelta > 0 || proteinDelta > 0 || carbsDelta > 0 || fatDelta > 0,
        `expected at least one macro to increase after meal log; deltas: kcal=${kcalDelta}, P=${proteinDelta}, C=${carbsDelta}, F=${fatDelta}`,
      ).toBeTruthy();

      guards.assertClean('day-rollup');

      const uploads = await uploadWave2Artifacts(artifacts);
      test.info().attach('fcv-uploads', {
        body: JSON.stringify(uploads, null, 2),
        contentType: 'application/json',
      });
    } finally {
      guards.detach();
    }
  });
});
