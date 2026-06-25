# Base44 / Airon Coach — handoff dokument

> **Wklej do nowego czatu** gdy skończy się kontekst.  
> **App prod:** https://airon.coach  
> **Repo E2E:** aironcoach-e2e (Playwright only)  
> **Konto testowe:** xrivosx@gmail.com

---

## Architektura (nie zmieniać)

- Jedno konto — **bez** Coach/Athlete/Profile mode switchera
- Coach = capability (Coach Hub widoczny tylko gdy capability)
- Trainee zamiast Athlete w copy
- Community/Messages/Teams dostępne wszystkim

Reguły: `.cursor/rules/coachapp.mdc`

---

## Stan na dziś (2026-06-24, po Task 4 / prompt 03)

### ✅ Działa na prod

| Feature | Status |
|---------|--------|
| Referral `/join` + `?ref__=` | ✅ |
| redeemReferralCode / ensureReferralCode | ✅ |
| Brak fałszywego sukcesu referral | ✅ |
| Menu: klikalny header, My Profile, View my profile | ✅ |
| PresenceFlyout komponent w kodzie | ✅ (flyout **nie widać** — bug overflow) |
| Inline composer Feed | ✅ |
| Streak opt-in + streak_tier_public | ✅ |
| getMyFollows bulkUpdate (fix 500) | ✅ |
| **P0 Feed anti-duplikacja** (Task 4) | ✅ wdrożone w kodzie — user weryfikuje po publish |
| Community header bez subtitle ~90px | ✅ (Task 4 partial P2) |

### ❌ Nadal źle / brakuje

| Problem | Priorytet |
|---------|-----------|
| **Online hover — brak flyout z boku** (overflow popover?) | **P0-B** |
| **My Profile, Coach Hub mają chevron `>` bez submenu** — mylące | **P0-B** |
| Profile Hub (taby Overview/Activity/Follows/Stats/Coach) | P1 |
| `/MyFollows` → profil?tab=follows | P1 |
| Follows & followers w menu → nadal `/MyFollows` | P1 |
| Community content-start spójność, Invite card | P2 |
| Referral E2E nowe konto | P3 |
| Screenshoty zalogowanej sesji | P4 |

---

## Task 4 — Base44 feedback (prompt 03)

**Zrobione:**
- `CommunityHeaderCTA` — feed key usunięty → brak header CTA na Feed
- `FeedDiscoveryRail` — usunięte „Create a post" + „Share a coaching post"
- `ComposeFAB` — ukryty na Feed desktop, mobile zostaje
- `CommunityShell` — subtitle usunięty, header ~90px
- Anti-duplikacja: Feed 3→1 entry point create post

**Odłożone:**
- P1 Profile Hub
- P3 Referral E2E
- P4 screenshoty (login wall w preview tool)

---

## Task 4 — Feedback użytkownika (NOWY BUG UX menu)

Screenshot menu profilowego (damm ian, coach):

1. **Online** — ma chevron `>`, ale **hover nie pokazuje panelu statusu z boku** (Away/Busy/Offline). Kod `PresenceFlyout` istnieje (`left:100%`, z-index 100000) — prawdopodobnie **parent popover ma `overflow:hidden`** i obcina flyout.

2. **My Profile** — ma chevron `>`, ale to **zwykła nawigacja** (onClick → profil), nie submenu. Chevron myli — sugeruje rozwijanie, którego nie ma.

3. **Coach Hub** — to samo: chevron `>` + onClick navigate, **bez flyout**.

4. **Follows & followers** — bez chevron, OK — ale linkuje do `/MyFollows` (orphan), powinno iść do profil?tab=follows po P1.

**Reguła chevronów (do promptów):**
```
chevron (>) TYLKO na wierszach z realnym flyout/submenu (Online status).
Bez chevron: My Profile, Coach Hub, Follows, Settings, Manage plan — direct navigation.
```

**Fix Online flyout:**
- Popover container: `overflow: visible`
- Flyout: render przez Portal do document.body LUB position fixed z coords z anchor
- Upewnij się że flyout nie jest clipped przez sidebar
- Screenshot: hover Online → panel po prawej z 4 statusami

---

## Pliki kluczowe

**Menu:** `ProfileModeMenu` / `SidebarProfilePopover`, `PresenceFlyout`, `MenuRow`/`Ql` component  
**Profil:** `pages/UserProfile.jsx`, `pages/MyFollows.jsx`  
**Community:** `Community.jsx`, `CommunityShell.jsx`, `CommunityHeaderCTA.jsx`, `FeedTab.jsx`, `FeedDiscoveryRail.jsx`, `ComposeFAB.jsx`  
**Streak:** `StreakBadge.jsx`, `lib/streak.js`, `AchievementsSettings.jsx`  
**Referral:** `pendingReferral.js`, `JoinReferral.jsx`, `ReferralAutoApply.jsx`

---

## Prompty w repo

| Plik | Kiedy użyć |
|------|------------|
| `docs/base44-handoff.md` | Ten plik — kontekst |
| `prompts/base44-prompt-05-coach-hub-getCoachStats.txt` | Coach Hub getCoachStats 404 |
| `prompts/base44-prompt-08-coach-ui-audit.txt` | **Coach wizytówka + Services delete + UI audyt** (bez Home/Training) |
| `prompts/base44-prompt-07-duplicate-profile-fix.txt` | Duplicate UserProfile / zły profil |
| `prompts/base44-prompt-06-coach-lifecycle-deactivate.txt` | Coach lifecycle — pause / deactivate / reactivate |
| `prompts/base44-prompt-05-coach-hub-getCoachStats.txt` | Coach Hub getCoachStats 404 |
| `prompts/base44-prompt-04-menu-profile-hub.txt` | Menu flyout + Profile Hub |

---

## Model coach capability (decyzja produktowa 2026-06-24)

- **Jedno konto** — coach to capability, nie osobny profil/mode
- **Poziom 1 Pauza:** accepting_clients + coach_profile_visibility (soft)
- **Poziom 2 Dezaktywacja:** is_coach false, coach_status inactive, dane zachowane, reactivate możliwy
- **Poziom 3 Delete:** trwałe usunięcie danych coach public (account zostaje)
- **NIE:** „switch to user account", profile mode switcher
- **Dziś w prod:** brak deactivate/remove coach flow (tylko visibility toggles)

Prompt: `prompts/base44-prompt-06-coach-lifecycle-deactivate.txt`

---

## Priorytety następny task

0. **P0-PROFILE** — `prompts/base44-prompt-09-canonical-profile-hotfix.txt` — **NAJPIERW, blokuje wszystko**
1. **P0-COACH** — `prompts/base44-prompt-10-coach-hub-stats-after-canonical.txt` — dopiero po zielonym retest prompt 09
2. **P0-UI** — `prompts/base44-prompt-11-coach-card-services-layout.txt`
3. **P0-MENU** — `prompts/base44-prompt-12-profile-menu-flyout-chevrons.txt`
4. **P1-LIFECYCLE** — `prompts/base44-prompt-13-coach-lifecycle-v2.txt`
5. **P2** — Community dokończenie, MyFollows redirect, screenshoty

---

## Mini-handoff (wklejka 10 linii)

```
Prod: airon.coach. Unified account, no profile mode.
P0 BLOCKER: My Profile and coach create resolve to wrong UserProfile id=698867e38ffb4566bd59e048 (mkpiwecki) on lokistakontakt/lokistastream.
Coach create via /CreateCoachProfile and Settings#coach → 403 Permission denied updating that wrong row.
Next prompt MUST be prompts/base44-prompt-09-canonical-profile-hotfix.txt. Do not start 10/11 until 09 retest passes.
Retest: node scripts/coach-create-probe.mjs && node scripts/qa-sweep.mjs.
Runbook: docs/base44-fix-runbook.md
```

---

## P0 BUG — Coach Hub po utworzeniu profilu coacha (2026-06-24)

### Symptom
Save coach profile → toast „Coach profile created" → redirect `/CoachBusinessHub` → **„You're not a coach yet"**. Sidebar pokazuje COACH badge (profil zapisany).

### Root cause (potwierdzone testem prod)
```
POST https://airon.coach/functions/getCoachStats
→ "Deployment does not exist"
```
Ten sam wzorzec co `redeemReferralCode` (martwy deployment / lokalny import `../_lib/withRetry.js`).

### Logika frontend (dlaczego UI kłamie)
`CoachBusinessHub` (`KDe`):
1. Gate 1: `Vy(profile)` = `!!coach_business_name` → user przechodzi po save ✅
2. Gate 2: `getCoachStats()` → **404** → UI pokazuje `notCoach` empty state ❌

API error jest myląco mapowany na „nie jesteś coachem".

### Fix
- Backend: napraw/deploy `getCoachStats` (inline withRetry)
- Frontend: error state + Retry, NIE „not a coach" przy API fail
- Po save: invalidate `myProfile` + `coachStats` przed redirect
- Bonus: sidebar Home + Coach Hub oba active

**Prompt:** `prompts/base44-prompt-05-coach-hub-getCoachStats.txt`

---

## P0 BUG — Duplicate UserProfile rows (2026-06-24)

### Symptom
Po zapisie profilu coacha user widzi **inny profil** niż edytował (np. Marek Nowak). Wiele kont testowych na prod.

### Root cause (analiza bundle)
- `UserProfile.filter({ created_by: email }, limit 50)` — **wiele wierszy na jeden email**
- `uu()` wybiera profil przez **Fz() scoring** który faworyzuje coach (+1M pkt) → bierze „najbardziej coach" wiersz, niekoniecznie właściwy
- `CreateCoachProfile` + `CreateUserProfile` oba: `uu()` → update LUB create — mogą tworzyć duplikaty
- `bRe()` ma status `ambiguous` przy wielu coach rows — problem znany w kodzie, nieobsłużony w UI
- My Profile → `/UserProfile?id=${canonicalProfile.id}` — jeśli canonical źle wybrany, widać zły profil

### Fix — **WDROŻONE NA PROD (2026-06-25)**

Bundle `assets/index-CxFQPeji.js`:
- `UserProfile.filter({ created_by_id: auth.id })` w `useMyProfile` / coach save
- `yse()` filtruje wiersze po `created_by_id`, potem email (bez service rows)
- `uu(rows, authUser)` — tie-break po `created_date`, nie `Fz()` coach score dla self-profile
- Eksportowana nazwa `getCanonicalUserProfile` **nie występuje** — logika jest inline; to OK

**Prompt:** `prompts/base44-prompt-07-duplicate-profile-fix.txt` — **DONE**

Weryfikacja: `node scripts/coach-create-probe.mjs` → My Profile = Loki Stream, Hub/Services odblokowane.

### Fix (oryginalna spec)
1. Jeden UserProfile per user (merge duplikatów)
2. Zastąpić `uu()`/`Fz()` dla my profile → canonical by `created_by_id` (shipped as `yse`/`uu`)
3. Coach save na tym samym wierszu co personal
4. My Profile zawsze self canonical id

---

## Feedback UX coach profile + Services (2026-06-24)

- Tab **Coach** jest ostatni (Overview/Activity pierwsze) — powinien być **pierwszy i default** (wizytówka)
- Services: brak przycisku **Usuń/Archive** na ofertach (backend ma `archived`, UI nie)
- Ogólnie: ekrany max-w-2xl, ~50% pustego ekranu po prawej — audyt UI wszystkich stron **oprócz Home/Training**

Prompt: `prompts/base44-prompt-08-coach-ui-audit.txt`

---

## UI Audit (agent, 2026-06-24)

Pełny raport: **`docs/ui-audit-2026-06-24.md`**  
**QA exploration (logged-in, coach create):** **`docs/qa-exploration-2026-06-24.md`**
**Pełny status deployu promptów 09–13:** **`docs/prod-deploy-status-2026-06-25.md`**

```bash
node scripts/prompt-deploy-audit.mjs   # allDeployed: true (2026-06-25)
```

**Prompt runbook:** **`docs/base44-fix-runbook.md`**

Narzędzia:
```bash
node scripts/ui-audit-prod.mjs
node scripts/ui-audit-viewport.mjs
node scripts/ui-audit-logged-in.mjs
node scripts/coach-create-probe.mjs   # wypełnia + zapisuje coach profile
node scripts/qa-sweep.mjs
```

**Status promptów Base44:** **07 + 09–13 wdrożone na prod** (bundle `index-CxFQPeji.js`). Nie wklejaj ponownie bez regresji.

**Rerun 2026-06-25:** `prompt-deploy-audit` → allDeployed; Community/Hub ~86% szerokości; coach lifecycle + presence w bundle; qa-sweep bez mkpiwecki/flyout false positives.

---

## Ostatnia aktualizacja

2026-06-25 — prompty 07 + 09–13 potwierdzone na prod; nowy skrypt `prompt-deploy-audit.mjs`.
