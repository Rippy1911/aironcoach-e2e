/**
 * PR #69 — parseIngredients (AI "Parse from text" in the Ingredients editor).
 *
 * Before #69: IngredientsEditor.jsx called `base44.functions.parseIngredients`,
 * but no such backend function existed → 404 → the "Parse from text" AI button
 * silently did nothing.
 * After #69: base44/functions/parseIngredients/entry.ts implements the function
 * (auth → Core.InvokeLLM with a {name,weight_g,calories,protein,carbs,fat}
 * schema → ActivityLog), so the button parses free-text ingredients into rows.
 *
 * STATUS (2026-06-25): live-test could NOT locate the "Parse from text" button
 * in production from the top-level nutrition flows — it likely lives inside a
 * recipe builder / LogNutritionDialog sub-flow that isn't reachable without a
 * specific entry path. The spec is therefore SKIPPED by default with a clear
 * reason; remove the skip + fill RECIPE_ENTRY once the composer path is
 * confirmed so this guards the restored feature.
 *
 * Runs under the `pro` project (pro storage state).
 */
import { test, expect } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';

// TODO: confirm the exact route/flow that opens the Ingredients editor with the
// "Parse from text" button and set this. Until then the spec is skipped.
const RECIPE_ENTRY: string | null = null;

test.describe('PR #69 parseIngredients (AI "Parse from text")', () => {
  test.skip(RECIPE_ENTRY === null, 'Ingredients composer entry path not confirmed in production — skipping until reachable');

  test('"Parse from text" populates ingredient rows', async ({ page }) => {
    test.setTimeout(120_000);
    expect(RECIPE_ENTRY, 'recipe entry path configured').toBeTruthy();

    await page.goto(RECIPE_ENTRY!);
    await expectAuthBootstrapped(page);

    const parseButton = page.getByRole('button', { name: /parse from text/i });
    await expect(parseButton).toBeVisible({ timeout: 15_000 });

    // Enter a representative free-text ingredients blob.
    const textField = page.getByRole('textbox').first();
    await textField.fill('100g chicken breast, 1 cup rice, 1 tbsp olive oil');

    await parseButton.click();

    // After the AI parse, ingredient rows should appear (the editor renders one
    // row per parsed ingredient). Assert at least one parsed row shows up.
    const rows = page.getByRole('listitem').filter({ hasText: /chicken|rice|oil/i });
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  });
});
