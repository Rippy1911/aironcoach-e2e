/**
 * §4.1 — Pro user routing.
 */
import { test, expect } from '../fixtures/test';
import { routes } from '../helpers/selectors';
import { expectAtPath, expectAuthBootstrapped } from '../helpers/assertions';

test('pro user lands on /Dashboard with stat cards', async ({ page }) => {
  await page.goto('/');
  await expectAuthBootstrapped(page);
  await expectAtPath(page, routes.dashboard, { timeout: 15_000 });

  await expect(page.getByText(/workouts|sets|volume/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

test('pro user navigating to /AppDev redirects away (admin-only)', async ({ page }) => {
  await page.goto(routes.appDev);
  await expect
    .poll(async () => new URL(page.url()).pathname, { timeout: 15_000 })
    .toMatch(/\/(Dashboard|Landing)/);
  expect(new URL(page.url()).pathname).not.toBe(routes.appDev);
});
