/**
 * Maps Base44 prompts 07 + 09–13 to signals in the live prod JS bundle.
 * Usage: node scripts/prompt-deploy-audit.mjs [bundle-url]
 */
const DEFAULT = 'https://airon.coach/';

async function resolveBundleUrl() {
  if (process.argv[2]) return process.argv[2];
  const html = await fetch(DEFAULT).then((r) => r.text());
  const m = html.match(/assets\/index-[^"]+\.js/);
  return m ? `${DEFAULT.replace(/\/$/, '')}/${m[0]}` : null;
}

const bundleUrl = await resolveBundleUrl();
if (!bundleUrl) {
  console.error('Could not resolve bundle URL');
  process.exit(1);
}

const js = await fetch(bundleUrl).then((r) => r.text());

const up = js.slice(js.indexOf('is_public_coach'), js.indexOf('is_public_coach') + 1200);
const tabKeys = [...up.matchAll(/key:"(\w+)"/g)].map((m) => m[1]);

function has(re) {
  return re.test(js);
}

const prompts = {
  '07/09 canonical profile': {
    deployed:
      has(/UserProfile\.filter\(\{created_by_id:/) &&
      has(/function yse\(/) &&
      has(/function uu\(/),
    signals: {
      created_by_id_query: has(/UserProfile\.filter\(\{created_by_id:/),
      yse_filter: has(/function yse\(/),
      uu_pick: has(/function uu\(/),
      export_name_getCanonicalUserProfile: has(/getCanonicalUserProfile/),
    },
    note: 'Logic ships as yse/uu — export name optional',
  },
  '10 Coach Hub error states': {
    deployed: has(/Couldn't load coach dashboard/) && has(/getCoachStats/),
    signals: {
      loadError_copy: has(/Couldn't load coach dashboard/),
      getCoachStats: has(/getCoachStats/),
      notCoachEmpty_copy: has(/You're not a coach yet/),
    },
  },
  '11 Coach tab + layout + archive': {
    deployed:
      tabKeys[0] === 'coach' &&
      has(/max-w-6xl/) &&
      (has(/" Archive"/) || has(/Archive offer/i) || has(/visibility:"archived"/)),
    signals: {
      coach_tab_first: tabKeys[0] === 'coach',
      tab_order: tabKeys.join(' → '),
      max_w_6xl_shell: has(/max-w-6xl/),
      archive_action_in_ui: has(/" Archive"/) || has(/Archive offer/i),
      archived_visibility_label: has(/visibility:"archived"/) || has(/Archived — not visible/),
      legacy_feed_680px: has(/max-w-\[680px\]/),
    },
    note: '680px class may remain in nested feed column; outer shell widened to ~86% in live UI',
  },
  '12 Profile menu / presence': {
    deployed: has(/airon_presence_status/) && has(/Tk=\["online","busy","dnd","invisible"\]/),
    signals: {
      presence_status_key: has(/airon_presence_status/),
      presence_options: has(/"online","busy","dnd","invisible"/),
      legacy_away_busy_offline_labels: has(/Away/) || has(/"Busy"/),
    },
    note: 'App uses online/busy/dnd/invisible — not Away/Busy/Offline from old prompt copy',
  },
  '13 Coach lifecycle': {
    deployed:
      has(/deactivateCoachProfile/) &&
      has(/reactivateCoachProfile/) &&
      has(/Pause coach profile/),
    signals: {
      deactivate_fn: has(/deactivateCoachProfile/),
      reactivate_fn: has(/reactivateCoachProfile/),
      pause_label: has(/Pause coach profile/),
      deactivate_label: has(/Deactivate coach profile/),
      delete_public_coach_copy: has(/Delete public coach/),
    },
  },
};

const summary = {
  meta: { bundle: bundleUrl, bytes: js.length, auditedAt: new Date().toISOString() },
  prompts,
  allDeployed: Object.values(prompts).every((p) => p.deployed),
};

console.log(JSON.stringify(summary, null, 2));
