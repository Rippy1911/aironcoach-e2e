/**
 * P42 — Coach Hub by team capability (two-account E2E).
 *
 * Verifies the two-tier model end-to-end against the deployed app:
 *   1. Coach account (owns a coaching team): getMyCapabilities returns
 *      coachingTeams with role owner/trainer → the team-capability path is
 *      populated (Coach Hub opens WITHOUT a public alias).
 *   2. Member account (in the coach's team as a 'member'): getMyCapabilities
 *      does NOT list that team in coachingTeams → member role grants no
 *      coach capability (social/member ≠ coach).
 *   3. Member account (when not coach-capable): /CoachBusinessHub shows the
 *      new "Create a coaching team" gate CTA (→ /Teams?create=coaching), NOT
 *      the coach profile creation wall — the team-first become-coach entry.
 *
 * Gating: SKIPPED unless TEST_COACH_EMAIL + TEST_USER_EMAIL are set in .env.
 * Requires storage states e2e/.auth/coach.json + e2e/.auth/user.json (same as
 * accept-team-invite-happy-path.spec.ts). Run locally:
 *   BASE_URL=https://airon.coach npx playwright test p42-coach-hub-by-team.spec.ts \
 *     --project=two-account-invite --reporter=list
 */
import { test as base, expect, type Page } from '@playwright/test';
import { ApiClient } from '../helpers/apiClient';

type Capabilities = {
  ok?: boolean;
  isCoach?: boolean;
  hasCoachAlias?: boolean;
  coachingTeams?: Array<{ team_id: string; name: string; role: string }>;
  socialTeams?: unknown[];
  canAccessCoachHub?: boolean;
};

// Each account gets its own page + ApiClient + storage state. We keep the page
// reference so we can call the SDK directly via page.evaluate (apiClient
// unwraps `.data`, but getMyCapabilities returns its body at the top level —
// same shape Layout reads: `json?.ok`).
const test = base.extend<{ coachPage: Page; coachApi: ApiClient; userPage: Page; userApi: ApiClient }>({
  coachPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/coach.json',
      baseURL: process.env.BASE_URL ?? 'https://airon.coach',
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  coachApi: async ({ coachPage }, use) => use(new ApiClient(coachPage)),
  userPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
      baseURL: process.env.BASE_URL ?? 'https://airon.coach',
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  userApi: async ({ userPage }, use) => use(new ApiClient(userPage)),
});

const COACH_EMAIL = process.env.TEST_COACH_EMAIL;
const USER_EMAIL = process.env.TEST_USER_EMAIL;

/** Call getMyCapabilities in-page, returning the body directly (mirrors Layout). */
async function getCapabilities(page: Page): Promise<Capabilities> {
  await new ApiClient(page).ready();
  return page.evaluate(async () => {
    const sdk = window.__e2e_base44 as {
      functions: { invoke(name: string, payload: unknown): Promise<Capabilities> };
    };
    return sdk.functions.invoke('getMyCapabilities', {});
  });
}

test.describe('P42 Coach Hub by team capability', () => {
  test.skip(
    !COACH_EMAIL || !USER_EMAIL,
    'TEST_COACH_EMAIL / TEST_USER_EMAIL not set in .env — skipping two-account capability flow',
  );

  test('coach account: coaching-team ownership populates the capability path', async ({
    coachPage,
    coachApi,
  }) => {
    test.setTimeout(120_000);
    const me = await coachApi.me();
    expect(me.email, 'coach storage state is the coach account').toBe(COACH_EMAIL);

    const caps = await getCapabilities(coachPage);
    expect(caps.ok, 'getMyCapabilities resolved').toBe(true);
    const owned = (caps.coachingTeams || []).find(
      (t) => t.role === 'owner' || t.role === 'trainer',
    );
    test.skip(!owned, 'coach account owns no coaching team — run setup-coach-team.spec.ts first');
    console.log(
      `\n[p42] coach capability: isCoach=${caps.isCoach} hasCoachAlias=${caps.hasCoachAlias} ` +
        `coachingTeams=${JSON.stringify(caps.coachingTeams)}\n`,
    );
    // The team-capability path is populated regardless of whether the coach also
    // has a public alias — this is the data CoachModeGuard reads via useCoachCapability.
    expect(owned!.role, 'owned team role is owner or trainer').toMatch(/^(owner|trainer)$/);
    expect(caps.canAccessCoachHub, 'canAccessCoachHub true for coaching-team owner/trainer').toBe(true);
  });

  test('member account: member role does NOT grant coach capability', async ({
    userPage,
    userApi,
    coachApi,
  }) => {
    test.setTimeout(120_000);
    const me = await userApi.me();
    expect(me.email, 'user storage state is the user account').toBe(USER_EMAIL);

    // Resolve the coach's owned team so we can assert the member is NOT granted
    // capability over it.
    const coachMemberships = await coachApi.filter<{ team_id: string; role: string; status: string }>(
      'TeamMember',
      { user_email: COACH_EMAIL, status: 'approved' },
    );
    const owned = coachMemberships.find((m) => m.role === 'owner' || m.role === 'trainer');
    test.skip(!owned, 'coach account owns no team — run setup-coach-team.spec.ts first');
    const coachTeamId = owned!.team_id;

    const userCaps = await getCapabilities(userPage);
    expect(userCaps.ok, 'user getMyCapabilities resolved').toBe(true);
    const granted = (userCaps.coachingTeams || []).find(
      (t) => t.team_id === coachTeamId && (t.role === 'owner' || t.role === 'trainer'),
    );
    console.log(
      `\n[p42] member capability over coach team ${coachTeamId}: ` +
        `granted=${JSON.stringify(granted)} userCoachingTeams=${JSON.stringify(userCaps.coachingTeams)}\n`,
    );
    // A member of a coaching team is NOT a coach — the team must not appear in
    // the user's coachingTeams with an owner/trainer role.
    expect(granted, 'member role must not grant coach capability over the team').toBeFalsy();
  });

  test('member account (not coach-capable): /CoachBusinessHub shows the "Create a coaching team" gate', async ({
    userPage,
    userApi,
  }) => {
    test.setTimeout(120_000);
    const me = await userApi.me();
    expect(me.email).toBe(USER_EMAIL);

    const caps = await getCapabilities(userPage);
    // Only assert the gate when the user is genuinely not coach-capable. If the
    // account happens to have an alias / own a team, Coach Hub rightfully opens.
    test.skip(
      !!caps.isCoach,
      'user account is coach-capable (alias or owns/trains a team) — gate test does not apply',
    );

    await userPage.goto('/CoachBusinessHub', { waitUntil: 'domcontentloaded' });
    // CoachModeGuard: not-capable → "Create a coaching team" CTA → /Teams?create=coaching.
    await expect(userPage.getByText(/Create a coaching team/i).first()).toBeVisible();
    const cta = userPage.getByRole('link', { name: /Create a coaching team/i }).first();
    await expect(cta).toHaveAttribute('href', /\/Teams\?create=coaching/);
    // The legacy "Create a coach profile" wall must NOT be the gate anymore.
    await expect(userPage.getByText(/Create a coach profile first/i)).toHaveCount(0);
  });
});
