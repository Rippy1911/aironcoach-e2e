# Base44 Fix Runbook — Airon Coach

**Last verified:** 2026-06-25 03:50 UTC  
**Prod:** https://airon.coach  
**Test accounts:** `lokistakontakt@gmail.com`, `lokistastream@gmail.com`  
**Current bundle:** `assets/index-CxFQPeji.js`

---

## Current state

**Prompt 07 (duplicate profile / canonical UserProfile) is deployed and verified on prod.**

| Check | Result |
|-------|--------|
| Anonymous smoke | PASS |
| Bundle: `canonicalByAuthIdQuery` | **true** — `UserProfile.filter({ created_by_id: auth.id })` |
| Bundle: `profileRowsFilterHelper` (`yse`) | **true** |
| Bundle: `canonicalPickUsesAuthUser` (`uu`) | **true** |
| Bundle: `coachTabLast` | **false** — Coach tab is first |
| Bundle: `archiveOfferLabel` | **true** |
| My Profile (`lokistakontakt`) | Opens **Loki Stream** at `UserProfile?id=6a3ca50c65a59273f399090e` |
| Create coach profile | **PASS** — redirects to `CoachBusinessHub` |
| Coach Hub / Services | **Unlocked** — coach dashboard + Services page load |

Implementation note: AironCoach ships the fix as inline helpers `yse()` + `uu(user)` — not the exported name `getCanonicalUserProfile` from the prompt spec. That is fine; behavior matters.

**Do not paste prompt 09** unless canonical profile regresses. It was a corrective draft written before this deploy landed.

---

## Prompt order

### ~~Stage 1 — P0 canonical profile~~ DONE

**Prompt:** `prompts/base44-prompt-07-duplicate-profile-fix.txt` (deployed)

**Verified by:**

```bash
TEST_PRO_EMAIL=lokistakontakt@gmail.com node scripts/coach-create-probe.mjs
```

---

### Stage 2 — Coach Hub stats / not-coach false state

**Prompt:** `prompts/base44-prompt-10-coach-hub-stats-after-canonical.txt`

**Goal:** after successful coach create, `/CoachBusinessHub` shows dashboard and `getCoachStats` returns 200. API failure must not render “not a coach”.

**Acceptance:**
- New coach profile redirects to Hub.
- `getCoachStats` returns 200 for authenticated coach.
- API down state says “Couldn’t load coach dashboard” + Retry, not “You’re not a coach”.
- Refresh `/CoachBusinessHub` still shows dashboard.

**Retest:**

```bash
TEST_PRO_EMAIL=... node scripts/coach-create-probe.mjs
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
```

---

### Stage 3 — Coach profile + Services + layout

**Prompt:** `prompts/base44-prompt-11-coach-card-services-layout.txt`

**Goal:** coach profile becomes a public card (“wizytówka”); Services gets Archive/Delete; layout uses width properly.

**Acceptance:**
- Public coach profile defaults to `Coach` tab.
- Tab order: `Coach | Overview | Activity` (plus Follows/Stats for self).
- Services offer cards include Archive/Restore and no longer hide in a single narrow column.
- Community feed/layout no longer wastes half the screen.

**Retest:**

```bash
node scripts/ui-audit-prod.mjs
TEST_PRO_EMAIL=... node scripts/ui-audit-logged-in.mjs
TEST_PRO_EMAIL=... node scripts/coach-create-probe.mjs
```

---

### Stage 4 — Profile menu

**Prompt:** `prompts/base44-prompt-12-profile-menu-flyout-chevrons.txt`

**Goal:** Online flyout visible; direct navigation rows have no chevrons.

**Acceptance:**
- Hover Online shows Away/Busy/Offline panel.
- My Profile / Coach Hub / Settings have no submenu chevron.
- My Profile routes to canonical self profile.

**Retest:**

```bash
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
```

---

### Stage 5 — Coach lifecycle

**Prompt:** `prompts/base44-prompt-13-coach-lifecycle-v2.txt`

**Goal:** pause/deactivate/reactivate/delete public coach capability while keeping the same account.

**Acceptance:**
- Pause = visibility/accepting clients only.
- Deactivate = `is_coach=false`, `coach_status=inactive`, data retained.
- Reactivate restores coach capability.
- Delete public coach data does not delete the account.

---

## Known residuals to track

| Area | Issue |
|------|-------|
| Menu | Online flyout not visible on hover (P0 in qa-sweep) |
| API | `classifyConversationTier` 404 deployment missing |
| API | occasional `getWorkoutsWithSets` 500 on Home |
| API | entity query bursts can hit 429 rate limit |
| Settings | `?tab=coach` query param ignored (click Coach Profile sub-nav works) |
| MyFollows | orphan/loading shell; should redirect to profile follows tab |
| Teams | direct route can hit login wall in one session |
| Layout | Community feed still `max-w-[680px]` (~47% width) |

---

## Files to keep open while prompting

- `docs/base44-handoff.md`
- `docs/qa-exploration-2026-06-24.md`
- `docs/ui-audit-2026-06-24.md`
- `prompts/base44-prompt-10-coach-hub-stats-after-canonical.txt`
- `prompts/base44-prompt-11-coach-card-services-layout.txt`
- `prompts/base44-prompt-12-profile-menu-flyout-chevrons.txt`
- `prompts/base44-prompt-13-coach-lifecycle-v2.txt`

Historical: `prompts/base44-prompt-07...08...` and superseded `09`. Use **10 → 13** for next Base44 work.

---

## Operator checklist before every next prompt

1. Confirm latest prod publish is live (`curl -s https://airon.coach/ | grep index-`).
2. Re-run the stage-specific retest command.
3. If canonical profile (Stage 1) regresses, stop and re-run prompt 07 fixes — do not paste layout prompts.
4. Keep unified account rule: coach is a capability, not a mode or separate account.
5. Require Base44 final report: reproduced, changed files, before/after behavior, verification checklist.
