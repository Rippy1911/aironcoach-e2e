import { test, expect } from '../fixtures/test';
import { ApiClient } from '../helpers/apiClient';

/**
 * FatSecret live diagnostic — invokes searchProducts across queries + locales
 * and reports which sources (fatsecret / off / cache) actually return results.
 * Run: BASE_URL=https://airon.coach npx playwright test fatsecret-diag.spec.ts --project=pro --reporter=list
 */
test('FatSecret diagnostic — sources per query', async ({ page }) => {
  const api = new ApiClient(page);
  await api.ready();

  const queries = [
    { q: 'kefir', locale: 'pl' },
    { q: 'jogurt', locale: 'pl' },
    { q: 'chicken breast', locale: 'en' },
    { q: 'mleko', locale: 'pl' },
    { q: 'rice', locale: 'en' },
  ];

  const rows: string[] = [];
  rows.push('query | locale | status | count | sources | sample');
  for (const { q, locale } of queries) {
    try {
      const res = await api.invokeFunction<any>('searchProducts', { query: q, locale });
      const products = res?.products || [];
      const sources = Array.from(new Set(products.map((p: any) => p.source)));
      const sample = products[0]
        ? `${products[0].name} (${products[0].source}, ${products[0].calories_per_100g ?? '?'}kcal)`
        : '—';
      rows.push(`${q} | ${locale} | ok | ${products.length} | ${sources.join('+') || 'none'} | ${sample}`);
    } catch (e: any) {
      rows.push(`${q} | ${locale} | ERR | - | - | ${String(e.message || e).slice(0, 120)}`);
    }
  }

  // Also test barcode (EAN) path with a real Polish product (Mlekovita kefir 590).
  try {
    const res = await api.invokeFunction<any>('searchProducts', { barcode: '5900243000012' });
    const products = res?.products || [];
    const sample = products[0] ? `${products[0].name} (${products[0].source})` : '—';
    rows.push(`barcode 5900243000012 | - | ok | ${products.length} | ${products[0]?.source || 'none'} | ${sample}`);
  } catch (e: any) {
    rows.push(`barcode 5900243000012 | - | ERR | - | - | ${String(e.message || e).slice(0, 120)}`);
  }

  console.log('\n=== FATSECRET DIAGNOSTIC RESULTS ===\n' + rows.join('\n') + '\n');
  // Always pass — this is a reporting probe.
  expect(true).toBe(true);
});
