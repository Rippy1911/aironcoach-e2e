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
| `prompts/base44-prompt-05-coach-hub-getCoachStats.txt` | **P0 TERAZ** — Coach Hub po create profile |
| `prompts/base44-prompt-04-menu-profile-hub.txt` | Menu flyout + Profile Hub (po P0 coach) |

---

## Priorytety następny task

0. **P0-COACH** — getCoachStats 404 + Coach Hub empty state po create profile (**NOWY BUG**)
1. **P0-B** — napraw Online flyout + usuń fałszywe chevrony (My Profile, Coach Hub)
2. **P1** — Profile Hub kompletny + redirect MyFollows
3. **P2** — Community dokończenie (content-start, Invite card)
4. **P3** — Referral E2E / Testing Agent scenario
5. **P4** — Screenshoty

---

## Mini-handoff (wklejka 10 linii)

```
Prod: airon.coach. Unified account, no profile mode.
P0 BUG: Coach profile save OK but Coach Hub shows "not a coach" — getCoachStats returns 404 Deployment does not exist.
Done: referral capture, streak opt-in, getMyFollows fix, Feed P0 anti-duplikacja.
Also: Online flyout clipped; fake chevrons on My Profile/Coach Hub menu.
Next: prompts/base44-prompt-05-coach-hub-getCoachStats.txt (P0), then prompt 04.
Handoff: docs/base44-handoff.md
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

## Ostatnia aktualizacja

2026-06-24 — Coach Hub getCoachStats 404 bug + Task 4 P0 + menu UX bugs.
