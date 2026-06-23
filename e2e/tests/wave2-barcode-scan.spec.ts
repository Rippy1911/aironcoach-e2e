/**
 * Wave 2 — Barcode scanner UI mount check.
 *
 * Scope: headless CI cannot exercise camera hardware. We verify the scanner
 * entry point exists, the UI mounts, and a "Use camera" (or equivalent) control
 * is visible. Manual QA required for live scan on device.
 */
import { test, expect } from '../fixtures/test';
import { attachPageGuards } from '../helpers/pageGuards';
import {
  openNutrition,
  screenshotWave2,
  uploadWave2Artifacts,
  pauseForApi,
} from '../helpers/wave2';

test.describe('wave2-barcode-scan', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(3_000);
  });

  test('barcode scanner UI mounts with camera affordance', async ({ page }) => {
    test.info().annotations.push({
      type: 'scope',
      description:
        'Headless: UI mount + camera button only. Live barcode decode requires headed/mobile manual QA.',
    });

    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      await openNutrition(page);

      const barcodeBtn = page
        .getByRole('button', { name: /barcode|scan|skanuj/i })
        .first();
      await expect(barcodeBtn, 'Nutrition should expose a barcode entry point').toBeVisible({
        timeout: 15_000,
      });
      await barcodeBtn.click();
      await pauseForApi(page);

      const scannerSurface = page
        .locator('main')
        .filter({ hasText: /Enter barcode number|barcode/i })
        .first();
      await expect(scannerSurface).toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByPlaceholder(/enter barcode/i),
        'barcode panel should expose manual entry',
      ).toBeVisible({ timeout: 10_000 });

      const scanBtn = page.getByRole('button', { name: /^Scan$/i }).first();
      await expect(scanBtn, 'scanner should offer a camera/scan affordance').toBeVisible({
        timeout: 10_000,
      });

      artifacts.push({
        label: 'barcode-scanner-ui',
        localPath: await screenshotWave2(page, 'barcode-scanner-ui'),
        tags: ['nutrition', 'barcode', 'scanner'],
      });

      guards.assertClean('barcode-scan');

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
