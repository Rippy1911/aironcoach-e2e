# Audit promptów 21 i 22

## Wniosek

Nie wklejać 21 i 22 jako dwóch równoległych instrukcji bez komentarza, bo mają częściowy konflikt:

- **21** mówi: Marketing / CoachMarketing jako osobne główne studio edycji.
- **22** mówi: Marketing znika z nawigacji, a Hub wchłania edycję profilu.

Lepszy kierunek produktowy: **22**.

Dlatego powstał:

```txt
prompts/base44-prompt-23-coach-hub-operating-system.txt
```

## Co zachować z 21

- Własny profil startuje w **Edit mode**, nie Guest view.
- Guest view to toggle, nie domyślny stan.
- Ołówki / szybkie poprawki na własnym profilu.
- Oferty z Services/Offers widoczne na tab Coach.
- Settings nie powinien być drugim pełnym edytorem profilu.

## Co zachować z 22

- Usunąć Marketing z głównej nawigacji.
- Coach Hub = jedno centrum operacyjne coacha.
- Dawny CoachMarketing wchłonięty jako tab/sekcja **Profile** w Hub.
- Hub ma Overview / Profile / Offers / opcjonalnie Clients.
- `/CoachMarketing` przekierowuje do Hub Profile, żeby stare linki nie padły.

## Dodatkowe pomysły dodane w 23

- Coach health score: Good / Needs work + konkretne braki.
- Jeden next best action zamiast chaosu przycisków.
- Sticky public preview przy edycji profilu.
- Smart empty states dla braku ofert / private profile / not accepting clients.
- Mobile: taby jako pills, Profile accordion, sticky Preview/Save.
- Copy mniej marketingowe: Public profile / Coach card zamiast Marketing.

## Rekomendacja dla Base44

Wkleić **23** jako następny prompt. 21/22 zostają jako źródło kontekstu, ale 23 jest spójnym kierunkiem.
