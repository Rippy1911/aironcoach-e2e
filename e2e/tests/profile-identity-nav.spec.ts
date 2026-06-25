import { expect, test } from '@playwright/test';

type OwnedProfile = {
  id: string;
  created_by_id?: string;
  created_by?: string;
  is_coach?: boolean;
  coach_status?: string;
  coach_profile_visibility?: string;
};

async function dismissCookies(page: import('@playwright/test').Page) {
  const accept = page.getByRole('button', { name: /^Accept$/i });
  if (await accept.isVisible({ timeout: 3000 }).catch(() => false)) await accept.click();
}

async function getIdentityState(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const token = localStorage.getItem('base44_access_token');
    const appId =
      localStorage.getItem('base44_app_id') ||
      document.querySelector('meta[name="base44-app-id"]')?.getAttribute('content');
    if (!token || !appId) throw new Error('Missing Base44 auth token/app id');

    const importRemote = new Function('url', 'return import(url)') as (
      url: string,
    ) => Promise<{ createClient: (options: { appId: string; token: string }) => any }>;
    const { createClient } = await importRemote('https://esm.sh/@base44/sdk@0.8.0');
    const client = createClient({ appId, token });
    const me = await client.auth.me();

    const byId = await client.entities.UserProfile.filter(
      { created_by_id: me.id },
      '-updated_date',
      50,
    );
    const byEmail = await client.entities.UserProfile.filter(
      { created_by: me.email },
      '-updated_date',
      50,
    );
    const allProfiles = [...(byId || []), ...(byEmail || [])];
    const ownedProfiles: OwnedProfile[] = [];
    const seen = new Set<string>();

    for (const profile of allProfiles) {
      const createdByIdMatch = profile.created_by_id === me.id;
      const emailMatch =
        typeof profile.created_by === 'string' &&
        typeof me.email === 'string' &&
        profile.created_by.toLowerCase() === me.email.toLowerCase();
      if (!profile.id || seen.has(profile.id) || (!createdByIdMatch && !emailMatch)) continue;
      seen.add(profile.id);
      ownedProfiles.push({
        id: profile.id,
        created_by_id: profile.created_by_id,
        created_by: profile.created_by,
        is_coach: profile.is_coach,
        coach_status: profile.coach_status,
        coach_profile_visibility: profile.coach_profile_visibility,
      });
    }

    let ownedTeams: unknown[] = [];
    try {
      ownedTeams = await client.entities.Team.filter({ created_by_id: me.id }, '-updated_date', 50);
    } catch {
      ownedTeams = [];
    }

    return {
      me: { id: me.id, email: me.email },
      ownedProfiles,
      ownedTeams,
    };
  });
}

test.describe('profile identity and role navigation', () => {
  test('each signed-in account has one canonical UserProfile', async ({ page }, testInfo) => {
    test.skip(
      !['pro', 'free'].includes(testInfo.project.name),
      'Requires pro/free authenticated storage states.',
    );

    await page.goto('/Home', { waitUntil: 'networkidle' });
    await dismissCookies(page);

    const state = await getIdentityState(page);

    expect(state.ownedProfiles, `${state.me.email} must have exactly one own UserProfile`).toHaveLength(
      1,
    );
  });

  test('Trainees navigation follows coach/team ownership on desktop and mobile', async ({
    page,
  }, testInfo) => {
    test.skip(
      !['pro', 'free'].includes(testInfo.project.name),
      'Requires pro/free authenticated storage states.',
    );

    const expectations = {
      pro: {
        shouldShowTrainees: true,
        shouldShowCoachOps: true,
      },
      free: {
        shouldShowTrainees: false,
        shouldShowCoachOps: false,
      },
    } as const;
    const expected = expectations[testInfo.project.name as 'pro' | 'free'];

    for (const viewport of [
      { label: 'desktop', width: 1440, height: 900 },
      { label: 'mobile', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/Home', { waitUntil: 'networkidle' });
      await dismissCookies(page);

      const state = await getIdentityState(page);
      const canonicalProfile = state.ownedProfiles[0];
      const hasOwnedTeam = Array.isArray(state.ownedTeams) && state.ownedTeams.length > 0;
      const isCoachOrOwner =
        canonicalProfile?.is_coach === true || canonicalProfile?.coach_status === 'approved';

      expect(
        isCoachOrOwner && hasOwnedTeam,
        `${state.me.email} ${viewport.label} fixture must match expected Trainees eligibility`,
      ).toBe(expected.shouldShowTrainees);

      const body = await page.locator('body').innerText();
      const hasTrainees = /\bTrainees\b/i.test(body);
      const hasCoachHub = /Coach Hub/i.test(body);
      const hasServices = /\bServices\b/i.test(body);

      expect(hasTrainees, `${state.me.email} ${viewport.label} Trainees nav`).toBe(
        expected.shouldShowTrainees,
      );

      if (viewport.label === 'desktop') {
        expect(hasCoachHub, `${state.me.email} desktop Coach Hub nav`).toBe(
          expected.shouldShowCoachOps,
        );
        expect(hasServices, `${state.me.email} desktop Services nav`).toBe(
          expected.shouldShowCoachOps,
        );
      }
    }
  });
});
