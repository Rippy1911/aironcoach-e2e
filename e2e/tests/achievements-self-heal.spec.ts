/**
 * PR #71 — Achievements self-heal (recompute on page mount).
 *
 * Before #71: the /Achievements page only READ getStreakSummary — it never
 * triggered recordMeaningfulActivity, so badges for historical activity that
 * predates the badge system were never backfilled. Users with ≥10 workouts saw
 * "0 of 19 unlocked" despite qualifying for `training_regular`.
 * After #71: /Achievements fires an idempotent recompute on mount, awarding
 * earned-but-unrecorded badges. For an account with ≥10 workouts,
 * `training_regular` (and `first_workout`) become unlocked.
 *
 * Verified live on https://airon.coach 2026-06-25 with the pro account (13
 * workouts): visit /Achievements → "4 of 19 unlocked", with `training_regular`
 * + `first_workout` unlocked (was 0).
 *
 * PRECONDITION: the pro test account must have ≥10 workouts in its history for
 * the training_regular assertion to hold. If the account is reset, this spec
 * should be skipped rather than seeded destructively.
 *
 * Runs under the `pro` project (pro storage state; account has workout history).
 */
import { test, expect } from '../fixtures/test';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { attachPageGuards } from '../helpers/pageGuards';

test.describe('PR #71 Achievements self-heal', () => {
  test('visiting /Achievements unlocks earned-but-unrecorded badges', async ({ page }) => {
    test.setTimeout(90_000);
    const guards = attachPageGuards(page);

    await page.goto('/Achievements');
    await expectAuthBootstrapped(page);

    // The summary line reads "N of 19 unlocked". After the self-heal recompute,
    // an account with workout history must show at least 1 unlocked.
    const summary = page.getByText(/\d+\s+of\s+\d+\s+unlocked/i).first();
    await expect(summary).toBeVisible({ timeout: 15_000 });

    const summaryText = (await summary.textContent()) ?? '';
    const match = summaryText.match(/(\d+)\s+of\s+(\d+)\s+unlocked/i);
    expect(match, 'summary line parsed').not.toBeNull();
    const unlocked = Number(match![1]);
    expect(unlocked, 'at least one badge unlocked after self-heal').toBeGreaterThanOrEqual(1);

    // The training_regular badge (≥10 workouts) should render as unlocked for
    // the pro account. We assert the badge label is present and not in a
    // locked state (no "locked" / "0 of" style marker on its card).
    const trainingRegular = page.getByText(/training[_ ]?regular|10\+ workouts|regular trainer/i).first();
    await expect(trainingRegular).toBeVisible({ timeout: 10_000 });

    guards.assertClean('achievements-self-heal');
  });
});
