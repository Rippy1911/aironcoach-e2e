/**
 * Wave 2 — Custom food CRUD: create via Nutrition → Add custom → verify in search.
 */
import { test, expect } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  openCustomFoodForm,
  fillCustomFood,
  saveCustomFood,
  openFoodSearch,
  foodSearchInput,
  screenshotWave2,
  uploadWave2Artifacts,
  pauseForApi,
} from '../helpers/wave2';

const CUSTOM_NAME = `E2E Wave2 ${Date.now()}`;

test.describe('wave2-custom-food', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(3_000);
  });

  test('create custom food and find it in search', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await openCustomFoodForm(page);
      await fillCustomFood(page, {
        name: CUSTOM_NAME,
        kcal: 250,
        protein: 20,
        carbs: 30,
        fat: 8,
      });

      artifacts.push({
        label: 'custom-food-form',
        localPath: await screenshotWave2(page, 'custom-food-form'),
        tags: ['nutrition', 'custom-food', 'form'],
      });

      await saveCustomFood(page);

      await openFoodSearch(page);
      const searchInput = foodSearchInput(page);
      await searchInput.fill(CUSTOM_NAME);
      await pauseForApi(page, 1_500);

      const result = page.getByText(CUSTOM_NAME).first();
      await expect(result, `custom food "${CUSTOM_NAME}" should appear in search`).toBeVisible({
        timeout: 15_000,
      });

      artifacts.push({
        label: 'custom-food-search-hit',
        localPath: await screenshotWave2(page, 'custom-food-search-hit'),
        tags: ['nutrition', 'custom-food', 'search'],
      });

      guards.assertClean('custom-food');

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
