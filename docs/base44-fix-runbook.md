# Base44 Fix Runbook — Airon Coach

**Last verified:** 2026-06-25 02:56 UTC  
**Prod:** https://airon.coach  
**Test accounts:** `lokistakontakt@gmail.com`, `lokistastream@gmail.com`  
**Current bundle:** `assets/index-BX4KRVl9.js`

---

## Current state

The previous audit work is directionally correct. Fresh rerun confirms the same main blocker:

| Check | Result |
|-------|--------|
| Anonymous smoke | PASS |
| Bundle: `canonicalProfileHelper` | **false** |
| Bundle: `coachTabLast` | **true** |
| Bundle: `archiveOfferLabel` | **false** |
| My Profile on test accounts | Opens **mkpiwecki** |
| Create coach profile | **403** updating `UserProfile/698867e38ffb4566bd59e048` |
| Coach Hub / Services | Still gated, because coach profile cannot be created |

**Important:** do not start layout/Services work until prompt 09 is fixed and retested. The coach funnel is blocked at canonical profile selection.

---

## Prompt order

### Stage 1 — P0 canonical profile

**Prompt:** `prompts/base44-prompt-09-canonical-profile-hotfix.txt`

**Goal:** one canonical `UserProfile` per auth user; My Profile and coach save use the logged-in user’s row, not `mkpiwecki`.

**Stop conditions:**
- If Base44 proposes a profile mode switcher, reject it.
- If Base44 creates a separate `CoachProfile` entity instead of using coach fields on `UserProfile`, reject it.
- If it preserves `Fz()` coach scoring for “my profile”, reject it.

**Acceptance:**
- `lokistakontakt` My Profile is not `mkpiwecki`.
- `lokistastream` My Profile is not `mkpiwecki`.
- `/CreateCoachProfile` save no longer calls `UserProfile/698867e38ffb4566bd59e048` for these users.
- Coach fields save on the same canonical row.

**Retest:**

```bash
USER_NAME=... USER_PASS=... TEST_PRO_EMAIL=... npx tsx e2e/password-login-setup.ts --slot=pro
TEST_PRO_EMAIL=... node scripts/coach-create-probe.mjs
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
node scripts/ui-audit-prod.mjs
```

Do not move to Stage 2 until this passes.

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
| API | `classifyConversationTier` 404 deployment missing |
| API | occasional `getWorkoutsWithSets` 500 on Home |
| API | entity query bursts can hit 429 rate limit |
| MyFollows | orphan/loading shell; should redirect to profile follows tab |
| Teams | direct route can hit login wall in one session |

---

## Files to keep open while prompting

- `docs/base44-handoff.md`
- `docs/qa-exploration-2026-06-24.md`
- `docs/ui-audit-2026-06-24.md`
- `prompts/base44-prompt-09-canonical-profile-hotfix.txt`
- `prompts/base44-prompt-10-coach-hub-stats-after-canonical.txt`
- `prompts/base44-prompt-11-coach-card-services-layout.txt`
- `prompts/base44-prompt-12-profile-menu-flyout-chevrons.txt`
- `prompts/base44-prompt-13-coach-lifecycle-v2.txt`

Historical prompts remain in `prompts/base44-prompt-04...08...`, but use the 09-13 sequence for the next Base44 work.

---

## Operator checklist before every next prompt

1. Confirm latest prod publish is live.
2. Re-run the stage-specific retest command.
3. If a P0 from an earlier stage still fails, do not paste later prompts.
4. Keep unified account rule: coach is a capability, not a mode or separate account.
5. Require Base44 final report: reproduced, changed files, before/after behavior, verification checklist.
