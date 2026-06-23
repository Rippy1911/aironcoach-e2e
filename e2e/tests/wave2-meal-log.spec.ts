/**
 * Wave 2 — Meal log deep flow: search → portion → confirm → verify today's log.
 */
import { test, expect } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  openFoodSearch,
  searchAndPickFirst,
  setPortionGrams,
  confirmAddMeal,
  expectMealInTodayLog,
  screenshotWave2,
  uploadWave2Artifacts,
  pauseForApi,
} from '../helpers/wave2';

test.describe('wave2-meal-log', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(3_000);
  });

  test('log kefir 200g and verify in today log', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await openFoodSearch(page);
      await searchAndPickFirst(page, 'kefir');

      artifacts.push({
        label: 'portion-panel-kefir',
        localPath: await screenshotWave2(page, 'meal-log-portion-kefir'),
        tags: ['nutrition', 'meal-log', 'portion'],
      });

      await setPortionGrams(page, 200);
      await confirmAddMeal(page);
      await pauseForApi(page);

      artifacts.push({
        label: 'meal-logged-kefir',
        localPath: await screenshotWave2(page, 'meal-log-today-kefir'),
        tags: ['nutrition', 'meal-log', 'today-log'],
      });

      await expectMealInTodayLog(page, 'kefir');
      guards.assertClean('meal-log');

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
