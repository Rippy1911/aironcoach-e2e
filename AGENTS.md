# aironcoach-e2e

## Cursor Cloud specific instructions

### What this repo is
This is a **Playwright E2E test suite**, not a runnable application. There is no local
server or frontend to build. The "application" under test is the **deployed Base44 app**
(`airon.coach`), which the tests hit over real HTTPS. "Running the app" here means running
the Playwright tests. See `README.md` for the full command list (`npm run e2e`, `e2e:smoke`,
`e2e:ui`, `e2e:report`, `e2e:promo`, etc.).

### Lint / typecheck / test / run
- Typecheck (closest thing to a lint check): `npm run typecheck` (`tsc --noEmit`). There is
  no ESLint config. NOTE: typecheck currently fails on a **pre-existing** error in
  `e2e/tests/01-pro-full-journey.spec.ts` (`'notes' does not exist on type '{ id: string }'`).
  This is a code bug unrelated to environment setup — leave it unless asked to fix.
- Browser install: `npm run e2e:install` (downloads Chromium; already run by the update
  script's `playwright install`).
- Run tests: `npx playwright test --project=<project>` or the `e2e:*` scripts.

### Which tests can run without credentials
Only the **`anonymous`** project runs out of the box — it needs nothing but a reachable
`BASE_URL` (defaults to staging `https://break-through-ai.base44.app`, no `.env` required):

```bash
npx playwright test --project=anonymous
```

All other projects (`pro`, `free`, `admin`, `fresh`, `mobile-pro`, `promo`, `promo-mobile`)
require **captured auth storage states** at `e2e/.auth/<slot>.json` AND the `TEST_*_EMAIL`
env vars. Storage states are produced by an **interactive** Google login
(`npm run e2e:auth-setup -- --slot=<slot>`), which cannot run headless without real
credentials. Without them those projects fail at startup with `Missing required env var
TEST_*_EMAIL` or a missing-storage-state error. To enable them, provide the test account
emails and capture storage states (or supply `STORAGE_STATE_<SLOT>_B64` secrets, decoded
into `e2e/.auth/`). Stripe (`STRIPE_TEST_KEY`) and PayU (`PAYU_E2E=1`) specs auto-skip
unless those are set.

### Gotchas
- If Playwright's bundled Chromium crashes (SIGSEGV) in a hardened VM, set
  `PLAYWRIGHT_CHANNEL=chrome` in `.env` and `npx playwright install chrome`. The bundled
  Chromium worked fine in this Cloud VM.
- Captured Google sessions expire (~30 days); re-run `e2e:auth-setup` if slotted specs
  start failing with auth errors.
