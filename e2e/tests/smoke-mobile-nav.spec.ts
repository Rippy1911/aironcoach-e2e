/**
 * §4.1 — Mobile bottom navigation.
 *
 * Layout.jsx ll. 67–74 defines 6 nav items:
 *   home · training · coach · trainees · community · settings
 *
 * The `trainees` item is conditionally rendered based on coach-team membership
 * (gated by useCoachTeam()). The pro slot is NOT a coach so we expect the
 * other 5 to be visible at iPhone-13 width.
 */
import { test, expect } from '../fixtures/test';
import { routes, text } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';

test('bottom nav shows the 5 core tabs at 375px', async ({ page }) => {
  await page.goto(routes.dashboard);
  await expectAuthBootstrapped(page);

  for (const [label, regex] of [
    ['Home', text.nav.home],
    ['Training', text.nav.training],
    ['Coach', text.nav.coach],
    ['Community', text.nav.community],
    ['Settings', text.nav.settings],
  ] as const) {
    const link = page.getByRole('link', { name: regex }).first();
    await expect(link, `${label} tab visible`).toBeVisible({ timeout: 10_000 });
  }
});
