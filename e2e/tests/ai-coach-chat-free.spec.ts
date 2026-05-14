/**
 * §4.5 — AI Coach chat (FREE half).
 *
 * The free slot must hit the PremiumGate overlay and NOT see the input.
 */
import { test, expect } from '../fixtures/test';
import { routes, text } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';

test.describe('§4.5 chat — free user', () => {
  test('free user sees PremiumGate overlay and no chat input', async ({ page }) => {
    await page.goto(routes.chat);
    await expectAuthBootstrapped(page);

    // Overlay heading
    await expect(page.getByText(text.chat.overlayTitle)).toBeVisible({
      timeout: 15_000,
    });
    // Upgrade CTA
    await expect(
      page.getByRole('link', { name: text.chat.overlayCta }).first(),
    ).toBeVisible();

    // Input must NOT be in the DOM
    const inputs = page.locator('textarea');
    await expect(inputs).toHaveCount(0);
  });
});
