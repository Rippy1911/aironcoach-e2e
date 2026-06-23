import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { routes } from './selectors';
import { expectAuthBootstrapped } from './assertions';
import { uploadArtifacts, type ArtifactRecord } from './fcvUpload';
import { acceptCookiesIfPresent } from './wave1';

/** Base44 per-user rate limit: ~100 req / 60s — pace API-heavy steps. */
export const WAVE2_PACE_MS = 3_000;

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'test-results', 'wave2-artifacts');

export async function ensureWave2ArtifactsDir(): Promise<string> {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  return ARTIFACTS_DIR;
}

export async function pauseForApi(page: Page, ms = WAVE2_PACE_MS): Promise<void> {
  await page.waitForTimeout(ms);
}

export async function screenshotWave2(
  page: Page,
  name: string,
): Promise<string> {
  const dir = await ensureWave2ArtifactsDir();
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export async function uploadWave2Artifacts(
  artifacts: Array<{ label: string; localPath: string; tags: string[] }>,
): Promise<ArtifactRecord[]> {
  const tagged = artifacts.map((a) => ({
    ...a,
    tags: ['wave-2', ...a.tags],
  }));
  const results = await uploadArtifacts(tagged);
  const manifestPath = path.join(await ensureWave2ArtifactsDir(), 'upload-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(results, null, 2));
  return results;
}

export async function openNutrition(page: Page): Promise<void> {
  await page.goto(routes.nutrition);
  await expectAuthBootstrapped(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await acceptCookiesIfPresent(page);
  await pauseForApi(page);
}

export async function openFoodSearch(page: Page): Promise<void> {
  await openNutrition(page);
  const searchBtn = page.getByRole('button', { name: /^Search$/i }).first();
  await expect(searchBtn).toBeVisible({ timeout: 15_000 });
  await searchBtn.click();
  await pauseForApi(page, 1_000);
}

export function foodSearchInput(page: Page) {
  return page
    .getByPlaceholder(/search food/i)
    .or(page.getByPlaceholder(/search/i))
    .or(page.locator('input[type="search"]'))
    .or(page.locator('[role="combobox"] input'))
    .first();
}

export async function searchAndPickFirst(
  page: Page,
  query: string,
): Promise<void> {
  const searchInput = foodSearchInput(page);
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(query);
  await pauseForApi(page, 1_500);

  const keyword = query.split(/\s+/)[0]!;
  const resultRow = page
    .getByRole('button', { name: new RegExp(keyword, 'i') })
    .filter({ hasText: /\d+/ })
    .first();
  await expect(resultRow, `expected ≥1 food result for "${query}"`).toBeVisible({
    timeout: 10_000,
  });
  await resultRow.click();
  await pauseForApi(page);
}

export function portionPanel(page: Page) {
  return page
    .locator('main')
    .filter({ hasText: /Per 100g:|Per 100ml:/i })
    .filter({ has: page.getByRole('button', { name: /add to day|back/i }) })
    .first();
}

export async function expectPortionPanel(page: Page): Promise<void> {
  const panel = portionPanel(page);
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await expect(
    panel.getByText(/serving|portion|gram|g\b|100g|100ml|amount/i).first(),
  ).toBeVisible({ timeout: 10_000 });
}

export async function setPortionGrams(page: Page, grams: number): Promise<void> {
  const panel = portionPanel(page);
  await expectPortionPanel(page);

  const customBtn = panel.getByRole('button', { name: /^Custom$/i }).first();
  if (await customBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await customBtn.click();
    await pauseForApi(page, 500);
    const amountInput = panel.locator('input[type="number"], input[type="text"]').last();
    if (await amountInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await amountInput.fill(String(grams));
      await pauseForApi(page, 500);
      return;
    }
  }

  const gramsInput = panel
    .locator('input[type="number"]')
    .or(panel.getByRole('spinbutton'))
    .first();
  if (await gramsInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await gramsInput.fill(String(grams));
    await pauseForApi(page, 500);
    return;
  }

  const presetBtn = panel
    .getByRole('button', { name: new RegExp(`${grams}\\s*(g|ml)`, 'i') })
    .first();
  if (await presetBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await presetBtn.click();
    await pauseForApi(page, 500);
  }
}

export async function confirmAddMeal(page: Page): Promise<void> {
  const panel = portionPanel(page);
  const addBtn = panel
    .getByRole('button', { name: /add to day|add meal|log meal|add to log|save|confirm|dodaj/i })
    .first();
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
  await addBtn.click();
  await pauseForApi(page);
}

export type DailyMacros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  raw: string;
};

export async function readDailyMacros(page: Page): Promise<DailyMacros> {
  const sidebar = page.locator('main').getByRole('complementary').first();
  await expect(sidebar).toBeVisible({ timeout: 10_000 });
  const text = await sidebar.innerText();

  const pick = (patterns: RegExp[]): number => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m?.[1]) return parseFloat(m[1].replace(',', '.'));
    }
    return 0;
  };

  return {
    kcal: pick([
      /(\d+(?:[.,]\d+)?)\s*\n\s*of\s+\d+\s+kcal eaten/i,
      /(\d+(?:[.,]\d+)?)\s+of\s+\d+\s+kcal eaten/i,
    ]),
    protein: pick([/Protein\s*\n?\s*(\d+(?:[.,]\d+)?)\s*g/i]),
    carbs: pick([/Carbs\s*\n?\s*(\d+(?:[.,]\d+)?)\s*g/i]),
    fat: pick([/Fats?\s*\n?\s*(\d+(?:[.,]\d+)?)\s*g/i]),
    raw: text.slice(0, 500),
  };
}

export async function expectMealInTodayLog(page: Page, foodKeyword: string): Promise<void> {
  const logEntry = page
    .locator('main')
    .getByText(new RegExp(foodKeyword, 'i'))
    .first();
  await expect(logEntry, `meal containing "${foodKeyword}" should appear in today's log`).toBeVisible({
    timeout: 15_000,
  });
}

export async function openCustomFoodForm(page: Page): Promise<void> {
  await openNutrition(page);

  const myFoodsTab = page.getByRole('button', { name: /^My Foods$/i }).first();
  await expect(myFoodsTab).toBeVisible({ timeout: 15_000 });
  await myFoodsTab.click();
  await pauseForApi(page);

  const addFoodBtn = page.getByRole('button', { name: /^Add food$/i }).first();
  await expect(addFoodBtn).toBeVisible({ timeout: 15_000 });
  await addFoodBtn.click();
  await pauseForApi(page);

  const addManual = page.getByRole('button', { name: /^Add manually$/i }).last();
  await expect(addManual).toBeVisible({ timeout: 15_000 });
  await addManual.click();
  await pauseForApi(page);
}

function customFoodFormRoot(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByPlaceholder('Name *') })
    .filter({ hasText: /Per 100g/i })
    .first();
}

export async function fillCustomFood(
  page: Page,
  food: { name: string; kcal: number; protein: number; carbs: number; fat: number },
): Promise<void> {
  const form = customFoodFormRoot(page);
  await expect(form).toBeVisible({ timeout: 10_000 });

  await form.getByPlaceholder('Name *').fill(food.name);

  const macros = form.getByRole('spinbutton');
  await macros.nth(0).fill(String(food.kcal));
  await macros.nth(1).fill(String(food.protein));
  await macros.nth(2).fill(String(food.carbs));
  await macros.nth(3).fill(String(food.fat));

  const serving = form.getByPlaceholder(/Serving size/i);
  if (await serving.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await serving.fill('100');
  }
  await pauseForApi(page, 500);
}

export async function saveCustomFood(page: Page): Promise<void> {
  const form = customFoodFormRoot(page);
  const saveBtn = form.getByRole('button', { name: /^Save$/i });
  await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
  await saveBtn.click();
  await pauseForApi(page);
}
