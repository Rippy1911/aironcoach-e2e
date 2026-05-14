/**
 * §4.6 — Stripe upgrade flow (rewritten for the 4-button + provider-toggle UI
 * shipped 2026-05-08).
 *
 * Verified against:
 *   - aironcoach/src/pages/Settings.jsx ll. 297–337  (provider toggle + 4 buttons)
 *   - aironcoach/base44/functions/createCheckoutSession/entry.ts  (PRO + ELITE,
 *     auto-resolves live vs test price IDs by sk_live_* prefix, 409 on duplicate
 *     active subscription)
 *   - aironcoach/base44/functions/stripeWebhook/entry.ts  (creates Subscription,
 *     writes 'subscription_started' ActivityLog and category=stripe AppLog)
 *
 * Gating:
 *   - STRIPE_TEST_KEY in .env enables this spec. Without it we skip — we never
 *     fire production-mode payments from tests.
 *   - The deployed Base44 backend's STRIPE_SECRET_KEY MUST start with `sk_test_`
 *     for the spec to be safe to run against. The function auto-resolves the
 *     test price IDs from the secret prefix.
 */
import { test, expect } from '../fixtures/test';
import { env } from '../helpers/env';
import { routes, text } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { cleanupForUser } from '../helpers/cleanup';
import { fillStripeTestCard } from '../helpers/stripeCheckout';

test.describe('§4.6 Stripe upgrade', () => {
  test.skip(
    !env.stripe.enabled,
    'STRIPE_TEST_KEY missing in .env — skipping live Stripe checkout flow',
  );

  test.afterEach(async ({ api, slotEmail }) => {
    // Revert to free state so storage state is reusable.
    const profiles = await api.filter<{ id: string }>(
      'UserProfile',
      { created_by: slotEmail },
      { limit: 5 },
    );
    if (profiles[0]) {
      await api.update('UserProfile', profiles[0].id, {
        premium: false,
        premium_expires: null,
        subscription_tier: 'free',
      });
    }
    await cleanupForUser(api, {
      email: slotEmail,
      only: ['Subscription', 'ActivityLog'],
    });
  });

  test('PRO monthly happy path: provider=Stripe → checkout → webhook → premium', async ({
    page,
    api,
    slotEmail,
  }) => {
    test.setTimeout(180_000);

    await page.goto(routes.settings);
    await expectAuthBootstrapped(page);

    // Free Plan badge precondition
    await expect(page.getByText(text.settings.freePlanBadge)).toBeVisible({
      timeout: 10_000,
    });

    // Make sure Stripe is selected (it's the default but be explicit)
    await page
      .getByRole('button', { name: text.settings.provider.stripeButton })
      .click({ trial: true })
      .catch(() => {});

    // Click the PRO monthly button (29.99 PLN)
    await page
      .getByRole('button', { name: text.settings.upgrade.proMonthly })
      .first()
      .click({ timeout: 10_000 });

    // Land on Stripe checkout
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await fillStripeTestCard(page);

    // Stripe redirects back to /Settings?upgrade=success
    await page.waitForURL(/\/Settings(\?|$)/, { timeout: 60_000 });

    // Webhook is async — poll for premium activation
    await expect
      .poll(
        async () => {
          const profiles = await api.filter<{ premium?: boolean }>(
            'UserProfile',
            { created_by: slotEmail },
            { limit: 1 },
          );
          return profiles[0]?.premium === true;
        },
        { timeout: 60_000, message: 'webhook should set UserProfile.premium=true' },
      )
      .toBe(true);

    // Subscription row created
    const subs = await api.filter<{
      provider: string;
      provider_subscription_id?: string;
      status: string;
      tier: string;
      billing_interval?: string;
    }>(
      'Subscription',
      { created_by: slotEmail },
      { sort: '-created_date', limit: 1 },
    );
    expect(subs.length).toBe(1);
    expect(subs[0].provider).toBe('stripe');
    expect(subs[0].status).toBe('active');
    expect(subs[0].tier).toBe('pro');
    expect(subs[0].billing_interval).toBe('monthly');
    expect(subs[0].provider_subscription_id).toMatch(/^sub_/);

    // Premium Active badge appears in UI
    await page.reload();
    await expect(page.getByText(text.settings.premiumActiveBadge)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('ELITE yearly happy path: tier=elite, billing_interval=yearly', async ({
    page,
    api,
    slotEmail,
  }) => {
    test.setTimeout(180_000);

    await page.goto(routes.settings);
    await expectAuthBootstrapped(page);
    await expect(page.getByText(text.settings.freePlanBadge)).toBeVisible({
      timeout: 10_000,
    });

    await page
      .getByRole('button', { name: text.settings.upgrade.eliteYearly })
      .first()
      .click({ timeout: 10_000 });
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await fillStripeTestCard(page);
    await page.waitForURL(/\/Settings(\?|$)/, { timeout: 60_000 });

    await expect
      .poll(
        async () => {
          const subs = await api.filter<{ tier: string; billing_interval: string }>(
            'Subscription',
            { created_by: slotEmail },
            { sort: '-created_date', limit: 1 },
          );
          return subs[0]?.tier === 'elite' && subs[0].billing_interval === 'yearly';
        },
        { timeout: 60_000, message: 'webhook should create elite/yearly subscription' },
      )
      .toBe(true);

    // UserProfile.subscription_tier flipped to 'elite'
    const profiles = await api.filter<{ subscription_tier?: string; premium?: boolean }>(
      'UserProfile',
      { created_by: slotEmail },
      { limit: 1 },
    );
    expect(profiles[0]?.subscription_tier).toBe('elite');
    expect(profiles[0]?.premium).toBe(true);
  });

  test('cancel path leaves the user free with no Subscription row', async ({
    page,
    api,
    slotEmail,
  }) => {
    test.setTimeout(60_000);
    await page.goto(routes.settings);
    await expectAuthBootstrapped(page);

    await page
      .getByRole('button', { name: text.settings.upgrade.proMonthly })
      .first()
      .click({ timeout: 10_000 });
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

    // Click Stripe's back-link or hit browser back
    const backLink = page.getByRole('link', { name: /back|cancel/i }).first();
    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
    } else {
      await page.goBack();
    }

    await page.waitForURL(/\/Settings/, { timeout: 30_000 });
    const subs = await api.filter('Subscription', { created_by: slotEmail }, { limit: 5 });
    expect(subs.length).toBe(0);
  });

  test('AIRONCOACH50 promo banner is announced on the upgrade card', async ({ page }) => {
    await page.goto(routes.settings);
    await expectAuthBootstrapped(page);
    await expect(page.getByText(text.settings.promoBanner).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
