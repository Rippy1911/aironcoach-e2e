/**
 * Full coach capability exploration on prod — creates profile, probes flows, logs bugs.
 * Usage: USER_NAME=... USER_PASS=... TEST_PRO_EMAIL=... node scripts/coach-explore.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import * as path from 'node:path';

const BASE = (process.env.BASE_URL || 'https://airon.coach').replace(/\/$/, '');
const AUTH = path.resolve('e2e/.auth/pro.json');
const OUT = path.resolve('test-results/coach-explore');
const TS = new Date().toISOString().replace(/[:.]/g, '-');

mkdirSync(OUT, { recursive: true });
const bugs = [];
const log = [];
const networkFails = [];

function bug(id, severity, area, title, detail, evidence = '') {
  bugs.push({ id, severity, area, title, detail, evidence, at: new Date().toISOString() });
  console.log(`[${severity}] ${id}: ${title}`);
}

function note(msg) {
  log.push({ t: Date.now(), msg });
  console.log(`  · ${msg}`);
}

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /^Accept$/i });
  if (await accept.isVisible({ timeout: 2000 }).catch(() => false)) {
    await accept.click({ force: true });
    await page.waitForTimeout(500);
  }
}

async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function bodySnippet(page, n = 400) {
  return (await page.evaluate(() => document.body?.innerText || '')).replace(/\s+/g, ' ').slice(0, n);
}

async function getTabs(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"]')].map((t) => ({
      text: t.textContent?.trim(),
      state: t.getAttribute('data-state') || t.getAttribute('aria-selected'),
    })),
  );
}

// Ensure auth exists
import { existsSync } from 'node:fs';
if (!existsSync(AUTH)) {
  console.error('Missing e2e/.auth/pro.json — run password-login-setup first');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: AUTH,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('airon.coach')) return;
  if (res.status() >= 400 && (url.includes('/functions/') || url.includes('/api/'))) {
    let body = '';
    try {
      body = (await res.text()).slice(0, 200);
    } catch {}
    networkFails.push({ status: res.status(), url, body, method: res.request().method() });
  }
});

page.on('console', (msg) => {
  if (msg.type() === 'error') log.push({ t: Date.now(), consoleError: msg.text() });
});

// ─── 1. Baseline: Home + menu ───────────────────────────────────────────────
await page.goto(`${BASE}/Home`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await dismissCookies(page);

// Open profile menu
await page.locator('text=lokistastream').first().click({ force: true }).catch(() => {});
await page.waitForTimeout(1500);
const menuBefore = await bodySnippet(page, 800);
await shot(page, '01-menu-before-coach');
const hasCoachHubBefore = /Coach Hub/i.test(menuBefore);
note(`Menu before coach: CoachHub=${hasCoachHubBefore}`);

// My Profile before coach create
const myProfile = page.getByText('My Profile', { exact: true });
if (await myProfile.isVisible({ timeout: 3000 }).catch(() => false)) {
  await myProfile.click({ force: true });
  await page.waitForTimeout(4000);
  const profileUrl = page.url();
  const profileName = await page.evaluate(() => {
    const h = document.querySelector('h1,h2,[class*="text-3xl"],[class*="text-2xl"]');
    return h?.textContent?.trim();
  });
  await shot(page, '02-my-profile-before-coach');
  if (!/lokistastream/i.test(profileName || '') && !profileUrl.includes('lokista')) {
    bug(
      'BUG-001',
      'P0',
      'UserProfile',
      'My Profile opens wrong user profile',
      `Expected lokistastream, got name="${profileName}" url=${profileUrl}`,
      '02-my-profile-before-coach.png',
    );
  }
  note(`My Profile → ${profileName} @ ${profileUrl}`);
}

// ─── 2. Create coach profile ────────────────────────────────────────────────
await page.goto(`${BASE}/CreateCoachProfile`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
await dismissCookies(page);
await shot(page, '03-create-coach-start');

const uniqueSuffix = TS.slice(-6);
const coachName = `E2E Coach ${uniqueSuffix}`;
const businessName = `E2E Fitness ${uniqueSuffix}`;

// Fill visible inputs aggressively
const inputs = page.locator('input:visible, textarea:visible');
const inputCount = await inputs.count();
note(`CreateCoachProfile: ${inputCount} visible inputs`);

for (let i = 0; i < inputCount; i++) {
  const el = inputs.nth(i);
  const type = (await el.getAttribute('type')) || 'text';
  const ph = ((await el.getAttribute('placeholder')) || '').toLowerCase();
  const name = ((await el.getAttribute('name')) || '').toLowerCase();
  const label = ph + name;
  if (type === 'checkbox' || type === 'radio' || type === 'file') continue;
  let val = 'Test value';
  if (/business|company|studio/i.test(label)) val = businessName;
  else if (/name|display/i.test(label)) val = coachName;
  else if (/headline|tagline|title/i.test(label)) val = 'Strength & conditioning coach';
  else if (/bio|about|description/i.test(label)) val = 'E2E test coach bio — certified trainer, 10+ years experience.';
  else if (/city|location/i.test(label)) val = 'Warszawa';
  else if (/price|rate/i.test(label)) val = '99';
  else if (/email/i.test(label)) val = process.env.TEST_PRO_EMAIL || 'lokistastream@gmail.com';
  else if (/url|website|link/i.test(label)) val = 'https://example.com';
  else if (/phone/i.test(label)) val = '+48123456789';
  await el.fill(val).catch(() => {});
}

// Click specialty/sport chips if present
const chips = page.locator('button').filter({ hasText: /strength|calisthenics|nutrition|hybrid/i });
const chipCount = await chips.count();
for (let i = 0; i < Math.min(chipCount, 3); i++) {
  await chips.nth(i).click({ force: true }).catch(() => {});
}

await shot(page, '04-create-coach-filled');

// Save / Continue / Create buttons
const saveBtn = page
  .getByRole('button', { name: /save|create coach|publish|complete|continue|next/i })
  .first();
if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
  const failsBefore = networkFails.length;
  await saveBtn.click({ force: true });
  await page.waitForTimeout(6000);
  await shot(page, '05-after-coach-save');
  note(`After save URL: ${page.url()}`);
  note(`After save text: ${await bodySnippet(page, 300)}`);
  const newFails = networkFails.slice(failsBefore);
  for (const f of newFails) {
    bug('BUG-API', 'P0', 'CreateCoachProfile', `API ${f.status} on save`, `${f.method} ${f.url}: ${f.body}`, '05-after-coach-save.png');
  }
} else {
  bug('BUG-002', 'P1', 'CreateCoachProfile', 'No Save/Create button found', `inputs=${inputCount}`, '04-create-coach-filled.png');
}

// Try additional save buttons on page
for (const label of [/save profile/i, /save changes/i, /create coach profile/i, /^save$/i]) {
  const b = page.getByRole('button', { name: label }).first();
  if (await b.isVisible({ timeout: 1500 }).catch(() => false)) {
    await b.click({ force: true });
    await page.waitForTimeout(4000);
    note(`Clicked extra: ${label}`);
  }
}
await shot(page, '06-coach-save-final');

// ─── 3. Coach Business Hub ──────────────────────────────────────────────────
await page.goto(`${BASE}/CoachBusinessHub`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
const hubText = await bodySnippet(page, 500);
await shot(page, '07-coach-business-hub');
if (/not a coach|create a coach profile first/i.test(hubText)) {
  bug('BUG-003', 'P0', 'CoachBusinessHub', 'Empty state after coach profile save', hubText, '07-coach-business-hub.png');
} else if (/error|retry|something went wrong/i.test(hubText)) {
  bug('BUG-004', 'P0', 'CoachBusinessHub', 'Error state on hub', hubText, '07-coach-business-hub.png');
} else {
  note(`Coach Hub loaded: ${hubText.slice(0, 120)}`);
}

const hubGetCoachStats = networkFails.filter((f) => f.url.includes('getCoachStats'));
if (hubGetCoachStats.length) {
  bug('BUG-005', 'P0', 'CoachBusinessHub', 'getCoachStats API failure', JSON.stringify(hubGetCoachStats[0]), '07-coach-business-hub.png');
}

// ─── 4. Coach Services ──────────────────────────────────────────────────────
await page.goto(`${BASE}/CoachServices`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
const svcText = await bodySnippet(page, 500);
await shot(page, '08-coach-services');
if (/create a coach profile first/i.test(svcText)) {
  bug('BUG-006', 'P1', 'CoachServices', 'Gated — coach profile not recognized', svcText.slice(0, 200), '08-coach-services.png');
} else {
  // Try create offer
  const createOffer = page.getByRole('button', { name: /create coaching offer|create offer|new offer/i }).first();
  if (await createOffer.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createOffer.click({ force: true });
    await page.waitForTimeout(3000);
    await shot(page, '09-create-offer-dialog');
    const offerInputs = page.locator('input:visible, textarea:visible');
    for (let i = 0; i < (await offerInputs.count()); i++) {
      const el = offerInputs.nth(i);
      const ph = ((await el.getAttribute('placeholder')) || '').toLowerCase();
      let val = 'E2E Test Offer';
      if (/price|amount/i.test(ph)) val = '149';
      if (/description/i.test(ph)) val = '4-week strength program with weekly check-ins.';
      await el.fill(val).catch(() => {});
    }
    const saveOffer = page.getByRole('button', { name: /save|create|publish/i }).last();
    if (await saveOffer.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveOffer.click({ force: true });
      await page.waitForTimeout(4000);
      await shot(page, '10-after-offer-create');
    }
    const pageText = await bodySnippet(page, 600);
    if (!/archive|delete|usuń/i.test(pageText) && /edit/i.test(pageText)) {
      bug('BUG-007', 'P0', 'CoachServices', 'Offer cards lack Archive/Delete', 'Only Edit visible on offers', '10-after-offer-create.png');
    }
  } else {
    note('No create offer button visible');
  }
}

// ─── 5. Settings coach tab ─────────────────────────────────────────────────
await page.goto(`${BASE}/Settings?tab=coach`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
await shot(page, '11-settings-coach');
const settingsCoach = await bodySnippet(page, 500);
if (/deactivate|pause coach|archive offer/i.test(settingsCoach)) {
  note('Coach lifecycle controls present');
} else if (!/availability|accepting clients|coach profile/i.test(settingsCoach)) {
  bug('BUG-008', 'P2', 'Settings', 'Coach tab missing expected controls', settingsCoach.slice(0, 200), '11-settings-coach.png');
}

// ─── 6. My Profile as coach ─────────────────────────────────────────────────
await page.goto(`${BASE}/Home`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.locator('text=lokistastream').first().click({ force: true }).catch(() => {});
await page.waitForTimeout(1000);
const mp2 = page.getByText('My Profile', { exact: true });
if (await mp2.isVisible({ timeout: 3000 }).catch(() => false)) {
  await mp2.click({ force: true });
  await page.waitForTimeout(5000);
  const tabs = await getTabs(page);
  const activeTab = tabs.find((t) => t.state === 'active' || t.state === 'true')?.text;
  const profileName2 = await page.evaluate(() => {
    const els = [...document.querySelectorAll('h1,h2,h3')];
    return els.map((e) => e.textContent?.trim()).filter(Boolean).slice(0, 3);
  });
  await shot(page, '12-my-profile-after-coach');
  note(`Profile after coach: names=${profileName2.join('|')} tabs=${tabs.map((t) => t.text).join('>')} active=${activeTab}`);
  const tabOrder = tabs.map((t) => t.text?.toLowerCase());
  const coachIdx = tabOrder.indexOf('coach');
  const overviewIdx = tabOrder.indexOf('overview');
  if (coachIdx >= 0 && overviewIdx >= 0 && coachIdx > overviewIdx) {
    bug('BUG-009', 'P0', 'UserProfile', 'Coach tab is last (after Overview)', tabOrder.join(' → '), '12-my-profile-after-coach.png');
  }
  if (activeTab?.toLowerCase() === 'overview' && tabOrder.includes('coach')) {
    bug('BUG-010', 'P0', 'UserProfile', 'Default tab is Overview not Coach for coach user', `active=${activeTab}`, '12-my-profile-after-coach.png');
  }
  if (!/lokistastream|E2E Coach/i.test(profileName2.join(' '))) {
    bug('BUG-011', 'P0', 'UserProfile', 'Wrong profile after coach create', profileName2.join(', '), '12-my-profile-after-coach.png');
  }
}

// ─── 7. Menu after coach ────────────────────────────────────────────────────
await page.goto(`${BASE}/Home`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.locator('text=lokistastream').first().click({ force: true }).catch(() => {});
await page.waitForTimeout(1500);
const menuAfter = await bodySnippet(page, 800);
await shot(page, '13-menu-after-coach');
if (/Coach Hub/i.test(menuAfter)) {
  note('Coach Hub visible in menu');
  const hub = page.getByText('Coach Hub', { exact: true });
  if (await hub.isVisible({ timeout: 2000 }).catch(() => false)) {
    await hub.click({ force: true });
    await page.waitForTimeout(4000);
    await shot(page, '14-coach-hub-from-menu');
  }
} else {
  bug('BUG-012', 'P1', 'Menu', 'Coach Hub missing after coach profile', menuAfter.slice(0, 200), '13-menu-after-coach.png');
}

// Online flyout
await page.goto(`${BASE}/Home`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.locator('text=lokistastream').first().click({ force: true }).catch(() => {});
await page.waitForTimeout(1000);
const online = page.getByText('Online', { exact: true }).first();
if (await online.isVisible({ timeout: 3000 }).catch(() => false)) {
  await online.hover();
  await page.waitForTimeout(1000);
  await shot(page, '15-online-hover');
  const flyout = await page.getByText(/Away|Busy|Offline|Appear offline/i).first().isVisible().catch(() => false);
  if (!flyout) {
    bug('BUG-013', 'P0', 'Menu', 'Online status flyout not visible on hover', 'Away/Busy/Offline not found', '15-online-hover.png');
  }
}

// Chevron on My Profile without submenu
const menuHtml = await page.evaluate(() => document.body.innerText);
if (/My Profile/i.test(menuHtml)) {
  const hasChevronMyProfile = await page.evaluate(() => {
    const items = [...document.querySelectorAll('*')].filter((el) => el.textContent?.trim() === 'My Profile');
    return items.some((el) => el.parentElement?.innerHTML?.includes('chevron') || el.innerHTML?.includes('>'));
  });
  if (hasChevronMyProfile) {
    bug('BUG-014', 'P1', 'Menu', 'Chevron on My Profile without submenu', 'Misleading navigation affordance', '13-menu-after-coach.png');
  }
}

// ─── 8. Community + edge routes ─────────────────────────────────────────────
for (const r of [
  { path: '/Community', name: 'community' },
  { path: '/Community?tab=people', name: 'community-people' },
  { path: '/MyFollows', name: 'my-follows' },
  { path: '/Trainees', name: 'trainees' },
]) {
  await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  const txt = await bodySnippet(page, 300);
  await shot(page, `16-${r.name}`);
  if (/could not load|black screen|something went wrong|typeerror/i.test(txt)) {
    bug('BUG-015', 'P1', r.path, 'Section error or fallback', txt, `16-${r.name}.png`);
  }
  if (r.path === '/Community' && /create a post|share a coaching post/i.test(txt)) {
    const createMatches = (txt.match(/create|share a tip|share a coaching/gi) || []).length;
    if (createMatches > 2) {
      bug('BUG-016', 'P1', 'Community', 'Multiple create-post entry points', `~${createMatches} CTAs in feed area`, '16-community.png');
    }
  }
}

// ─── 9. Public coach profile preview ────────────────────────────────────────
await page.goto(`${BASE}/CoachDirectory`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const selfInDir = await page.getByText(new RegExp(coachName.slice(0, 10), 'i')).isVisible().catch(() => false);
note(`Self visible in directory: ${selfInDir}`);

// ─── Save report ────────────────────────────────────────────────────────────
const report = {
  meta: { account: process.env.TEST_PRO_EMAIL, base: BASE, exploredAt: new Date().toISOString() },
  coachName,
  businessName,
  bugs: bugs.map((b, i) => ({ ...b, id: b.id || `BUG-${String(i + 1).padStart(3, '0')}` })),
  networkFails: [...new Map(networkFails.map((f) => [`${f.method}:${f.url}`, f])).values()],
  log,
};
writeFileSync(path.join(OUT, 'explore-report.json'), JSON.stringify(report, null, 2));

await browser.close();
console.log(`\n=== ${bugs.length} bugs found ===`);
console.log(`Report: ${path.join(OUT, 'explore-report.json')}`);
