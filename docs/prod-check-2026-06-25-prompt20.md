# Prod check — 2026-06-25 (po częściowym prompt 20)

**Bundle:** `index-CUSZI1d8.js`  
**Git repo E2E:** clean, branch `cursor/add-coachapp-rules-c550` zsynchronizowany.

## Prompt 20 — częściowo wdrożone

| Feature | Status |
|---------|--------|
| Guest view toggle | ✅ jest |
| **Default na własnym profilu** | ❌ **Guest view** (powinno być Edit mode) |
| Ołówki / inline edit | ❌ brak |
| Oferty na tab Coach | ❌ nie potwierdzone |
| Public checkbox przy create coach | ? |

## UX — potwierdzone na prod

| Problem | Dowód |
|---------|--------|
| Hub „Edit coach profile” → Settings#coach | Playwright |
| Prawdziwy edytor → **/CoachMarketing** | działa, rozbudowany |
| `/Marketing` | 404 (route to CoachMarketing) |

## Następny prompt

`prompts/base44-prompt-21-coach-ux-simplify-marketing-edit.txt`
