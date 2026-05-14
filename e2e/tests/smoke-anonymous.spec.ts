/**
 * §4.1 — Anonymous routing.
 *
 * Runs in the `anonymous` project (no storage state).
 */
import { test, expect } from '../fixtures/test';
import { routes, text } from '../helpers/selectors';
import { expectAtPath } from '../helpers/assertions';

test('lands on /Landing with login + start-free CTAs', async ({ page }) => {
  await page.goto('/');
  await expectAtPath(page, /\/(Landing)?$/, { timeout: 10_000 });
  // LandingNav + Hero use <button> + base44.auth.redirectToLogin(), not <a href>.
  await expect(
    page.getByRole('button', { name: text.landing.loginCta }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: text.landing.startFreeCta }).first(),
  ).toBeVisible({ timeout: 10_000 });
});

test('direct nav to /Dashboard while anonymous redirects out', async ({ page }) => {
  await page.goto(routes.dashboard);
  await expect
    .poll(async () => new URL(page.url()).pathname, { timeout: 10_000 })
    .toMatch(/\/(Landing|login)?$|^\/$/i);
});
