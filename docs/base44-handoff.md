# Base44 / Airon Coach — handoff dokument

> **Cel:** wklej ten plik (lub jego sekcję „Stan na dziś") do nowego czatu, żeby agent miał pełny kontekst bez historii rozmowy.
>
> **App prod:** https://airon.coach  
> **Repo E2E (testy):** aironcoach-e2e (Playwright, nie kod aplikacji)  
> **Konto testowe (user):** xrivosx@gmail.com (w README jako przykład PRO slot)

---

## Architektura (nie zmieniać w promptach)

- **Jedno konto** — bez Coach mode / Athlete mode / Profile mode / switchera.
- **Coach = capability** — Coach Hub, Services, marketing tylko gdy user ma capability.
- **Trainee** zamiast Athlete w copy user-facing.
- Community / Messages / Teams **nie** za paywall coach capability.

Pełne reguły: `.cursor/rules/coachapp.mdc`

---

## Timeline tasków Base44

### Task 1 — Referral + Community (pierwszy duży prompt)
**Zrobione:**
- Root cause P0: `redeemReferralCode` / `ensureReferralCode` 404 — martwy deployment przez import `../_lib/withRetry.js` (plik nie istniał). Fix: inline withRetry.
- Capture `?ref__=CODE` na `/login` i `/Landing`.
- Usunięty fałszywy sukces „Enjoy your 7 days of Premium" w JoinReferral.
- CommunityHeaderCTA per tab w headerze.
- PeopleHub — usunięty duplikat przycisku Invite.

**Nie zrobione / słabe:**
- Brak E2E signup na nowym koncie.
- Community wizualnie prawie bez zmian (Base44: login wall w preview).

### Task 2 — Profil menu + streak + Community (drugi duży prompt)
**Zrobione:**
- ProfileModeMenu: klikalny header → profil, wiersz My Profile, PresenceFlyout (hover w prawo).
- MyFollows: kompaktowy header profilowy (avatar + link do profilu).
- CommunityShell: subtitle inline, header CTA.

**Nie zrobione:**
- Profile Hub z tabami — **świadomie odłożone**.
- Community redesign ≤96px — odłożone.
- E2E referral — odłożone (OAuth).

### Task 3 — Mega prompt (profile hub + community + streak + referral)
**Zrobione (Część D):**
- `UserProfile.show_streak_badge` (default false).
- `streak_tier_public` w `getUserProfile`, `getMyFollows` (tylko tier 10/20/50/100, nie exact count).
- StreakBadge: tryb publicTier („20+ day streak").
- Settings → Privacy toggle: „Show my training streak on my public profile".
- PersonCard / MyFollows / usePeopleData — `streak_tier_public`.
- **Fix 500:** `getMyFollows` — burst `Follow.update` w pętli → `bulkUpdate` (429 rate limit → 500).

**Świadomie NIE zrobione (Base44):**
- Profile Hub B2/B3 (Overview/Activity/Follows/Stats/Coach tabs) — „half-build gorszy niż obecny".
- `/MyFollows` redirect — bo `&tab=follows` nie istnieje jeszcze.
- Community layout redesign (Część C).
- Referral OAuth E2E.

### Feedback użytkownika (po publish Task 3)
- **Community Feed:** 3× „create post" (header CTA + inline composer + Quick Actions) — **bez sensu, P0 do usunięcia**.
- Profil / nawigacja — nadal nieintuicyjna, My Follows orphan.
- Community UI — nadal za dużo pustej przestrzeni u góry.
- Streak badge na cudzych kartach — wymaga opt-in + danych testowych (prod może nie mieć streak ≥10).

---

## Stan na dziś — co jest na prod (zweryfikowane)

| Feature | Status |
|---------|--------|
| `/join/:code` → `airon_pending_referral` | ✅ |
| `?ref__=` login/Landing | ✅ |
| redeemReferralCode endpoint żyje (nie 404 deploy) | ✅ |
| My Profile, View profile, Follows & followers w menu | ✅ |
| PresenceFlyout hover w prawo | ✅ |
| CommunityHeaderCTA (Create post / team / message / invite) | ✅ (Feed = duplikat!) |
| Inline composer na Feed | ✅ |
| StreakBadge 10/20/50/100 | ✅ |
| show_streak_badge + streak_tier_public backend | ✅ |
| getMyFollows 500 fix | ✅ (bulkUpdate) |
| Profile Hub tabs | ❌ |
| /MyFollows → profil?tab=follows | ❌ |
| Feed: jeden entry point create | ❌ (3×) |
| Community header ≤96px bez subtitle | ❌ |
| Referral E2E nowe konto | ❌ |
| Screenshoty zalogowanej sesji w raportach | ❌ |

---

## Znane pliki (Base44)

**Referral:** `lib/pendingReferral.js`, `pages/JoinReferral.jsx`, `components/referral/ReferralAutoApply.jsx`, `components/referral/ReferralShareCard.jsx`, `functions/redeemReferralCode`, `functions/ensureReferralCode`

**Menu/profil:** `ProfileModeMenu` / `SidebarProfilePopover`, `PresenceFlyout`, `pages/UserProfile.jsx`, `pages/MyFollows.jsx`

**Community:** `pages/Community.jsx`, `CommunityShell.jsx`, `CommunityHeaderCTA.jsx`, `FeedTab.jsx`, `PeopleHub.jsx`, `PersonCard.jsx`, Quick Actions / discovery rail

**Streak:** `components/streak/StreakBadge.jsx`, `lib/streak.js`, `streak/AchievementsSettings.jsx`, `entities/UserProfile`

**Backend:** `functions/getUserProfile`, `functions/getMyFollows`, `functions/getReferralPromoState`

---

## Priorytety na następny task (kolejność)

1. **P0 — C0 anti-duplikacja CTA** (Feed: tylko inline composer)
2. **P1 — Profile Hub** (taby + Follows w profilu + redirect /MyFollows)
3. **P2 — Community layout** (header ≤96px, spójny content-start, Quick Actions bez duplikatów)
4. **P3 — Referral E2E** (OAuth signup LUB scenariusz Testing Agent)
5. **P4 — Weryfikacja streak** (test data + screenshot badge na karcie)

---

## Prompty w repo

| Plik | Opis |
|------|------|
| `prompts/base44-opus-profile-community-ui.txt` | Mega prompt v2 (z C0 anti-duplikacja) |
| `prompts/base44-prompt-03-continuation.txt` | **Następny prompt** — kontynuacja po Task 3 |

---

## Reguła UX Community (dla wszystkich przyszłych promptów)

```
Header CTA = tylko gdy main column NIE MA primary action tej samej akcji.
Quick Actions = skróty cross-tab, NIE duplikat bieżącego taba.

Feed:     inline composer = JEDYNY create post (bez header CTA, bez Quick Actions create)
Teams:    header „Create team" OK
Messages: header „New message" OK
People:   header „Invite" OK
```

---

## Testing Agent — referral E2E (gotowy scenariusz)

```
1. Anonimowo: https://airon.coach/join/<FOREIGN-CODE>
2. Assert localStorage airon_pending_referral === CODE
3. Signup nowego konta (Google OAuth)
4. Dokończ onboarding
5. Settings → Billing: referral applied / premium days
6. Assert localStorage airon_pending_referral cleared
7. Powtórz od kroku 1 z /login?ref__=<FOREIGN-CODE>
```

---

## Ostatnia aktualizacja

2026-06-24 — po feedback Base44 Task 3 + user screenshot Feed (3× create post).
