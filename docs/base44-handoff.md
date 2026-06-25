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
| `prompts/base44-prompt-03-continuation.txt` | Task 4 (P0 anti-duplikacja) — **wykonany** |
| `prompts/base44-prompt-04-menu-profile-hub.txt` | **Następny** — menu flyout + Profile Hub |

---

## Priorytety następny task

1. **P0-B** — napraw Online flyout + usuń fałszywe chevrony (My Profile, Coach Hub)
2. **P1** — Profile Hub kompletny + redirect MyFollows
3. **P2** — Community dokończenie (content-start, Invite card)
4. **P3** — Referral E2E / Testing Agent scenario
5. **P4** — Screenshoty

---

## Mini-handoff (wklejka 10 linii)

```
Prod: airon.coach. Unified account, no profile mode.
Done: referral capture, streak opt-in, getMyFollows fix, Feed P0 anti-duplikacja (1 composer).
Bug: Online flyout clipped/invisible; My Profile & Coach Hub have chevrons without submenu.
Next: fix menu flyout (overflow/portal), remove fake chevrons, build Profile Hub tabs.
Full: docs/base44-handoff.md | Prompt: prompts/base44-prompt-04-menu-profile-hub.txt
```

---

## Ostatnia aktualizacja

2026-06-24 — Task 4 P0 done + user menu UX bugs (Online flyout, misleading chevrons).
