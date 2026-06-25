/**
 * PR #66 + #68 — acceptTeamInvite full happy path (coach creates invite → user accepts).
 *
 * This is the end-to-end team-invite flow that couldn't be tested with a single
 * account (the live-test subagent marked #66 "NOT TESTED — no invite flow
 * reachable"). It uses TWO accounts:
 *   - TEST_COACH_EMAIL (lokistakontakt@gmail.com) — must OWN a team; creates the invite
 *   - TEST_USER_EMAIL  (lokistastream@gmail.com) — the invited user; accepts it
 *
 * Flow:
 *   1. As the coach (via a page authed as the coach), call createTeamInvite for
 *      the user's email → capture the returned token.
 *   2. As the user (via a separate page authed as the user), invoke
 *      acceptTeamInvite with that token → expect status 'accepted' (or
 *      'already_accepted' if a prior run left state).
 *   3. Cleanup: remove the TeamMember row + mark the invite revoked so the
 *      test is re-runnable.
 *
 * Gating: SKIPPED unless TEST_COACH_EMAIL + TEST_USER_EMAIL are set in .env AND
 * the coach owns at least one team. This keeps it off CI by default (CI uses
 * the single-account slots); run locally with both accounts configured.
 *
 * Requires storage states e2e/.auth/coach.json + e2e/.auth/user.json — generate
 * via:
 *   USER_NAME=<coach email> USER_PASS=<coach pass> npx tsx e2e/password-login-setup.ts --slot=coach
 *   USER_NAME=<user email>  USER_PASS=<user pass>  npx tsx e2e/password-login-setup.ts --slot=user
 * (password-login-setup accepts arbitrary slot names — see SLOTS in that file.)
 */
import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../helpers/apiClient';

// Two-account fixtures: each gets its own page + ApiClient + storage state.
const test = base.extend<{ coachApi: ApiClient; userApi: ApiClient }>({
  coachApi: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/coach.json',
      baseURL: process.env.BASE_URL ?? 'https://airon.coach',
    });
    const page = await ctx.newPage();
    await use(new ApiClient(page));
    await ctx.close();
  },
  userApi: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
      baseURL: process.env.BASE_URL ?? 'https://airon.coach',
    });
    const page = await ctx.newPage();
    await use(new ApiClient(page));
    await ctx.close();
  },
});

const COACH_EMAIL = process.env.TEST_COACH_EMAIL;
const USER_EMAIL = process.env.TEST_USER_EMAIL;

test.describe('PR #66/#68 acceptTeamInvite full happy path', () => {
  test.skip(
    !COACH_EMAIL || !USER_EMAIL,
    'TEST_COACH_EMAIL / TEST_USER_EMAIL not set in .env — skipping two-account invite flow',
  );

  test('coach creates a team invite → user accepts it (status accepted)', async ({
    coachApi,
    userApi,
  }) => {
    test.setTimeout(180_000);

    // 1. As the coach, find a team they own.
    const coachMe = await coachApi.me();
    expect(coachMe.email, 'coach storage state is the coach account').toBe(COACH_EMAIL);

    const memberships = await coachApi.filter<{ team_id: string; role: string; status: string }>(
      'TeamMember',
      { user_email: COACH_EMAIL, status: 'approved' },
    );
    const owned = memberships.find((m) => m.role === 'owner' || m.role === 'trainer');
    test.skip(!owned, 'coach account does not own/train a team — set up a team first');
    const teamId = owned!.team_id;

    // 2. Create the invite for the user. createTeamInvite returns
    //    { ok, invite_id, token, recipient_registered } — the token is returned
    //    to the authenticated inviter so the app can deep-link/preview the
    //    accept URL (the token is also in the emailed link + Notification, so
    //    this adds no new exposure). NOTE: this requires the createTeamInvite
    //    token-return change to be DEPLOYED — until then this spec fails as a
    //    deploy-drift guard (same pattern as upgrade-monthly-copy.spec.ts).
    //    Rationale for reading the token from the response (not TeamInvite /
    //    Notification entities): rows created server-side via asServiceRole in
    //    createTeamInvite are NOT visible to the user-scoped SDK afterwards
    //    (TeamInvite.filter + Notification.filter both return [] for coach and
    //    invitee despite RLS rules nominally allowing it — same service-role
    //    row-visibility quirk class as the seedCommunityDemo Team.update 403).
    const invite = await coachApi.invokeFunction<{ ok?: boolean; invite_id?: string; token?: string; recipient_registered?: boolean; error?: string }>(
      'createTeamInvite',
      { team_id: teamId, invited_email: USER_EMAIL, role: 'member' },
    );
    expect(invite, 'createTeamInvite returned a result').toBeTruthy();
    console.log('\n[happy-path] createTeamInvite result:', JSON.stringify(invite), '\n');
    expect((invite as { error?: string }).error, 'createTeamInvite should not error').toBeFalsy();
    const token = (invite as { token?: string }).token;
    expect(token, 'createTeamInvite returns a token (requires the token-return change to be deployed)').toBeTruthy();

    // 3. As the user, accept the invite.
    const userMe0 = await userApi.me();
    expect(userMe0.email, 'user storage state is the user account').toBe(USER_EMAIL);

    // 3. As the user, accept the invite. (userMe already verified above.)
    let acceptResult: unknown = null;
    let acceptErr: unknown = null;
    try {
      acceptResult = await userApi.invokeFunction<{ status?: string; team_name?: string }>(
        'acceptTeamInvite',
        { token },
      );
    } catch (e) {
      acceptErr = e;
    }

    // acceptTeamInvite returns 200 with { status } on success — no throw.
    expect(acceptErr, 'accept did not throw').toBeNull();
    const status = (acceptResult as { status?: string })?.status;
    expect(status, 'accepted or already_accepted (idempotent)').toMatch(
      /^accepted|already_accepted$/,
    );

    // 4. Cleanup: remove the TeamMember row so the test is re-runnable.
    //    TeamInvite + Notification rows are SDK-unreadable for the invitee
    //    (service-role row-visibility quirk — see step 2 comment), so we can't
    //    revoke/delete them from here. acceptTeamInvite is idempotent
    //    (`already_accepted` / status checks server-side), so re-runs are safe;
    //    a fresh invite is created each run only if no pending one exists.
    const userMemberships = await userApi.filter<{ id: string; team_id: string; user_email: string }>(
      'TeamMember',
      { team_id: teamId, user_email: USER_EMAIL },
    );
    for (const m of userMemberships) {
      try {
        await userApi.delete('TeamMember', m.id);
      } catch {
        /* best-effort */
      }
    }
  });
});
