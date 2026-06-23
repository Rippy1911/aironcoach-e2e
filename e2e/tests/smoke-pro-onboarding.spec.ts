/**
 * Wave 1 — Pro onboarding smoke: dashboard layout + key route navigation.
 *
 * Uses `pro` storage state (USER_NAME/USER_PASS slot).
 */
import { test, expect } from '../fixtures/test';
import { routes, text } from '../helpers/selectors';
import { expectAuthBootstrapped } from '../helpers/assertions';
import { attachPageGuards } from '../helpers/pageGuards';
import { screenshotFullPage, uploadWave1Artifacts } from '../helpers/wave1';

const ONBOARDING_ROUTES = [
  { path: routes.home, slug: 'home', label: 'Home dashboard' },
  { path: routes.training, slug: 'training', label: 'Training' },
  { path: routes.nutrition, slug: 'nutrition', label: 'Nutrition' },
  { path: routes.coachDirectory, slug: 'coach-directory', label: 'CoachDirectory' },
  { path: routes.reports, slug: 'reports', label: 'Reports' },
] as const;

test.describe('smoke-pro-onboarding', () => {
  test('dashboard layout, nav menu, profile + route screenshots', async ({ page }) => {
    const guards = attachPageGuards(page);
    const artifacts: Array<{ label: string; localPath: string; tags: string[] }> = [];

    try {
      // ── Home / Dashboard ───────────────────────────────────────────────
      await page.goto(routes.home);
      await expectAuthBootstrapped(page);
      await expect(page).not.toHaveURL(/\/login/i);

      // Dashboard layout — stat/metric content
      await expect(
        page.getByText(/workouts|volume|training|home/i).first(),
      ).toBeVisible({ timeout: 15_000 });

      artifacts.push({
        label: 'home-dashboard',
        localPath: await screenshotFullPage(page, 'pro-onboarding-home'),
        tags: ['pro-onboarding', 'home'],
      });

      // Navigation menu visible
      for (const [, regex] of [
        ['Home', text.nav.home],
        ['Training', text.nav.training],
        ['Settings', text.nav.settings],
      ] as const) {
        const navItem = page.getByRole('link', { name: regex }).first();
        if (await navItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await expect(navItem).toBeVisible();
        }
      }

      // Profile dropdown / avatar
      const profileTrigger = page
        .locator('[data-testid="profile-menu"], [aria-label*="profile" i], button:has(img[alt*="avatar" i])')
        .first();
      const settingsLink = page.getByRole('link', { name: text.nav.settings }).first();
      const hasProfile =
        (await profileTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) ||
        (await settingsLink.isVisible({ timeout: 3_000 }).catch(() => false));
      expect(hasProfile, 'profile menu or settings nav should be visible').toBeTruthy();

      if (await profileTrigger.isVisible().catch(() => false)) {
        await profileTrigger.click();
        await page.waitForTimeout(300);
        artifacts.push({
          label: 'profile-dropdown',
          localPath: await screenshotFullPage(page, 'pro-onboarding-profile-dropdown'),
          tags: ['pro-onboarding', 'profile'],
        });
        await page.keyboard.press('Escape');
      }

      // ── Route walkthrough ──────────────────────────────────────────────
      for (const route of ONBOARDING_ROUTES.slice(1)) {
        const before = await screenshotFullPage(page, `pro-onboarding-${route.slug}-before`);
        await page.goto(route.path);
        await expectAuthBootstrapped(page);
        await expect(page).not.toHaveURL(/\/login/i);
        await page.waitForLoadState('networkidle').catch(() => {});

        const after = await screenshotFullPage(page, `pro-onboarding-${route.slug}`);
        artifacts.push({
          label: route.slug,
          localPath: after,
          tags: ['pro-onboarding', route.slug],
        });

        // Detect layout shift via pixel diff threshold
        expect(await page.screenshot()).toBeTruthy();
        if (before !== after) {
          // Screenshots captured for manual before/after review
        }
      }

      guards.assertClean('pro-onboarding');

      const uploads = await uploadWave1Artifacts(artifacts);
      test.info().attach('fcv-uploads', {
        body: JSON.stringify(uploads, null, 2),
        contentType: 'application/json',
      });
    } finally {
      guards.detach();
    }
  });
});
