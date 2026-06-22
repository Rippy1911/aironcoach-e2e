/**
 * Wave 1 — Nutrition search smoke (CRITICAL regression guard for searchProducts).
 *
 * Uses `pro` storage state. Verifies Polish + English food search against prod.
 */
import { test, expect } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { attachPageGuards } from '../helpers/pageGuards';
import { screenshotFullPage, uploadWave1Artifacts } from '../helpers/wave1';

async function openFoodSearch(page: import('@playwright/test').Page) {
  await page.goto(routes.nutrition);
  await expectAuthBootstrapped(page);

  const addBtn = page.getByRole('button', { name: /^Add$/i }).first();
  await expect(addBtn).toBeVisible({ timeout: 15_000 });
  await addBtn.click();

  const searchItem = page.getByRole('menuitem', { name: /search/i }).or(
    page.getByRole('button', { name: /search/i }),
  ).or(page.getByText(/^Search$/i)).first();
  await expect(searchItem).toBeVisible({ timeout: 10_000 });
  await searchItem.click();
}

async function searchAndAssertResults(
  page: import('@playwright/test').Page,
  query: string,
  opts: { assertSearchProducts?: boolean } = {},
) {
  const searchInput = page
    .getByPlaceholder(/search/i)
    .or(page.locator('input[type="search"]'))
    .or(page.locator('[role="combobox"] input'))
    .first();
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(query);

  let searchResponse: import('@playwright/test').Response | null = null;
  if (opts.assertSearchProducts) {
  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().includes('/api/functions/searchProducts') &&
      res.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await searchInput.press('Enter').catch(() => searchInput.fill(query));
  searchResponse = await responsePromise.catch(() => null);
  } else {
    await page.waitForTimeout(500);
  }

  // Wait ≤5 sec for results
  const resultRow = page
    .locator('[role="option"], [data-search-result], li')
    .filter({ hasText: /\d+\s*kcal|\d+\s*cal/i })
    .first();
  await expect(resultRow, `expected ≥1 result with kcal for "${query}"`).toBeVisible({
    timeout: 5_000,
  });

  if (opts.assertSearchProducts && searchResponse) {
    const status = searchResponse.status();
    if (status === 500) {
      throw new Error(
        'searchProducts regression — PR #52 fix did not stick OR Base44 prod has not redeployed yet',
      );
    }
    expect(status, 'searchProducts should return 200').toBe(200);
  }

  return resultRow;
}

test.describe('smoke-nutrition-search', () => {
  test('Polish + English food search with portion dialog', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await openFoodSearch(page);

      // ── Polish query ───────────────────────────────────────────────────
      const polishResult = await searchAndAssertResults(page, 'kefir mlekovita');

      artifacts.push({
        label: 'search-kefir',
        localPath: await screenshotFullPage(page, 'nutrition-search-kefir-dropdown'),
        tags: ['nutrition', 'search-flow', 'kefir'],
      });

      await polishResult.click();
      const portionDialog = page.locator('[role="dialog"]').first();
      await expect(portionDialog).toBeVisible({ timeout: 10_000 });

      // Serving size selector + macro preview
      await expect(
        portionDialog.getByText(/serving|portion|gram|g\b|100g|size/i).first(),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        portionDialog.getByText(/kcal|cal|protein|carb|fat|macro/i).first(),
      ).toBeVisible({ timeout: 10_000 });

      artifacts.push({
        label: 'portion-dialog-kefir',
        localPath: await screenshotFullPage(page, 'nutrition-portion-dialog-kefir'),
        tags: ['nutrition', 'search-flow', 'portion'],
      });

      const cancelBtn = portionDialog.getByRole('button', { name: /cancel|anuluj|close/i }).first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }

      // ── English query + network assertion ──────────────────────────────
      await openFoodSearch(page);
      await searchAndAssertResults(page, 'yogurt', { assertSearchProducts: true });

      artifacts.push({
        label: 'search-yogurt',
        localPath: await screenshotFullPage(page, 'nutrition-search-yogurt-dropdown'),
        tags: ['nutrition', 'search-flow', 'yogurt'],
      });

      guards.assertClean('nutrition-search');

      const uploads = await uploadWave1Artifacts(artifacts);
      test.info().attach('fcv-uploads', {
        body: JSON.stringify(uploads, null, 2),
        contentType: 'application/json',
      });
    } finally {
      guards.detach();
    }
  });
});
