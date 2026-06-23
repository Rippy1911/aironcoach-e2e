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
  await page.waitForLoadState('networkidle').catch(() => {});

  const acceptCookies = page.getByRole('button', { name: /^Accept$/i });
  if (await acceptCookies.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await acceptCookies.click();
  }

  // Prod Nutrition UI exposes Search inline under "Add meal" (no separate Add dropdown).
  const searchBtn = page.getByRole('button', { name: /^Search$/i }).first();
  await expect(searchBtn).toBeVisible({ timeout: 15_000 });
  await searchBtn.click();
}

async function searchAndAssertResults(
  page: import('@playwright/test').Page,
  query: string,
  opts: { assertSearchProducts?: boolean } = {},
) {
  const searchInput = page
    .getByPlaceholder(/search food/i)
    .or(page.getByPlaceholder(/search/i))
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
    await searchInput.press('Enter').catch(() => {});
    searchResponse = await responsePromise.catch(() => null);
  }

  // Debounced inline search on prod; wait for dropdown rows (kcal may be bare digits).
  await page.waitForTimeout(1_500);

  const keyword = query.split(/\s+/)[0]!;
  const resultRow = page
    .getByRole('button', { name: new RegExp(keyword, 'i') })
    .filter({ hasText: /\d+/ })
    .first();
  await expect(resultRow, `expected ≥1 food result for "${query}"`).toBeVisible({
    timeout: 10_000,
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
      const polishResult = await searchAndAssertResults(page, 'kefir');

      artifacts.push({
        label: 'search-kefir',
        localPath: await screenshotFullPage(page, 'nutrition-search-kefir-dropdown'),
        tags: ['nutrition', 'search-flow', 'kefir'],
      });

      await polishResult.click();

      // Prod uses inline portion panel (not role=dialog modal).
      const portionPanel = page.locator('main').filter({ hasText: /Per 100g:/i }).first();
      await expect(portionPanel).toBeVisible({ timeout: 10_000 });

      await expect(
        portionPanel.getByText(/serving|portion|gram|g\b|100g|100ml|amount/i).first(),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        portionPanel.getByText(/kcal|cal|protein|carb|fat|macro/i).first(),
      ).toBeVisible({ timeout: 10_000 });

      artifacts.push({
        label: 'portion-dialog-kefir',
        localPath: await screenshotFullPage(page, 'nutrition-portion-dialog-kefir'),
        tags: ['nutrition', 'search-flow', 'portion'],
      });

      const backBtn = portionPanel.getByRole('button', { name: /^Back$/i }).first();
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
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
