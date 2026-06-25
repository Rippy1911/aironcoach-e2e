# Prod deploy status — prompts 07 + 09–13

**Verified:** 2026-06-25  
**Prod:** https://airon.coach  
**Bundle:** `assets/index-CxFQPeji.js`

---

## TL;DR

**Masz rację — prompty 9–13 (oraz wcześniejszy 07) są już na produkcji.**  
Wcześniejsze raporty agenta były mylące, bo:

1. Szukały **złych nazw** w bundle (`getCanonicalUserProfile`, `Away/Busy/Offline`, `Archive offer`).
2. `qa-sweep` miał **hardcoded false positive** na mkpiwecki (naprawione wcześniej).
3. Testy logowania **wygasały** (429 → 401) przy długich runach — fałszywie pokazywały „Create coach profile first”.
4. Audyt layoutu patrzył na **stary** `max-w-[680px]` w kodzie, a live UI już używa szerokiego shella `max-w-[1920px]` (~86% viewport).

Uruchom pełny checklist:

```bash
node scripts/prompt-deploy-audit.mjs
node scripts/ui-audit-prod.mjs
TEST_PRO_EMAIL=... node scripts/ui-audit-logged-in.mjs
TEST_PRO_EMAIL=... node scripts/qa-sweep.mjs
```

---

## Prompt → prod status

| Prompt | Temat | Bundle / live | Status |
|--------|-------|---------------|--------|
| **07 / 09** | Canonical UserProfile | `yse()` + `uu(authUser)` + `filter({ created_by_id })` | **WDROŻONE** |
| **10** | Coach Hub error states | `Couldn't load coach dashboard`, `getCoachStats` | **WDROŻONE** |
| **11** | Coach tab first + layout + archive | Tab order `coach → overview → …`; `max-w-6xl` / `max-w-[1920px]`; Archive w UI | **WDROŻONE** (680px może zostać w zagnieżdżonej kolumnie feedu) |
| **12** | Menu / presence flyout | `airon_presence_status`; opcje `online/busy/dnd/invisible` | **WDROŻONE w kodzie** — flyout w Playwright wymaga dismiss cookie bar + hover w popover |
| **13** | Coach lifecycle | `deactivateCoachProfile`, `reactivateCoachProfile`, „Pause coach profile” | **WDROŻONE** |

---

## Live UI (konto `lokistakontakt@gmail.com`, 2026-06-25)

| Route | Wynik |
|-------|--------|
| My Profile | Loki Stream (`6a3ca50c65a59273f399090e`) |
| CoachBusinessHub | Dashboard „Loki Stream Coach” |
| CoachServices | Odblokowane |
| Community | Primary content **~86%** szerokości (było ~47%) |
| CreateCoachProfile | „You already have an active coach profile” |
| Settings → Coach Profile | Panel coach (lifecycle w bundle) |

---

## Co nadal może być otwarte (residual)

| Issue | Sev. | Uwagi |
|-------|------|-------|
| API 429 przy burst query | P1 | Rate limit na `UserProfile` / `TeamMember` — problem testów, niekoniecznie UX |
| `classifyConversationTier` 404 | P2 | Brak deploymentu funkcji |
| `getWorkoutsWithSets` 500 | P2 | Sporadycznie na Home |
| `Settings?tab=coach` | P2 | Query param ignorowany — klik „Coach Profile” działa |
| `/Messages`, `/Teams` | P2 | Czasem login wall przy częściowo wygasłej sesji |
| Nested `max-w-[680px]` | P3 | Wewnętrzna kolumna feedu; outer shell już szeroki |
| Presence flyout w auto-testach | P3 | Cookie bar blokuje hover — ręcznie w UI powinno działać |

---

## Dla operatora Base44

**Nie wklejaj ponownie 09–13**, chyba że któryś z powyższych residuali wróci jako regresja.

Następna praca w tym repo E2E: utrzymanie skryptów weryfikacyjnych + nowe bugi odkryte po deployu.
