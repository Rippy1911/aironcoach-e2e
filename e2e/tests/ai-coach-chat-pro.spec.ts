/**
 * §4.5 — AI Coach chat (PRO half).
 *
 * Verified:
 *   - Chat.jsx:484 wraps the page in <PremiumGate mode="overlay" /> if !isPremium.
 *   - Chat.jsx:404 writes `chat_interaction` ActivityLog on every send.
 *   - checkAIAccess backend enforces daily_limit, falling back to 50 for premium.
 */
import { test, expect } from '../fixtures/test';
import { routes, text } from '../helpers/selectors';
import {
  expectActivityLog,
  expectAuthBootstrapped,
} from '../helpers/assertions';
import { cleanupForUser } from '../helpers/cleanup';
import { seedActivityLogsForToday } from '../helpers/seed';

test.describe('§4.5 chat — pro user', () => {
  test.afterEach(async ({ api, slotEmail }) => {
    await cleanupForUser(api, {
      email: slotEmail,
      only: ['Conversation', 'Message', 'ActivityLog'],
    });
  });

  test('chat page loads without overlay and lets pro user send a message', async ({
    page,
    api,
    slotEmail,
  }) => {
    await page.goto(routes.chat);
    await expectAuthBootstrapped(page);

    // No PremiumGate overlay
    await expect(page.getByText(text.chat.overlayTitle)).toHaveCount(0);

    // Input is visible
    const input = page
      .locator('textarea, input[type="text"]')
      .filter({ hasNot: page.locator('[disabled]') })
      .first();
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill('hello');
    await input.press('Enter');

    // Optimistic user message lands on screen quickly
    await expect(page.getByText(/^hello$/).first()).toBeVisible({ timeout: 5_000 });

    // ActivityLog row written within a minute
    await expectActivityLog(api, {
      email: slotEmail,
      actionType: 'chat_interaction',
      withinMs: 5 * 60_000,
    });
  });

  test('hitting the daily limit disables the input', async ({ page, api, slotEmail }) => {
    // Default premium cap is 50; staging AppSettings may raise it — seed enough to exceed typical caps.
    await seedActivityLogsForToday(api, { count: 120, actionType: 'chat_interaction' });

    await page.goto(routes.chat);
    await expectAuthBootstrapped(page);

    // The "Daily limit reached" banner appears and the textarea is disabled
    await expect(page.getByText(text.chat.dailyLimitReached)).toBeVisible({
      timeout: 15_000,
    });
    const input = page.locator('textarea').first();
    await expect(input).toBeDisabled({ timeout: 5_000 });

    // Reference slotEmail so cleanup keys are obvious in the test name
    expect(slotEmail).toBeTruthy();
  });
});
