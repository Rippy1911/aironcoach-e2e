# Audit promptów 23 i 24

## Wniosek

Prompt 23 jest dobry jako wizja docelowa, ale może brzmieć jak większa przebudowa Hub.

Prompt 24 jest bezpieczniejszy do wklejenia teraz, bo mówi jasno:

- **nie przebudowuj od zera**,
- zachowaj obecne dobre elementy Hub,
- uporządkuj flow,
- usuń Marketing z sidebaru,
- napraw realny blocker: własny profil coacha nadal nie ma sensownej edycji.

## Dobre elementy obecnego Hub wykryte na prod

- Status coacha: Approved / Private / not listed.
- Profile visibility.
- Profile completeness.
- Komunikat private → brak widoczności dla klientów.
- Edit coach profile / Open / Preview / Copy link.
- Marketing Hub shortcut.
- Services & Offers shortcut.
- Discovery Score.
- Directory Rank.
- Followers.
- Tier Expiry / Current Tier Includes.
- Checklist:
  - profile photo,
  - bio,
  - specialty,
  - certification,
  - pricing tier,
  - city,
  - language,
  - years of experience.

## Rekomendacja

Wkleić:

```txt
prompts/base44-prompt-24-coach-hub-polish-preserve-good-parts.txt
```

Traktować 23 jako źródło większej wizji, ale 24 jako praktyczny prompt na teraz.
