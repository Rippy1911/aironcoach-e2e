# Base44 — faza 2 (prompty 14–19)

**Dla Opus 4.8:** wklej jednym razem → `prompts/base44-opus-phase2-14-19.txt`  
**Po jednym:** `prompts/base44-prompt-14` … `19` (krótkie, ~15 linii każdy)

Faza 1 (07 + 09–13): DONE. Nie wklejaj ponownie.

## Kolejność

| # | Plik | Co |
|---|------|-----|
| 14 | API 429, dead functions | |
| 15 | Settings tab, MyFollows, auth routes | |
| 16 | Community feed width | |
| 17 | Coach form + Services E2E | |
| 18 | Public coach default tab | |
| 19 | Delete coach data + Settings UX | |

## Retest po publish

```bash
npm run audit:deploy
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
TEST_PRO_EMAIL=... node scripts/ui-audit-logged-in.mjs
```
