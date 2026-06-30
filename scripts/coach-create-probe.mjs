/**
 * Properly fill and save CreateCoachProfile, then probe coach flows.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';

const BASE = (process.env.BASE_URL || 'https://airon.coach').replace(/\/$/, '');
const AUTH = path.resolve('e2e/.auth/pro.json');
const OUT = path.resolve('test-results/coach-explore');
mkdirSync(OUT, { recursive: true });

const BIO =
  'Certified strength coach with 10+ years helping trainees build muscle, lose fat, and train smarter through evidence-based programming and weekly accountability check-ins.';

const EMAIL = process.env.TEST_PRO_EMAIL || 'lokistastream@gmail.com';
const USER_SLUG = EMAIL.split('@')[0];

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } })
).newPage();

const results = { steps: [], api: [], pages: {} };

page.on('response', async (res) => {
  const u = res.url();
  if (res.status() >= 400 && u.includes('airon.coach')) {
    let body = '';
    try {
      body = (await res.text()).slice(0, 200);
    } catch {}
    results.api.push({ status: res.status(), path: u.replace(/.*airon\.coach/, ''), body });
  }
});

async function acceptCookies() {
  const b = page.getByRole('button', { name: /^Accept$/i });
  if (await b.isVisible({ timeout: 1500 }).catch(() => false)) await b.click({ force: true });
}

async function fillVisibleInputs() {
  // First name / last name - often first two text inputs
  const textInputs = page.locator('input[type="text"]:visible, input:not([type]):visible');
  const count = await textInputs.count();
  const values = ['Loki', 'Stream', 'Loki Stream Coach', 'Strength & hybrid coaching Warsaw'];
  for (let i = 0; i < Math.min(count, values.length); i++) {
    await textInputs.nth(i).fill(values[i]);
    results.steps.push(`input[${i}]=${values[i]}`);
  }

  const bio = page.locator('textarea:visible').first();
  if (await bio.isVisible({ timeout: 3000 }).catch(() => false)) {
    await bio.fill(BIO);
    results.steps.push(`bio=${BIO.length}chars`);
  }

  // number inputs - experience, price
  const numbers = page.locator('input[type="number"]:visible');
  const n = await numbers.count();
  for (let i = 0; i < n; i++) {
    await numbers.nth(i).fill(i === 0 ? '10' : '120');
    results.steps.push(`number[${i}]`);
  }
}

async function pickSpecialties() {
  for (const spec of ['strength', 'nutrition', 'calisthenics', 'bodybuilding']) {
    const chip = page.getByRole('button', { name: new RegExp(`^${spec}$`, 'i') }).first();
    if (await chip.isVisible({ timeout: 1000 }).catch(() => false)) {
      await chip.click({ force: true });
      results.steps.push(`chip:${spec}`);
    }
  }
}

async function clickSave() {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  const names = [/save coach profile/i, /save profile/i, /create coach profile/i, /^save$/i, /publish/i];
  for (const re of names) {
    const btn = page.getByRole('button', { name: re }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      const label = await btn.innerText();
      await btn.click({ force: true });
      results.steps.push(`clicked:${label}`);
      await page.waitForTimeout(10000);
      return label;
    }
  }
  return null;
}

async function snap(name) {
  const p = path.join(OUT, name);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function pageText(n = 500) {
  return (await page.evaluate(() => document.body?.innerText || '')).replace(/\s+/g, ' ').slice(0, n);
}

// ── Create coach profile ─────────────────────────────────────────────────────
await page.goto(`${BASE}/CreateCoachProfile`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
await acceptCookies();
await fillVisibleInputs();
await pickSpecialties();
await snap('20-coach-form-ready.png');

const saveLabel = await clickSave();
results.pages.afterSave = { url: page.url(), text: await pageText(600), saveLabel };
await snap('21-after-save-attempt.png');

// If still on form, try completing checklist items
if (page.url().includes('CreateCoachProfile')) {
  const pills = page.locator('button').filter({ hasText: /→/ });
  const pc = await pills.count();
  for (let i = 0; i < Math.min(pc, 5); i++) {
    await pills.nth(i).click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  await fillVisibleInputs();
  await pickSpecialties();
  await clickSave();
  results.pages.afterSave2 = { url: page.url(), text: await pageText(600) };
  await snap('21b-second-save.png');
}

// ── Post-create routes ───────────────────────────────────────────────────────
for (const [key, route] of [
  ['hub', '/CoachBusinessHub'],
  ['services', '/CoachServices'],
  ['settingsCoach', '/Settings?tab=coach'],
  ['createCoach', '/CreateCoachProfile'],
]) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  results.pages[key] = { url: page.url(), text: await pageText(700) };
  await snap(`22-${key}.png`);
}

// ── Create coaching offer if unlocked ────────────────────────────────────────
if (!/create a coach profile first/i.test(results.pages.services?.text || '')) {
  const createBtn = page
    .getByRole('button', { name: /create coaching offer|create offer|new offer|\+ create/i })
    .first();
  if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await page.locator('input:visible, textarea:visible').first().fill('E2E Strength Program 4 weeks');
    const inputs = page.locator('input:visible');
    for (let i = 0; i < (await inputs.count()); i++) {
      const ph = ((await inputs.nth(i).getAttribute('placeholder')) || '').toLowerCase();
      if (/price|amount|pln|\$/i.test(ph)) await inputs.nth(i).fill('199');
    }
    const ta = page.locator('textarea:visible').first();
    if (await ta.isVisible()) await ta.fill('Four week personalized strength block with form checks and nutrition tips.');
    await snap('25-offer-form.png');
    const save = page.getByRole('button', { name: /save|create|publish/i }).last();
    if (await save.isVisible({ timeout: 3000 }).catch(() => false)) {
      await save.click({ force: true });
      await page.waitForTimeout(6000);
      results.pages.afterOffer = { text: await pageText(700) };
      await snap('26-after-offer.png');
    }
  }
}

// ── Menu + My Profile ────────────────────────────────────────────────────────
await page.goto(`${BASE}/Home`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
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
results.pages.menu = await pageText(800);
await snap('27-menu.png');

const mp = page.getByText('My Profile', { exact: true });
if (await mp.isVisible({ timeout: 2000 }).catch(() => false)) {
  await mp.click({ force: true });
  await page.waitForTimeout(6000);
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim()),
  );
  const h = await page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3')].map((e) => e.textContent?.trim()).slice(0, 3),
  );
  results.pages.myProfile = { url: page.url(), headings: h, tabs, text: await pageText(400) };
  await snap('28-my-profile.png');
}

// Merge with prior explore report if exists
const priorPath = path.join(OUT, 'explore-report.json');
let prior = { bugs: [] };
if (existsSync(priorPath)) prior = JSON.parse(readFileSync(priorPath, 'utf8'));

writeFileSync(path.join(OUT, 'coach-create-result.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify({ results, apiCount: results.api.length }, null, 2));
