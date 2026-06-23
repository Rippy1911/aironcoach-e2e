/**
 * Wave 1 — Pro routing smoke: direct URL navigation matrix.
 *
 * Uses `pro` storage state. Tabulates pass/fail per route.
 */
import { test, expect } from '../fixtures/test';
import { proSmokeRoutes } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { attachPageGuards } from '../helpers/pageGuards';
import { screenshotFullPage, uploadWave1Artifacts } from '../helpers/wave1';

type RouteResult = {
  path: string;
  label: string;
  pass: boolean;
  finalPath: string;
  notes: string;
};

test.describe('smoke-pro-routing', () => {
  test('direct URL navigation matrix + screenshot grid', async ({ page }) => {
    const results: RouteResult[] = [];
    const gridShots: Array<{ label: string; localPath: string; tags: string[] }> = [];

    for (const route of proSmokeRoutes) {
      const guards = attachPageGuards(page);
      let pass = false;
      let notes = '';

      try {
        await page.goto(route.path);
        await expectAuthBootstrapped(page);

        const finalPath = new URL(page.url()).pathname;
        const redirectedToLogin = /\/login/i.test(page.url());

        if (redirectedToLogin) {
          notes = 'redirected to /login';
        } else {
          // Page should render something meaningful (not 404)
          const is404 = await page
            .getByText(/page not found|could not be found/i)
            .isVisible({ timeout: 2_000 })
            .catch(() => false);
          if (is404) {
            notes = '404 page';
          } else {
            guards.assertClean(route.label);
            pass = true;
            notes = 'ok';
          }
        }

        const shotPath = await screenshotFullPage(
          page,
          `pro-routing-${route.label.toLowerCase()}`,
        );
        gridShots.push({
          label: route.label,
          localPath: shotPath,
          tags: ['pro-routing', route.label.toLowerCase()],
        });
      } catch (err) {
        notes = err instanceof Error ? err.message.slice(0, 200) : String(err);
      } finally {
        guards.detach();
        results.push({
          path: route.path,
          label: route.label,
          pass,
          finalPath: new URL(page.url()).pathname,
          notes,
        });
        // Pace prod API to avoid 429 during multi-route matrix
        await page.waitForTimeout(2_000);
      }
    }

    // Composite grid screenshot — stitch via full-page of a summary page
    const summaryHtml = results
      .map(
        (r) =>
          `<tr><td>${r.label}</td><td>${r.path}</td><td>${r.pass ? '✓' : '✗'}</td><td>${r.finalPath}</td><td>${r.notes}</td></tr>`,
      )
      .join('');
    await page.setContent(
      `<html><body><h1>Pro Routing Matrix</h1><table border="1">${summaryHtml}</table></body></html>`,
    );
    const gridPath = await screenshotFullPage(page, 'pro-routing-full-grid');
    gridShots.push({
      label: 'full-grid',
      localPath: gridPath,
      tags: ['pro-routing', 'full-grid'],
    });

    const uploads = await uploadWave1Artifacts(gridShots);
    test.info().attach('routing-matrix', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    test.info().attach('fcv-uploads', {
      body: JSON.stringify(uploads, null, 2),
      contentType: 'application/json',
    });

    // Fail if any critical route failed
    const failures = results.filter((r) => !r.pass);
    expect(
      failures,
      `routing failures:\n${failures.map((f) => `${f.label}: ${f.notes}`).join('\n')}`,
    ).toHaveLength(0);
  });
});
