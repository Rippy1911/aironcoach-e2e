# Base44 Fix Runbook — Airon Coach

**Last verified:** 2026-06-25  
**Prod:** https://airon.coach  
**Phase 1 (prompts 07 + 09–13):** DONE — see `docs/prod-deploy-status-2026-06-25.md`  
**Phase 2 (prompts 14–19):** **USE NOW** — API, routing, UI polish, coach funnel E2E

---

## Phase 1 — completed

```bash
npm run audit:deploy   # allDeployed: true
```

Do not re-paste prompts 09–13 unless regression.

---

## Phase 2 — prompt order (paste to Base44 in sequence)

| Stage | Prompt file | Goal | Priority |
|-------|-------------|------|----------|
| **14** | `prompts/base44-prompt-14-api-reliability-query-storm.txt` | Stop 429 storm; deploy/fix `classifyConversationTier`, `getWorkoutsWithSets` | P1 |
| **15** | `prompts/base44-prompt-15-routing-deep-links-orphans.txt` | `Settings?tab=coach`, MyFollows redirect, Messages/Teams auth | P1 |
| **16** | `prompts/base44-prompt-16-community-layout-feed-v2.txt` | Feed column width, remove duplicate Quick Actions rail | P1 |
| **17** | `prompts/base44-prompt-17-coach-funnel-form-services-e2e.txt` | Specialty form bug, CreateCoachProfile layout, Services archive E2E | P1 |
| **18** | `prompts/base44-prompt-18-public-coach-card-default-tab.txt` | Public coach default Coach tab + card layout + directory links | P1 |
| **19** | `prompts/base44-prompt-19-coach-lifecycle-delete-settings-ux.txt` | Delete public coach data + Settings coach panel | P2 |

**Paste one prompt at a time.** Retest after each stage before the next.

---

## Stage 14 — API reliability

**Stop if:** coach save 403 returns or canonical profile regresses.

**Acceptance:**
- ≤2 UserProfile API calls on normal 5-route navigation
- No 429 burst in 30s smoke navigation
- `classifyConversationTier` not 404 OR caller guarded
- `getWorkoutsWithSets` not 500 on Home

```bash
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
```

---

## Stage 15 — Routing

**Acceptance:**
- `/Settings?tab=coach` cold load works
- `/MyFollows` → profile `?tab=follows`
- `/Messages`, `/Teams` load when logged in

```bash
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
```

---

## Stage 16 — Community layout

**Acceptance:**
- Feed primary column ≥60% at 1440px
- No duplicate Quick Actions rail on desktop Feed

```bash
TEST_PRO_EMAIL=... node scripts/ui-audit-logged-in.mjs
node scripts/ui-audit-prod.mjs
```

---

## Stage 17 — Coach funnel E2E

**Acceptance:**
- Specialties survive re-save on CreateCoachProfile
- Create + archive + restore one coaching offer

```bash
TEST_PRO_EMAIL=lokistakontakt@gmail.com node scripts/coach-create-probe.mjs
```

---

## Stage 18 — Public coach card

**Acceptance:**
- Directory link opens Coach tab by default
- Copy profile link includes `&tab=coach`

```bash
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
```

---

## Stage 19 — Lifecycle delete + Settings UX

**Acceptance:**
- Delete public coach data with typed `DELETE` (use disposable test coach)
- Settings coach panel consolidated

```bash
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
```

---

## Operator checklist

1. `curl -s https://airon.coach/ | grep index-` — note bundle hash after each publish
2. Run stage retest commands
3. If stage N fails, do not paste N+1
4. Require Base44 report: files changed, before/after, checklist

---

## Key docs

- `docs/base44-handoff.md`
- `docs/prod-deploy-status-2026-06-25.md`
- `docs/qa-exploration-2026-06-24.md`
- `docs/ui-audit-2026-06-24.md`
