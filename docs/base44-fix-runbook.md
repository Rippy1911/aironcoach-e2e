# Base44 Fix Runbook — Airon Coach

**Last verified:** 2026-06-25 04:02 UTC  
**Prod:** https://airon.coach  
**Bundle:** `assets/index-CxFQPeji.js`  
**Full status:** `docs/prod-deploy-status-2026-06-25.md`

---

## Current state

**Prompts 07 + 09–13 are deployed on prod.** Run:

```bash
node scripts/prompt-deploy-audit.mjs   # allDeployed: true
```

| Prompt | Status |
|--------|--------|
| 07 / 09 canonical profile | DONE |
| 10 Coach Hub error states | DONE |
| 11 Coach tab + layout + archive | DONE |
| 12 Presence menu (busy/dnd/invisible) | DONE in bundle |
| 13 Coach lifecycle | DONE |

Do **not** re-paste 09–13 unless a regression is confirmed.

---

## Residual issues (not prompt blockers)

| Area | Issue |
|------|-------|
| API | 429 rate limit on burst entity fetches |
| API | `classifyConversationTier` 404 |
| API | occasional `getWorkoutsWithSets` 500 |
| Settings | `?tab=coach` query ignored (sub-nav click works) |
| MyFollows | loading shell |
| Tests | long Playwright runs can expire session → false login walls |

---

## Verification commands

```bash
node scripts/prompt-deploy-audit.mjs
node scripts/ui-audit-prod.mjs
TEST_PRO_EMAIL=... node scripts/ui-audit-logged-in.mjs
TEST_PRO_EMAIL=... node scripts/coach-create-probe.mjs
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
```

---

## Historical prompt files

Kept for regression reference: `prompts/base44-prompt-07` through `13`.

For **new** Base44 work, file a fresh prompt from current prod gaps (residuals above), not the 09–13 sequence again.
