/**
 * §4.1 — Admin routing.
 */
import { test } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import { expectAtPath } from '../helpers/assertions';

test('admin can load /AppDev', async ({ page }) => {
  await page.goto(routes.appDev);
  await expectAtPath(page, routes.appDev, { timeout: 15_000 });
});
