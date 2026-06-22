/**
 * Wave 1 — Anonymous smoke: landing + pricing + cookie banner.
 *
 * Runs in the `anonymous` project (no storage state).
 * Targets production https://airon.coach
 */
import { test, expect } from '@playwright/test';
import { routes, text } from '../helpers/selectors';
import {
  acceptCookiesIfPresent,
  screenshotFullPage,
  scrollToPricingSection,
  uploadWave1Artifacts,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
} from '../helpers/wave1';

test.describe('smoke-anonymous', () => {
  test('landing, pricing tiers, cookie banner + screenshots', async ({ page }) => {
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    // ── Desktop landing (logged-out, fresh cookie banner) ────────────────
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/');
    await expect(page).toHaveTitle(/AIron/i);

    await expect(page.getByRole('img', { name: /AIron/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole('button', { name: text.landing.getStartedCta }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(text.landing.cookieBanner)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: text.landing.cookieAccept })).toBeVisible();
    await expect(page.getByRole('button', { name: text.landing.cookieDecline })).toBeVisible();

    artifacts.push({
      label: 'landing-desktop',
      localPath: await screenshotFullPage(page, 'anonymous-landing-desktop', DESKTOP_VIEWPORT),
      tags: ['anonymous', 'landing', 'desktop'],
    });

    // ── Mobile landing ───────────────────────────────────────────────────
    artifacts.push({
      label: 'landing-mobile',
      localPath: await screenshotFullPage(page, 'anonymous-landing-mobile', MOBILE_VIEWPORT),
      tags: ['anonymous', 'landing', 'mobile'],
    });

    // ── Desktop pricing (/pricing 404 → landing pricing section) ───────
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/');
    await acceptCookiesIfPresent(page);
    await scrollToPricingSection(page);

    await expect(page.getByText(text.pricing.freeTier).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(text.pricing.proTier).first()).toBeVisible();
    await expect(page.getByText(text.pricing.coachTier).first()).toBeVisible();

    // Also hit /pricing route (404 in prod — document in test attach)
    await page.goto(routes.pricing);
    const is404 = await page
      .getByText(/page not found|could not be found/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    test.info().attach('pricing-route-note', {
      body: is404
        ? '/pricing returns 404 in prod; tiers asserted via landing Pricing section'
        : '/pricing rendered successfully',
      contentType: 'text/plain',
    });
    if (is404) {
      await page.goto('/');
      await scrollToPricingSection(page);
    }

    artifacts.push({
      label: 'pricing-desktop',
      localPath: await screenshotFullPage(page, 'anonymous-pricing-desktop', DESKTOP_VIEWPORT),
      tags: ['anonymous', 'pricing', 'desktop'],
    });

    // ── Mobile pricing ───────────────────────────────────────────────────
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await acceptCookiesIfPresent(page);
    await scrollToPricingSection(page);

    artifacts.push({
      label: 'pricing-mobile',
      localPath: await screenshotFullPage(page, 'anonymous-pricing-mobile', MOBILE_VIEWPORT),
      tags: ['anonymous', 'pricing', 'mobile'],
    });

    const uploads = await uploadWave1Artifacts(artifacts);
    test.info().attach('fcv-uploads', {
      body: JSON.stringify(uploads, null, 2),
      contentType: 'application/json',
    });

    expect(artifacts).toHaveLength(4);
  });
});
