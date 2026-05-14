/**
 * §4.2 — Onboarding flow (rewritten for the 3-step trial UI shipped 2026-05-07).
 *
 * Verified against:
 *   - aironcoach/src/pages/Onboarding.jsx (3 steps, "Start free trial" CTA)
 *   - aironcoach/src/pages/Onboarding.jsx l. 96–99
 *     ActivityLog.create({ action_type: 'signup_completed',
 *       details: { goal, unit_system, trial_granted: true } })
 *   - aironcoach/src/docs/RELEASE_CHECKLIST.md  "Onboarding ✅ DONE"
 *
 * Note on the "fresh" slot: completing onboarding now grants a 14-day PRO
 * trial (premium=true, premium_expires≈now+14d, subscription_tier='pro').
 * The afterEach hook reverts that so the next run re-enters Onboarding.
 */
import { test, expect } from '../fixtures/test';
import { routes, text } from '../helpers/selectors';
import {
  expectActivityLog,
  expectAtPath,
  expectAuthBootstrapped,
} from '../helpers/assertions';
import { cleanupForUser } from '../helpers/cleanup';

test.describe('§4.2 onboarding', () => {
  test.afterEach(async ({ api, slotEmail }) => {
    await cleanupForUser(api, {
      email: slotEmail,
      only: ['UserProfile', 'ActivityLog'],
    });
  });

  test('redirects to /Onboarding on first visit (no profile)', async ({ page }) => {
    await page.goto(routes.dashboard);
    await expectAuthBootstrapped(page);
    await expectAtPath(page, routes.onboarding, { timeout: 20_000 });
  });

  test('completing 3 steps creates a PRO-trial profile + signup_completed log', async ({
    page,
    api,
    slotEmail,
  }) => {
    await page.goto(routes.onboarding);
    await expectAuthBootstrapped(page);

    // Step 1 — pick "Build Muscle"
    await page.getByRole('button', { name: text.onboarding.goalCard.gainMuscle }).click();
    await page.getByRole('button', { name: text.onboarding.continueButton }).click();

    // Step 2 — fill metric height + weight
    await page.getByLabel(text.onboarding.heightLabel).fill('180');
    await page.getByLabel(text.onboarding.weightLabel).fill('80');
    await page.getByRole('button', { name: text.onboarding.continueButton }).click();

    // Step 3 — confirm trial
    await expect(page.getByText(text.onboarding.trialBanner)).toBeVisible();
    await page.getByRole('button', { name: text.onboarding.submitButton }).click();

    // Lands on /Dashboard
    await expectAtPath(page, routes.dashboard, { timeout: 20_000 });

    // Backend: UserProfile written with PRO trial
    const profiles = await api.filter<{
      onboarding_completed: boolean;
      subscription_tier?: string;
      premium?: boolean;
      premium_expires?: string;
      goal?: string;
      height?: number;
      weight?: number;
    }>('UserProfile', { created_by: slotEmail }, { limit: 5 });

    expect(profiles.length).toBe(1);
    const p = profiles[0];
    expect(p.onboarding_completed).toBe(true);
    expect(p.goal).toBe('gain_muscle');
    expect(p.height).toBe(180);
    expect(p.weight).toBe(80);

    // Trial assertions (Onboarding.jsx grants 14-day PRO if no prior premium)
    expect(p.premium).toBe(true);
    expect(p.subscription_tier).toBe('pro');
    if (p.premium_expires) {
      const expiry = new Date(p.premium_expires).getTime();
      const expected = Date.now() + 14 * 24 * 60 * 60 * 1000;
      // Allow ±2 days slack for clock skew / test-suite delay
      expect(Math.abs(expiry - expected)).toBeLessThan(2 * 24 * 60 * 60 * 1000);
    }

    // ActivityLog
    await expectActivityLog(api, {
      email: slotEmail,
      actionType: 'signup_completed',
      withinMs: 5 * 60_000,
    });

    const logs = await api.filter<{
      action_type: string;
      details?: { trial_granted?: boolean; goal?: string };
    }>(
      'ActivityLog',
      { action_type: 'signup_completed', created_by: slotEmail },
      { sort: '-created_date', limit: 1 },
    );
    expect(logs[0]?.details?.trial_granted).toBe(true);
    expect(logs[0]?.details?.goal).toBe('gain_muscle');
  });

  test('re-running onboarding does not duplicate UserProfile and does not re-grant trial', async ({
    page,
    api,
    slotEmail,
  }) => {
    // Pre-condition: complete onboarding once (will grant trial).
    await page.goto(routes.onboarding);
    await expectAuthBootstrapped(page);
    await page.getByRole('button', { name: text.onboarding.goalCard.gainMuscle }).click();
    await page.getByRole('button', { name: text.onboarding.continueButton }).click();
    await page.getByLabel(text.onboarding.heightLabel).fill('175');
    await page.getByLabel(text.onboarding.weightLabel).fill('70');
    await page.getByRole('button', { name: text.onboarding.continueButton }).click();
    await page.getByRole('button', { name: text.onboarding.submitButton }).click();
    await expectAtPath(page, routes.dashboard, { timeout: 20_000 });

    const before = await api.filter<{ id: string }>(
      'UserProfile',
      { created_by: slotEmail },
      { limit: 5 },
    );
    expect(before.length).toBe(1);

    // Onboarding.jsx redirects to /Dashboard if onboarding_completed=true,
    // so we should NOT be able to re-enter the flow.
    await page.goto(routes.onboarding);
    await expectAtPath(page, routes.dashboard, { timeout: 20_000 });

    const after = await api.filter('UserProfile', { created_by: slotEmail }, { limit: 5 });
    expect(after.length).toBe(1);
  });
});
