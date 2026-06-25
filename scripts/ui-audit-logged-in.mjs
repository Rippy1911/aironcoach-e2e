/**
 * Logged-in UI audit: screenshots + viewport metrics on coach-facing routes.
 * Usage:
 *   TEST_PRO_EMAIL=... node scripts/ui-audit-logged-in.mjs
 * Requires: e2e/.auth/pro.json
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const BASE = (process.env.BASE_URL || 'https://airon.coach').replace(/\/$/, '');
const AUTH = path.resolve('e2e/.auth/pro.json');
const OUT = path.resolve('test-results/ui-audit-logged-in');
const VIEWPORT = { width: 1440, height: 900 };

const ROUTES = [
  { path: '/Community', name: 'Community', tab: null },
  { path: '/Community?tab=teams', name: 'Community-teams', tab: 'teams' },
  { path: '/Community?tab=messages', name: 'Community-messages', tab: 'messages' },
  { path: '/CoachBusinessHub', name: 'CoachBusinessHub' },
  { path: '/CoachServices', name: 'CoachServices' },
  { path: '/CoachDirectory', name: 'CoachDirectory' },
  { path: '/Settings', name: 'Settings' },
  { path: '/Settings?tab=coach', name: 'Settings-coach' },
  { path: '/CreateCoachProfile', name: 'CreateCoachProfile' },
  { path: '/MyFollows', name: 'MyFollows' },
  { path: '/Messages', name: 'Messages' },
  { path: '/Teams', name: 'Teams' },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: AUTH,
  viewport: VIEWPORT,
});
const page = await context.newPage();

const results = [];

async function measure() {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const main = document.querySelector('main') || document.querySelector('[class*="flex-1"]') || document.body;
    const mr = main.getBoundingClientRect();
    const blocks = [...document.querySelectorAll('[class*="max-w"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 50) return null;
        return {
          cls: (el.className || '').toString().match(/max-w-[^\s]+/)?.[0],
          width: Math.round(r.width),
          widthPct: Math.round((r.width / vw) * 100),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.width - b.width)
      .slice(0, 8);
    const primary = blocks.length ? blocks.reduce((a, b) => (a.width > b.width ? a : b)) : null;
    return {
      href: location.href,
      title: document.title,
      viewport: { vw, vh },
      mainWidthPct: Math.round((mr.width / vw) * 100),
      primaryContent: primary,
      narrowest: blocks.slice(0, 5),
      loginWall: /sign in to continue|continue with google/i.test(document.body?.innerText || ''),
      bodyPreview: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
    };
  });
}

// Resolve self profile URL from menu or home
let profileUrl = null;
await page.goto(`${BASE}/Home`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);
const accept = page.getByRole('button', { name: /^Accept$/i });
if (await accept.isVisible({ timeout: 2000 }).catch(() => false)) await accept.click();

// Try sidebar profile / My Profile
const profileLink = page.locator('a[href*="UserProfile"], [href*="UserProfile"]').first();
if (await profileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
  const href = await profileLink.getAttribute('href');
  if (href) profileUrl = href.startsWith('http') ? href : `${BASE}${href}`;
}

for (const route of ROUTES) {
  const url = `${BASE}${route.path}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    const m = await measure();
    const shot = path.join(OUT, `${route.name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    results.push({ route: route.path, name: route.name, screenshot: shot, ...m });
    console.log(`✓ ${route.name} — primary ${m.primaryContent?.widthPct ?? '?'}% loginWall=${m.loginWall}`);
  } catch (err) {
    results.push({ route: route.path, name: route.name, error: String(err) });
    console.error(`✗ ${route.name}:`, err.message);
  }
}

if (profileUrl) {
  for (const tab of ['', '?tab=coach', '?tab=overview', '?tab=activity']) {
    const url = profileUrl.includes('?') && tab ? profileUrl.replace(/\?.*$/, tab) : profileUrl + tab;
    const name = `UserProfile${tab || '-default'}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(4000);
      const m = await measure();
      const tabs = await page.evaluate(() =>
        [...document.querySelectorAll('[role="tab"], button[data-state]')]
          .map((el) => el.textContent?.trim())
          .filter(Boolean)
          .slice(0, 10),
      );
      const shot = path.join(OUT, `${name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      results.push({ route: url, name, tabsVisible: tabs, screenshot: shot, ...m });
      console.log(`✓ ${name} tabs=${tabs.join('|')} primary ${m.primaryContent?.widthPct ?? '?'}%`);
    } catch (err) {
      results.push({ name, error: String(err) });
    }
  }
}

// Profile menu popover
try {
  await page.goto(`${BASE}/Home`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  const avatar = page.locator('[data-testid="sidebar-profile"], button:has(img), [class*="avatar"]').first();
  const profileBtn = page.getByText(/My Profile|Coach Hub|Online/i).first();
  const trigger = page.locator('button').filter({ has: page.locator('img') }).first();
  if (await trigger.isVisible({ timeout: 5000 }).catch(() => false)) {
    await trigger.click();
    await page.waitForTimeout(1500);
    const shot = path.join(OUT, 'ProfileMenu-open.png');
    await page.screenshot({ path: shot, fullPage: false });
    const menuText = await page.evaluate(() => document.body.innerText.slice(0, 800));
    results.push({ name: 'ProfileMenu-open', screenshot: shot, bodyPreview: menuText });
    console.log('✓ ProfileMenu-open');
  }
} catch (err) {
  results.push({ name: 'ProfileMenu-open', error: String(err) });
}

writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(`\nWrote ${path.join(OUT, 'metrics.json')} (${results.length} entries)`);
