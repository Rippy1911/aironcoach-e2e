/**
 * Static UI layout audit from production JS bundle.
 * Usage: node scripts/ui-audit-prod.mjs [bundle-url]
 */
import { readFileSync } from 'node:fs';

const DEFAULT_BUNDLE = 'https://airon.coach/assets/index-B1dXYyoW.js';

async function resolveBundleUrl() {
  if (process.argv[2]) return process.argv[2];
  try {
    const html = await fetch('https://airon.coach/').then((r) => r.text());
    const m = html.match(/assets\/index-[^"]+\.js/);
    if (m) return `https://airon.coach/${m[0]}`;
  } catch {
    /* fallback */
  }
  return DEFAULT_BUNDLE;
}

const BUNDLE_URL = await resolveBundleUrl();
const js = await fetch(BUNDLE_URL).then((r) => r.text());

function snippet(needle, before = 350, after = 650) {
  const i = js.indexOf(needle);
  if (i < 0) return null;
  return js.slice(Math.max(0, i - before), i + after);
}

function maxWs(text) {
  if (!text) return [];
  return [...new Set([...text.matchAll(/max-w-(?:\[[^\]]+\]|\w+)/g)].map((m) => m[0]))];
}

const freq = {};
for (const m of js.matchAll(/max-w-(?:\[[^\]]+\]|\w+)/g)) {
  freq[m[0]] = (freq[m[0]] || 0) + 1;
}

const up = snippet('is_public_coach');
const tabKeys = up ? [...up.matchAll(/key:"(\w+)"/g)].map((m) => m[1]) : [];

const report = {
  meta: { bundle: BUNDLE_URL, bytes: js.length, auditedAt: new Date().toISOString() },
  maxWidthFrequency: Object.fromEntries(
    Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15),
  ),
  checks: {
    userProfileTabOrder: tabKeys,
    coachTabLast: tabKeys.length > 0 && tabKeys[tabKeys.length - 1] === 'coach',
    manageCoachServiceTier: js.includes('manageCoachServiceTier'),
    archiveOfferLabel: /Archive offer|Delete offer/i.test(js),
    archivedVisibilityInUI: /visibility:\s*"archived"/.test(js),
    getCoachStatsRef: js.includes('getCoachStats'),
    notCoachEmpty: js.includes("You're not a coach yet"),
    communityFeedMaxW: js.includes('max-w-[680px]'),
    duplicateProfileHelpers: js.includes('uu(') && js.includes('Fz('),
    canonicalProfileHelper: js.includes('getCanonicalUserProfile'),
    // Prompt 07 ships inline helpers (not exported name getCanonicalUserProfile)
    canonicalByAuthIdQuery: /UserProfile\.filter\(\{created_by_id:/.test(js),
    profileRowsFilterHelper: js.includes('function yse('),
    canonicalPickUsesAuthUser: /function uu\(/.test(js) && js.includes('created_by_id'),
  },
  pages: {
    UserProfile: { maxW: maxWs(up), tabKeys },
    Community: { maxW: maxWs(snippet('max-w-[680px]')), feedColumn: 'max-w-[680px]' },
    CreateCoachProfile: { maxW: maxWs(snippet('CreateCoachProfile')) },
    MyFollows: { maxW: maxWs(snippet('MyFollows')) },
  },
};

console.log(JSON.stringify(report, null, 2));
