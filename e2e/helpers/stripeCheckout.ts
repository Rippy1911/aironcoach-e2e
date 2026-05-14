import type { Page } from '@playwright/test';
import { env } from './env';

/**
 * Fill the Stripe-hosted checkout page with a test card and submit.
 *
 * Selectors verified May 2026 against the standard Stripe Checkout UI.
 * Stripe occasionally renames internal selectors — when the spec breaks,
 * the fix is here, not in the test.
 */
export async function fillStripeTestCard(
  page: Page,
  opts: { card?: string; expMonth?: string; expYear?: string; cvc?: string; postal?: string } = {},
): Promise<void> {
  const card = opts.card ?? env.stripe.testCard;
  const expMonth = opts.expMonth ?? '12';
  const expYear = opts.expYear ?? String(new Date().getFullYear() + 4).slice(-2);
  const cvc = opts.cvc ?? '123';
  const postal = opts.postal ?? '00-001';

  // Wait for the Stripe-hosted page to be interactive
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // Email is sometimes pre-filled via customer; only fill if visible
  const email = page.locator('input[name="email"], #email');
  if (await email.isVisible().catch(() => false)) {
    // skip — Stripe pre-populates from the customer record we created
  }

  // Card details
  await page.fill('[name="cardNumber"]', card);
  await page.fill('[name="cardExpiry"]', `${expMonth}/${expYear}`);
  await page.fill('[name="cardCvc"]', cvc);

  // Cardholder name (sometimes required)
  const nameInput = page.locator('[name="billingName"], [name="cardholderName"]');
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill('E2E Tester');
  }

  // Postal code (PL-formatted, but Stripe accepts any)
  const postalInput = page.locator('[name="billingPostalCode"], [autocomplete="postal-code"]');
  if (await postalInput.isVisible().catch(() => false)) {
    await postalInput.fill(postal);
  }

  // Country fallback
  const country = page.locator('[name="billingCountry"]');
  if (await country.isVisible().catch(() => false)) {
    await country.selectOption('PL').catch(() => {});
  }

  // Submit
  const submit = page.locator(
    '[data-testid="hosted-payment-submit-button"], button[type="submit"]:has-text("Subscribe"), button[type="submit"]:has-text("Pay")',
  );
  await submit.first().click({ timeout: 15_000 });
}
