# QA Exploration — Airon Coach prod

**Data:** 2026-06-24  
**Środowisko:** https://airon.coach  
**Konta testowe:** `lokistastream@gmail.com`, `lokistakontakt@gmail.com`  
**Metoda:** Playwright (logged-in), tworzenie profilu coacha, przechodzenie flow, monitoring API  
**Screenshoty:** `test-results/coach-explore/` (gitignored)

---

## Executive summary

**Bloker #1:** Na obu kontach testowych **niemożliwe jest utworzenie profilu coacha** — system próbuje zaktualizować cudzy rekord `UserProfile` (`698867e38ffb4566bd59e048` = **mkpiwecki**) → **403 Permission denied**. To samo psuje **My Profile** (pokazuje mkpiwecki zamiast zalogowanego usera).

Dopóki prompt **07** (canonical profile) nie zostanie naprawiony, **cały coach funnel jest zablokowany** na tych kontach: Hub, Services, oferty, lifecycle.

| Priorytet | Liczba | Status |
|-----------|--------|--------|
| **P0** | 6 | Blokują coach onboarding + zły profil |
| **P1** | 5 | UX / layout / API |
| **P2** | 6 | Polish, martwe deploye, brak lifecycle |
| **INFO** | 2 | Działa częściowo |

---

## P0 — Blokery (naprawa przed wszystkim innym)

### BUG-P0-01 — Canonical profile wskazuje na **mkpiwecki** (oba konta)

| | |
|---|---|
| **Objaw** | Menu → My Profile → profil **mkpiwecki**, nie lokistastream / lokistakontakt |
| **URL** | `/UserProfile?id=698867e38ffb4566bd59e048` |
| **Konta** | Potwierdzone na **lokistastream** i **lokistakontakt** |
| **Root cause** | `uu()` / `Fz()` wybiera zły wiersz UserProfile z wielu `created_by` rows |
| **Prompt** | `prompts/base44-prompt-07-duplicate-profile-fix.txt` |
| **Evidence** | `28-my-profile.png`, `02-my-profile-before-coach.png` |

---

### BUG-P0-02 — Create coach profile: **403 Permission denied**

| | |
|---|---|
| **Objaw** | Toast/komunikat: `Save failed: Permission denied for update operation on UserProfile entity` |
| **API** | `PUT/PATCH .../entities/UserProfile/698867e38ffb4566bd59e048` → **403** |
| **Ścieżki** | `/CreateCoachProfile` (pełny formularz) **oraz** Settings → Coach Profile → „Create public coach profile" |
| **Konsekwencja** | Profil coacha **nigdy się nie zapisuje**; progress bar skacze (50% → 40% → 10% po reload) |
| **Powiązanie** | Ten sam zły `profile.id` co BUG-P0-01 — próba UPDATE cudzego rekordu |
| **Prompt** | **07** (must-fix), potem **05/08** |
| **Evidence** | `21-after-save-attempt.png`, `40-settings-create-coach.png` |

**Wniosek:** To nie jest osobny bug uprawnień — to **konsekwencja złego canonical ID**.

---

### BUG-P0-03 — Coach Hub / Services zablokowane po „prawie-udanym" save

| | |
|---|---|
| **Objaw** | `/CoachBusinessHub` i `/CoachServices` → „Create a coach profile first" |
| **Przyczyna** | Save fail (BUG-P0-02) — capability coach nigdy nie aktywowana |
| **Evidence** | `07-coach-business-hub.png`, `22-hub.png`, `22-services.png` |

*Nie testowano getCoachStats 404 — brak coacha na koncie po udanym save.*

---

### BUG-P0-04 — Public coach: tab **Coach ostatni**, default **Overview**

| | |
|---|---|
| **Objaw** | Sebastian Test Coach: taby `Overview | Activity | Coach`, aktywny Overview |
| **Oczekiwane** | `Coach | Overview | Activity`, default `coach` |
| **Prompt** | `prompts/base44-prompt-08-coach-ui-audit.txt` (Część A) |
| **Evidence** | `36-public-coach.png`, `PublicCoach-Marek-default.png` |

---

### BUG-P0-05 — Menu: **Online flyout niewidoczny**

| | |
|---|---|
| **Objaw** | Hover na „Online" w menu profilowym — brak panelu Away/Busy/Offline |
| **Konta** | lokistastream, lokistakontakt |
| **Prompt** | `prompts/base44-prompt-04-menu-profile-hub.txt` |
| **Evidence** | `38-online-hover.png`, `15-online-hover.png` |

---

### BUG-P0-06 — Coach create: specjalizacje znikają po drugim save

| | |
|---|---|
| **Objaw** | Po pierwszym save z wybranymi chipami (strength, nutrition…) → drugi submit: `Select at least one specialty` mimo ponownego klikania |
| **Obszar** | `/CreateCoachProfile` — stan formularza / walidacja |
| **Evidence** | `coach-create-result.json` (afterSave2) |

---

## P1 — Ważne (po P0)

### BUG-P1-01 — `Settings?tab=coach` **ignoruje query param**

| | |
|---|---|
| **Objaw** | URL `/Settings?tab=coach` ładuje zakładkę **Account** (Fitness Goal, Sports), nie Coach |
| **Fix** | Deep link + router sync; klik „Coach Profile" w sub-nav działa → `#coach` |
| **Evidence** | `coach-create-result.json` (settingsCoach) |

---

### BUG-P1-02 — Community Feed: wąska kolumna **47%** + Quick Actions rail

| | |
|---|---|
| **Objaw** | `max-w-[680px]` feed + prawy rail (Quick Actions, Suggested Coaches) |
| **Metryka** | 680/1440 = **47%** szerokości contentu |
| **Prompt** | `08` Część C/D1 |
| **Evidence** | `32-community.png`, `Community.png` |

---

### BUG-P1-03 — API **429 Rate limit** przy nawigacji

| | |
|---|---|
| **Objaw** | Burst zapytań `UserProfile?created_by=email` (limit 1, 50…) → `Rate limit exceeded` |
| **Konsekwencja** | `Failed to load profile (attempt 1/2)` w konsoli; niestabilne ładowanie |
| **Fix** | Jeden canonical fetch + cache; debounce; nie pollować 50 rows |
| **Evidence** | `explore-report.json` networkFails |

---

### BUG-P1-04 — **MyFollows** — pusta / loading shell

| | |
|---|---|
| **Objaw** | `/MyFollows` → „Loading…" lub prawie pusty ekran |
| **Oczekiwane** | Redirect do `UserProfile?tab=follows` |
| **Evidence** | `34-myfollows.png`, `16-my-follows.png` |

---

### BUG-P1-05 — Menu: **chevron na My Profile** bez submenu

| | |
|---|---|
| **Objaw** | Wiersz My Profile sugeruje flyout, ale to zwykła nawigacja |
| **Prompt** | `04` |
| **Evidence** | `13-menu-after-coach.png` |

---

## P2 — Polish / średni priorytet

| ID | Obszar | Problem |
|----|--------|---------|
| P2-01 | Settings/Coach | Brak pause / deactivate / reactivate coach (prompt 06) |
| P2-02 | API | `classifyConversationTier` → **404** Deployment does not exist |
| P2-03 | API | `getWorkoutsWithSets` → **500** (Home dashboard) |
| P2-04 | Community | Composer + Quick Actions = redundantne entry pointy (częściowo fixed Task 4 — composer zostaje, rail też) |
| P2-05 | CreateCoachProfile | Dwa entry pointy: pełna strona `/CreateCoachProfile` vs uproszczony Settings → Coach Profile — niespójność UX |
| P2-06 | `/Teams` | Bezpośrednia nawigacja → login wall (sesja nie trzyma się na tej trasie) |

---

## Co udało się przetestować vs nie

### ✅ Przetestowane

- Login email/password (oba konta)
- Home, menu profilowe, My Profile
- CreateCoachProfile (wypełnienie + save — **fail**)
- Settings → Coach Profile (minimal create — **fail**)
- CoachBusinessHub, CoachServices (gate)
- Community (Feed, Teams, Messages, People)
- CoachDirectory + publiczny profil coacha
- Settings (Account, Coach Profile sub-nav)
- Messages, Trainees, MyFollows
- Monitoring API (403, 404, 429, 500)

### ❌ Nie udało się (zablokowane przez P0-02)

- Coach Hub dashboard (getCoachStats, KPI)
- Coach Services — tworzenie ofert, Edit, **Archive/Delete**
- Własny profil coacha — tab Coach, wizytówka
- Coach lifecycle (pause/deactivate)
- Widoczność w Coach Directory po utworzeniu profilu
- Menu: Coach Hub po aktywacji coacha

---

## Limity / obserwacje produktowe

1. **Walidacja CreateCoachProfile:**
   - Bio min 30 znaków (komunikat błędu OK)
   - Checklist sugeruje bio **100+** chars, cert, city, testimonial, availability
   - Specjalizacja: min 1 chip
   - Progress % zmienia się niespójnie po failed save

2. **Dwa flow aktywacji coacha:**
   - **A)** `/CreateCoachProfile` — długi formularz (identity, offer, visibility)
   - **B)** Settings → Coach Profile — tylko „Public coach name" + jeden przycisk  
   Oba kończą się **403** na tym samym entity ID.

3. **Trainee Profile** w Settings — copy OK (nie „Athlete").

4. **Rate limit** — agresywne zapytania UserProfile; przy QA widać po ~10–15 nawigacjach w krótkim czasie.

---

## Kolejność naprawy (rekomendacja)

```
1. P0-01 + P0-02  →  prompt 07 (canonical profile + merge duplikatów)
2. P0-03          →  prompt 05 (getCoachStats — retest po działającym coachu)
3. P0-04, P1-02   →  prompt 08 (wizytówka + layout + Services delete)
4. P0-05, P1-05   →  prompt 04 (menu flyout + chevrony)
5. P2-01          →  prompt 06 (lifecycle)
6. P2-02, P2-03   →  deploy martwych funkcji Base44
```

Po fixie **07** — **powtórzyć** na tym samym koncie:
```bash
USER_NAME=... USER_PASS=... npx tsx e2e/password-login-setup.ts --slot=pro
node scripts/coach-create-probe.mjs
node scripts/qa-sweep.mjs
```

---

## Narzędzia w repo

| Skrypt | Cel |
|--------|-----|
| `scripts/coach-explore.mjs` | Pełna eksploracja + lista bugów |
| `scripts/coach-create-probe.mjs` | Wypełnienie i save coach profile + probe Hub/Services |
| `scripts/qa-sweep.mjs` | Szybki sweep tras + API |
| `scripts/ui-audit-logged-in.mjs` | Screenshoty + metryki viewport |

---

## Mapowanie na prompty

| Bugi | Plik promptu |
|------|----------------|
| P0-01, P0-02, P0-06 | `base44-prompt-07-duplicate-profile-fix.txt` |
| P0-03 | `base44-prompt-05-coach-hub-getCoachStats.txt` |
| P0-04, P1-02, Services | `base44-prompt-08-coach-ui-audit.txt` |
| P0-05, P1-05 | `base44-prompt-04-menu-profile-hub.txt` |
| P2-01 | `base44-prompt-06-coach-lifecycle-deactivate.txt` |

---

*Wygenerowano przez agenta QA na prod. Następny krok: fix P0 w Base44, potem retest coach funnel.*
