import { test, expect } from '../fixtures/test';
import { ApiClient } from '../helpers/apiClient';

/**
 * One-off setup: create a team owned by the TEST_COACH_EMAIL account so the
 * accept-team-invite-happy-path.spec.ts flow can run end-to-end
 * (coach creates invite → user accepts).
 *
 * Idempotent: if a team with the target name already exists and the coach is
 * already its owner, reports that instead of creating a duplicate.
 *
 * Run: BASE_URL=https://airon.coach npx playwright test setup-coach-team.spec.ts --project=two-account-invite --reporter=list
 */
const TEAM_NAME = process.env.E2E_TEAM_NAME || 'Lokista E2E Coach Team';

test('setup: create a team owned by the coach account', async ({ browser }) => {
  const coachEmail = process.env.TEST_COACH_EMAIL;
  test.skip(!coachEmail, 'TEST_COACH_EMAIL not set in .env — skipping team setup');

  const ctx = await browser.newContext({
    storageState: 'e2e/.auth/coach.json',
    baseURL: process.env.BASE_URL ?? 'https://airon.coach',
  });
  const page = await ctx.newPage();
  const api = new ApiClient(page);
  await api.ready();

  const me = await api.me();
  expect(me.email, 'coach storage state should be for TEST_COACH_EMAIL').toBe(coachEmail);

  const OWNER_PERMS = {
    can_view_workouts: true, can_edit_workouts: true,
    can_view_nutrition: true, can_edit_nutrition: true,
    can_view_metrics: true, can_edit_metrics: true,
    can_view_goals: true, can_view_calendar: true, can_edit_calendar: true,
  };

  // Idempotency: look for an existing team with this name where the coach is owner.
  const existing: any[] = (await api.filter('Team', { name: TEAM_NAME })) || [];
  for (const t of existing) {
    const members: any[] = (await api.filter('TeamMember', { team_id: t.id })) || [];
    const ownerRow = members.find((m) => m.user_email === coachEmail && m.role === 'owner');
    if (ownerRow) {
      console.log(`\n[setup-coach-team] ALREADY EXISTS: team "${t.name}" (id ${t.id}), coach is owner. No change.\n`);
      await ctx.close();
      return;
    }
  }

  // Create the team + owner membership (mirrors CreateTeamDialog.jsx).
  const team = await api.create('Team', { name: TEAM_NAME, description: 'E2E test team for accept-invite happy path', guidelines: '' });
  const member = await api.create('TeamMember', {
    team_id: team.id,
    user_email: coachEmail,
    user_name: me.full_name || coachEmail.split('@')[0],
    role: 'owner',
    status: 'approved',
    permissions: OWNER_PERMS,
  });

  console.log(`\n[setup-coach-team] CREATED: team "${team.name}" (id ${team.id}); owner member ${member.user_email} role=${member.role} status=${member.status}\n`);
  await ctx.close();
});
