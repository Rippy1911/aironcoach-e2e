/**
 * §4.6b — PayU upgrade flow (skipped scaffold).
 *
 * PayU is a separate provider from Stripe and uses a hosted-redirect flow
 * with a manual MD5-signed IPN webhook (see
 * aironcoach/base44/functions/payuCreateOrder + payuWebhook).
 *
 * This spec is intentionally SKIPPED by default for two reasons:
 *
 *   1. PayU sandbox redirects to `secure.snd.payu.com`, where the test card
 *      `4444 3333 2222 1111` works — but PayU rotates UI selectors more often
 *      than Stripe, so each run is brittle.
 *   2. The IPN webhook only fires if the PayU sandbox panel has a Notification
 *      URL pointing back to the deployed app
 *      (`https://break-through-ai.base44.app/api/functions/payuWebhook`).
 *      RELEASE_CHECKLIST.md flags this as B2 — see the doc for setup.
 *
 * Enable by exporting `PAYU_E2E=1`.
 */
import { test, expect } from '../fixtures/test';
import { routes, text } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { cleanupForUser } from '../helpers/cleanup';

const PAYU_ENABLED = process.env.PAYU_E2E === '1';

test.describe('§4.6b PayU upgrade', () => {
  test.skip(!PAYU_ENABLED, 'Set PAYU_E2E=1 to enable PayU sandbox flow');

  test.afterEach(async ({ api, slotEmail }) => {
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

  test('PayU PRO yearly: provider toggle → redirect → webhook → premium', async ({
    page,
    api,
    slotEmail,
  }) => {
    test.setTimeout(240_000);

    await page.goto(routes.settings);
    await expectAuthBootstrapped(page);

    // Switch to PayU
    await page
      .getByRole('button', { name: text.settings.provider.payuButton })
      .click({ timeout: 10_000 });

    // Click PRO yearly
    await page
      .getByRole('button', { name: text.settings.upgrade.proYearly })
      .first()
      .click({ timeout: 10_000 });

    // Lands on PayU sandbox host
    await page.waitForURL(/payu\.com|secure\.snd\.payu\.com/, { timeout: 30_000 });

    // PayU's hosted page selectors are not stable across releases.
    // For now this spec stops at the redirect — extend with concrete card-fill
    // logic when the PayU sandbox flow stabilizes.
    expect(page.url()).toMatch(/payu\.com/);

    // To assert the premium flip end-to-end, comment in the rest after wiring
    // the IPN sandbox notification URL (see RELEASE_CHECKLIST.md B2):
    //
    // await fillPayUSandboxCard(page);  // implement when needed
    // await page.waitForURL(/\/Settings/, { timeout: 90_000 });
    // await expect.poll(async () => {
    //   const profiles = await api.filter('UserProfile', { created_by: slotEmail });
    //   return profiles[0]?.premium === true;
    // }, { timeout: 90_000 }).toBe(true);
    // const subs = await api.filter('Subscription', { created_by: slotEmail });
    // expect(subs[0]?.provider).toBe('payu');
    // expect(subs[0]?.billing_interval).toBe('yearly');
  });
});
