/**
 * PR #70 — Upgrade AI-credit copy alignment (billing accuracy).
 *
 * Before #70: /Upgrade displayed "60 free AI tokens daily" / "Daily Limit" /
 * "renews every 24 hours", but the backend (MONTHLY_QUOTA) enforces a MONTHLY
 * quota: free=5, pro=60, elite=300, refilling monthly. The UI lied about both
 * the cadence and the numbers — a billing-accuracy bug.
 * After #70: /Upgrade shows "Monthly AI Credits" with numbers 5/60/300 and
 * "Refills every month"; no "daily" / "24 hours" / "Daily Limit" wording.
 *
 * NOTE (deploy drift, observed 2026-06-25): #70 is merged on main (commit
 * 8e078de) and Settings→Billing is live-correct, but the /Upgrade page on
 * production STILL rendered the old daily copy at test time — Base44 had not
 * redeployed airon.coach since the merge. This spec will therefore FAIL
 * against production until a redeploy lands; it PASSES against a freshly
 * built main. That failure is the intended signal (it guards the copy fix).
 *
 * Runs under the `free` project (Upgrade is reachable by any authed user; free
 * storage state keeps it isolated from the pro/full-journey suite).
 */
import { test, expect } from '../fixtures/test';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { attachPageGuards } from '../helpers/pageGuards';

test.describe('PR #70 Upgrade monthly AI-credit copy', () => {
  test('/Upgrade shows monthly copy, never daily/24-hours', async ({ page }) => {
    test.setTimeout(90_000);
    const guards = attachPageGuards(page);

    await page.goto('/Upgrade');
    await expectAuthBootstrapped(page);

    const body = page.locator('body');

    // Positive: the new monthly framing must be present.
    await expect(body).toContainText(/monthly AI credits/i, { timeout: 15_000 });
    await expect(body).toContainText(/refills? every month/i);

    // The three backend-correct numbers should appear (free=5, pro=60, elite=300).
    await expect(body).toContainText(/5\b/);
    await expect(body).toContainText(/60\b/);
    await expect(body).toContainText(/300\b/);

    // Negative: the old misleading copy must be GONE. If any of these survive,
    // either the fix regressed or production is behind main (deploy drift).
    await expect(body).not.toContainText(/daily limit/i);
    await expect(body).not.toContainText(/renews? every 24 hours/i);
    await expect(body).not.toContainText(/60 free AI tokens daily/i);
    await expect(body).not.toContainText(/includes 60 free tokens daily/i);

    guards.assertClean('upgrade-monthly-copy');
  });
});
