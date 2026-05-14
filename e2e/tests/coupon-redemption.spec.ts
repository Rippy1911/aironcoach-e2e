/**
 * §4.7 — Coupon redemption.
 *
 * Verified against:
 *   - aironcoach/src/pages/Settings.jsx (handleRedeemCoupon — placeholder is
 *     now "Enter your invite code", post 2026-05-08)
 *   - aironcoach/base44/functions/redeemCoupon/entry.ts (sets premium_expires)
 *
 * Pre-seeds a coupon via the user-scoped SDK. Coupon entity RLS allows
 * authenticated users to create coupons; admin lock-down is for read,
 * so this works with the free-slot client.
 *
 * Note: if the deployed Coupon RLS later changes to admin-only-create,
 * switch the seed step to an admin-slot apiClient or a backend function.
 */
import { test, expect } from '../fixtures/test';
import { routes, text } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { cleanupForUser } from '../helpers/cleanup';
import { seedCoupon } from '../helpers/seed';

const COUPON_CODE = 'E2ECOUPON';

test.describe('§4.7 coupon redemption', () => {
  test.afterEach(async ({ api, slotEmail }) => {
    // Revert the user back to free state and clean up the coupon entity.
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
    const coupons = await api.filter<{ id: string }>(
      'Coupon',
      { code: COUPON_CODE },
      { limit: 5 },
    );
    for (const c of coupons) {
      await api.delete('Coupon', c.id).catch(() => {});
    }
    await cleanupForUser(api, { email: slotEmail, only: ['ActivityLog'] });
  });

  test('valid coupon grants premium for ~30 days', async ({ page, api, slotEmail }) => {
    await seedCoupon(api, {
      code: COUPON_CODE,
      rewardType: 'premium_1_month',
      maxRedemptions: 1,
    });

    await page.goto(routes.settings);
    await expectAuthBootstrapped(page);

    await page.getByPlaceholder(text.settings.couponPlaceholder).fill(COUPON_CODE);
    await page.getByRole('button', { name: text.settings.redeemButton }).click();

    // Premium Active badge appears
    await expect(page.getByText(text.settings.premiumActiveBadge)).toBeVisible({
      timeout: 15_000,
    });

    // Backend-side: profile.premium = true and premium_expires ≈ now+30d
    const profiles = await api.filter<{ premium?: boolean; premium_expires?: string }>(
      'UserProfile',
      { created_by: slotEmail },
      { limit: 1 },
    );
    expect(profiles[0]?.premium).toBe(true);
    if (profiles[0]?.premium_expires) {
      const expiry = new Date(profiles[0].premium_expires).getTime();
      const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expiry - expected)).toBeLessThan(2 * 24 * 60 * 60 * 1000);
    }
  });

  test('redeeming the same code twice on one account fails the second time', async ({
    page,
    api,
  }) => {
    await seedCoupon(api, {
      code: COUPON_CODE,
      rewardType: 'premium_1_month',
      maxRedemptions: 5, // allow many redemptions globally; the per-account block is what we test
    });

    await page.goto(routes.settings);
    await expectAuthBootstrapped(page);

    // First redemption — succeeds
    await page.getByPlaceholder(text.settings.couponPlaceholder).fill(COUPON_CODE);
    await page.getByRole('button', { name: text.settings.redeemButton }).click();
    await expect(page.getByText(text.settings.premiumActiveBadge)).toBeVisible({
      timeout: 15_000,
    });

    // Second redemption — must fail with an error toast
    await page.getByPlaceholder(text.settings.couponPlaceholder).fill(COUPON_CODE);
    await page.getByRole('button', { name: text.settings.redeemButton }).click();
    await expect(page.getByText(/already redeem|use[d]? once|once per account/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
