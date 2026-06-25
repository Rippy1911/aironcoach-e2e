/**
 * Broader QA sweep — slower pacing, more routes, network + UI checks.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const BASE = (process.env.BASE_URL || 'https://airon.coach').replace(/\/$/, '');
const AUTH = path.resolve('e2e/.auth/pro.json');
const OUT = path.resolve('test-results/coach-explore');
mkdirSync(OUT, { recursive: true });

const EMAIL = process.env.TEST_PRO_EMAIL || 'lokistakontakt@gmail.com';
const USER_SLUG = EMAIL.split('@')[0];
const WAIT = 3500;

const findings = [];
const apiErrors = [];

function add(sev, area, title, detail, evidence = '') {
  findings.push({ sev, area, title, detail, evidence });
}

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } })
).newPage();

page.on('response', async (res) => {
  if (res.status() >= 400 && res.url().includes('airon.coach')) {
    let body = '';
    try {
      body = (await res.text()).slice(0, 180);
    } catch {}
    apiErrors.push({ status: res.status(), url: res.url().replace(/.*airon\.coach/, ''), body });
  }
});

async function go(route, shotName) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(WAIT);
  const accept = page.getByRole('button', { name: /^Accept$/i });
  if (await accept.isVisible({ timeout: 1000 }).catch(() => false)) await accept.click({ force: true });
  if (shotName) await page.screenshot({ path: path.join(OUT, shotName) });
  return (await page.evaluate(() => document.body?.innerText || '')).replace(/\s+/g, ' ');
}

// Settings — click Coach Profile sub-nav (tab=coach query ignored)
await go('/Settings', '30-settings-default.png');
const coachProfileNav = page.getByRole('button', { name: /coach profile/i }).or(page.getByText('Coach Profile', { exact: true }));
if (await coachProfileNav.first().isVisible({ timeout: 3000 }).catch(() => false)) {
  await coachProfileNav.first().click({ force: true });
  await page.waitForTimeout(WAIT);
  const coachSettingsText = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, '31-settings-coach-clicked.png') });
  if (/fitness goal|lose weight|active sports/i.test(coachSettingsText) && !/availability|accepting clients|deactivate/i.test(coachSettingsText)) {
    add('P1', 'Settings', '?tab=coach query param ignored', 'URL Settings?tab=coach shows Account/Trainee form, not coach panel', '31-settings-coach-clicked.png');
  }
  if (!/deactivate|pause coach|reactivate/i.test(coachSettingsText)) {
    add('P2', 'Settings/Coach', 'No coach lifecycle controls visible', 'Expected pause/deactivate/reactivate from prompt 13', '31-settings-coach-clicked.png');
  }
}

// Community deep
const comm = await go('/Community', '32-community.png');
if (/quick actions/i.test(comm) && /share a tip|announcement/i.test(comm)) {
  add('P2', 'Community', 'Feed still has composer + Quick Actions rail', 'Dual column: 680px feed + right rail; Quick Actions duplicate navigation', '32-community.png');
}
if (/suggested coaches/i.test(comm) && /marek nowak/i.test(comm)) {
  add('INFO', 'Community', 'Suggested coaches rail loads', 'Marek Nowak visible');
}

// People tab
const people = await go('/Community?tab=people', '33-people.png');
if (/could not load|error/i.test(people)) add('P1', 'Community/People', 'People tab error', people.slice(0, 200));

// MyFollows orphan
const follows = await go('/MyFollows', '34-myfollows.png');
if (/loading/i.test(follows) && follows.length < 100) {
  add('P1', 'MyFollows', 'MyFollows stuck loading or empty shell', follows.slice(0, 150), '34-myfollows.png');
}

// Trainees
const trainees = await go('/Trainees', '35-trainees.png');
if (/login|sign in/i.test(trainees)) add('P2', 'Trainees', 'Trainees redirects or login wall', page.url());

// Public coach — Sebastian
await go('/CoachDirectory', null);
const sebLink = page.locator('a[href*="UserProfile"]').first();
if (await sebLink.isVisible({ timeout: 5000 }).catch(() => false)) {
  const href = await sebLink.getAttribute('href');
  await sebLink.click({ force: true });
  await page.waitForTimeout(WAIT);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim()));
  const active = await page.evaluate(() => document.querySelector('[role="tab"][data-state="active"]')?.textContent?.trim());
  await page.screenshot({ path: path.join(OUT, '36-public-coach.png') });
  if (tabs.includes('Coach') && tabs.indexOf('Coach') > tabs.indexOf('Overview')) {
    add('P0', 'UserProfile', 'Public coach: Coach tab after Overview', `tabs=${tabs.join('|')} active=${active}`, '36-public-coach.png');
  }
  // click Coach tab
  const coachTab = page.getByRole('tab', { name: /^Coach$/i });
  if (await coachTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await coachTab.click();
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: path.join(OUT, '37-public-coach-tab.png') });
    const w = await page.evaluate(() => {
      const el = document.querySelector('[class*="max-w"]');
      const vw = window.innerWidth;
      const blocks = [...document.querySelectorAll('[class*="max-w"]')].map((e) => Math.round(e.getBoundingClientRect().width / vw * 100));
      return Math.max(...blocks, 0);
    });
    if (w < 60) add('P1', 'UserProfile/Coach tab', 'Coach tab content narrow', `~${w}% viewport width`, '37-public-coach-tab.png');
  }
}

// My Profile — canonical self row (prompt 07 regression)
await go('/Home', null);
const profileTriggerMp = page.locator(`text=${USER_SLUG}`).first();
if (await profileTriggerMp.isVisible({ timeout: 3000 }).catch(() => false)) {
  await profileTriggerMp.click({ force: true });
} else {
  const onlineTriggerMp = page.getByText('Online', { exact: true }).first();
  if (await onlineTriggerMp.isVisible({ timeout: 3000 }).catch(() => false)) {
    await onlineTriggerMp.click({ force: true });
  }
}
await page.waitForTimeout(1500);
const myProfileLink = page.getByText('My Profile', { exact: true });
if (await myProfileLink.isVisible({ timeout: 3000 }).catch(() => false)) {
  await myProfileLink.click({ force: true });
  await page.waitForTimeout(6000);
  const profileUrl = page.url();
  const profileHeadings = await page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3')].map((e) => e.textContent?.trim()).slice(0, 3),
  );
  await page.screenshot({ path: path.join(OUT, '28-my-profile.png') });
  const wrongId = '698867e38ffb4566bd59e048';
  if (profileUrl.includes(wrongId) || /mkpiwecki/i.test(profileHeadings.join(' '))) {
    add(
      'P0',
      'UserProfile',
      'My Profile opens wrong canonical row',
      `Logged in as ${EMAIL} → ${profileUrl} headings=${profileHeadings.join('|')}`,
      '28-my-profile.png',
    );
  }
} else {
  add('P1', 'Menu', 'My Profile link not found in profile menu', `Logged in as ${EMAIL}`);
}

// Menu flyout — presence uses busy/dnd/invisible (not legacy Away/Busy/Offline copy)
await go('/Home', null);
const acceptFlyout = page.getByRole('button', { name: /^Accept$/i });
if (await acceptFlyout.isVisible({ timeout: 1000 }).catch(() => false)) await acceptFlyout.click({ force: true });
const profileTrigger = page.locator(`text=${USER_SLUG}`).first();
if (await profileTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
  await profileTrigger.click({ force: true });
} else {
  const onlineTrigger = page.getByText('Online', { exact: true }).first();
  if (await onlineTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await onlineTrigger.click({ force: true });
  }
}
await page.waitForTimeout(1500);
const online = page.locator('[class*="popover"], [role="menu"]').getByText('Online', { exact: true }).first();
if (await online.isVisible({ timeout: 2000 }).catch(() => false)) {
  await online.hover({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, '38-online-hover.png') });
  const flyout = await page
    .getByText(/Busy|Zajęty|DND|Do not disturb|Invisible|Niewidoczny/i)
    .first()
    .isVisible()
    .catch(() => false);
  if (!flyout) {
    add(
      'P1',
      'Menu',
      'Presence flyout options not visible on hover',
      'Expected busy/dnd/invisible presence panel after hovering Online',
      '38-online-hover.png',
    );
  }
}

// Dedupe API errors
const apiUnique = [...new Map(apiErrors.map((e) => [`${e.status}:${e.url}`, e])).values()];
let reportedRateLimit = false;
for (const e of apiUnique) {
  if (e.status === 403 && e.url.includes('698867e38ffb4566bd59e048')) {
    add('P0', 'CreateCoachProfile', 'Save updates wrong UserProfile (mkpiwecki)', `403 Permission denied on entity 698867e38ffb4566bd59e048 for ${EMAIL}`, '21-after-save-attempt.png');
  }
  if (e.status === 404 && e.url.includes('classifyConversationTier')) {
    add('P2', 'API', 'classifyConversationTier 404', 'Deployment does not exist');
  }
  if (e.status === 404 && e.url.includes('getCoachStats')) {
    add('P0', 'CoachBusinessHub', 'getCoachStats 404', e.body);
  }
  if (e.status === 500 && e.url.includes('getWorkoutsWithSets')) {
    add('P2', 'API', 'getWorkoutsWithSets 500', 'Home dashboard workouts fail');
  }
  if (e.status === 429) {
    if (!reportedRateLimit) {
      const count = apiUnique.filter((x) => x.status === 429).length;
      add('P1', 'API', 'Rate limit 429 on repeated entity fetches', `${count} unique 429 responses during one sweep; burst profile/team/workout queries spam API`);
      reportedRateLimit = true;
    }
  }
}

const report = {
  account: EMAIL,
  exploredAt: new Date().toISOString(),
  findings,
  apiErrors: apiUnique,
};
writeFileSync(path.join(OUT, 'qa-sweep.json'), JSON.stringify(report, null, 2));
await browser.close();

console.log(`\n=== ${findings.length} findings ===`);
for (const f of findings) console.log(`[${f.sev}] ${f.area}: ${f.title}`);
