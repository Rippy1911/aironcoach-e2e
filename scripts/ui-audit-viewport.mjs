/**
 * Viewport width audit (anonymous / login-wall routes).
 * Usage: BASE_URL=https://airon.coach node scripts/ui-audit-viewport.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://airon.coach';

const ROUTES = [
  { path: '/Landing', public: true },
  { path: '/CoachDirectory', public: true },
  { path: '/login', public: true },
  { path: '/Community', authWall: true },
  { path: '/CoachBusinessHub', authWall: true },
  { path: '/CoachServices', authWall: true },
  { path: '/Settings', authWall: true },
  { path: '/CreateCoachProfile', authWall: true },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const results = [];

for (const route of ROUTES) {
  await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const m = await page.evaluate(() => {
    const vw = window.innerWidth;
    const maxWNodes = [...document.querySelectorAll('[class*="max-w"]')].slice(0, 12);
    const narrowest = maxWNodes
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          cls: (el.className || '').match(/max-w-[^\s]+/)?.[0],
          width: Math.round(r.width),
          widthPct: Math.round((r.width / vw) * 100),
        };
      })
      .filter((x) => x.cls);
    const main = document.querySelector('main') || document.body;
    const mr = main.getBoundingClientRect();
    return {
      href: location.href,
      title: document.title,
      mainWidthPct: Math.round((mr.width / vw) * 100),
      viewport: { vw, vh: window.innerHeight },
      narrowest,
      textSample: (document.body?.innerText || '').slice(0, 200),
      loginWall: /sign in|log in|google/i.test(document.body?.innerText || ''),
    };
  });
  results.push({ route: route.path, ...m });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
