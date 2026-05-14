# aironcoach-e2e

End-to-end Playwright suite for [`airon.coach`](https://airon.coach). Runs Chromium against the deployed Base44 app over real HTTPS — there is no mock backend.

> **Single source of truth for the spec:** `../_docs/prompts/aironcoach-e2e.md`. Master app overview lives at `../_docs/prompts/aironcoach-master-overview.md`. Both are reconciled against the live `aironcoach/` codebase as of 2026-05-08.

---

## Quick start

```bash
# 1. Install
npm install
npm run e2e:install        # downloads Chromium

# 2. Configure
cp .env.example .env       # then fill in BASE_URL, BASE44_APP_ID, TEST_*_EMAIL

# 3. Capture storage state for each slot (interactive, one-time)
npm run e2e:auth-setup -- --slot=free
npm run e2e:auth-setup -- --slot=pro
npm run e2e:auth-setup -- --slot=admin
npm run e2e:auth-setup -- --slot=fresh

# 4. Run
npm run e2e                # all specs
npm run e2e:smoke          # auth + routing only
npm run e2e:headed         # watch the browser
npm run e2e:ui             # Playwright UI mode
npm run e2e:report         # open last HTML report

# 5. Capture marketing assets (screenshots + 1080p video)
npm run e2e:promo
# → outputs to ./promo-assets/
```

The default `BASE_URL` is **staging** (`https://break-through-ai.base44.app`) until production launches — see `../aironcoach/src/docs/RELEASE_CHECKLIST.md` blocker B1.

---

## What's covered

| Spec | Slot(s) | Prompt § | Status |
|---|---|---|---|
| `smoke-anonymous.spec.ts` | anonymous | §4.1 | full |
| `smoke-pro-routing.spec.ts` | pro | §4.1 | full |
| `smoke-admin-routing.spec.ts` | admin | §4.1 | full |
| `smoke-mobile-nav.spec.ts` | mobile-pro | §4.1 | full |
| `onboarding.spec.ts` | fresh | §4.2 | full (3-step trial flow) |
| `workout-logging.spec.ts` | pro | §4.3 | full *(see Known divergences)* |
| `planned-workout-completion.spec.ts` | pro | §4.4 | full |
| `ai-coach-chat-pro.spec.ts` | pro | §4.5 | full |
| `ai-coach-chat-free.spec.ts` | free | §4.5 | full |
| `premium-upgrade.spec.ts` | free | §4.6 | gated by `STRIPE_TEST_KEY`; covers PRO monthly, ELITE yearly, cancel, promo banner |
| `payu-upgrade.spec.ts` | free | §4.6b | gated by `PAYU_E2E=1`; redirect-only (extend when sandbox stabilizes) |
| `coupon-redemption.spec.ts` | free | §4.7 | full |
| `account-deletion.spec.ts` | fresh | §4.8 | full |
| `promo-capture.spec.ts` | promo | n/a | gated by `PROMO_CAPTURE=1` |
| `promo-capture-mobile.spec.ts` | promo-mobile | n/a | gated by `PROMO_CAPTURE=1` |

---

## Using a personal account (e.g. xrivosx@gmail.com)

You **never** put a password in this repo. The auth-setup script opens a real browser, you log in interactively, and we capture the resulting cookies/localStorage to a gitignored file.

To wire `xrivosx@gmail.com` (currently a 14-day-trial PRO user) as the `pro` slot:

```bash
# 1. In .env, point TEST_PRO_EMAIL at the personal account so reports/logs label
#    things correctly:
echo 'TEST_PRO_EMAIL=xrivosx@gmail.com' >> .env

# 2. Run the interactive setup. A Chromium window opens:
npm run e2e:auth-setup -- --slot=pro

# 3. In the browser:
#    - Click "Log in with Google"
#    - Type xrivosx@gmail.com + your password (in the BROWSER, not the terminal)
#    - Complete 2FA if prompted
#    - Wait for the redirect to /Dashboard
#    - Return to the terminal and press Enter — the script saves the
#      session to e2e/.auth/pro.json
```

The captured `pro.json` contains an opaque `base44_access_token` plus Google session cookies. It's gitignored. To share it with CI, base64-encode it into a secret (`STORAGE_STATE_PRO_B64`) — the GitHub Actions workflow decrypts it automatically.

> **Reminder:** Google sessions silently expire after ~30 days. If specs start failing with auth errors, re-run `e2e:auth-setup`.

If you want to use the same personal account for multiple slots (e.g. quickly bootstrap a free-slot test), run auth-setup multiple times with different `--slot` values. **But:** running spec X against an account whose backend state doesn't match slot X (e.g. running `coupon-redemption` against an account that's already on a paid PRO subscription) will fail because of seeded preconditions. Map accounts to slots whose `UserProfile` shape matches.

---

## Known divergences from the original prompt

These are intentional and reflect the actual `aironcoach/` HEAD as of 2026-05-08. See `../_docs/prompts/aironcoach-e2e.md` for the full reality-check.

1. **`workout_created` / `exercise_set_logged` ActivityLog assertions are `test.fixme()`.** `LogWorkout.jsx` calls `Workout.create` and `ExerciseSet.bulkCreate` directly; only the `manageWorkoutData` backend writes those action_types. We assert on entity rows instead. Re-enable once `LogWorkout.jsx` is refactored to use the backend function.
2. **Workout deletion is hard, not soft.** `WorkoutDetails.handleDelete` calls `Workout.delete()`. We assert the rows are gone, not that `archived_at` is set.
3. **Stripe upgrade spec auto-skips** unless `STRIPE_TEST_KEY` is set in `.env`. The deployed app's `STRIPE_SECRET_KEY` MUST start with `sk_test_` for the function to resolve test price IDs.
4. **PayU spec auto-skips** unless `PAYU_E2E=1`. PayU sandbox UI selectors aren't stable; the current spec only verifies the redirect happens. Extend with full card-fill once the sandbox flow stabilizes (and after IPN sandbox notification URL is registered — see RELEASE_CHECKLIST B2).

---

## Slot accounts

You need 4 dedicated Google accounts in the Base44 user table BEFORE running tests:

| Slot | Email (env var) | Role | UserProfile state |
|---|---|---|---|
| `free` | `TEST_FREE_EMAIL` | user | `subscription_tier=free`, `premium=false`, `onboarding_completed=true` |
| `pro` | `TEST_PRO_EMAIL` | user | `subscription_tier=pro`, `premium=true`, `premium_expires=…` |
| `admin` | `TEST_ADMIN_EMAIL` | admin | `subscription_tier=pro`, `premium=true` |
| `fresh` | `TEST_FRESH_EMAIL` | user | NO UserProfile (gets re-onboarded each run; trial granted on completion) |

After capturing storage states, the JSON files live at `e2e/.auth/<slot>.json` (gitignored).

### Sharing storage states between developers / CI

The captured JSON files contain auth tokens — never commit them. Two options:

- **Local team:** drop the `.json` files into a shared password manager / vault.
- **CI:** base64-encode each file and add as repo secrets `STORAGE_STATE_<SLOT>_B64`. The provided `.github/workflows/e2e.yml` decrypts them automatically.

```bash
# Encode for CI:
base64 -i e2e/.auth/pro.json | pbcopy
# Paste into GitHub repo secret STORAGE_STATE_PRO_B64.
```

---

## Architecture

### `e2e/helpers/apiClient.ts`

Entity / function operations run **inside the page context** via `page.evaluate()`. The Base44 SDK is already loaded and authenticated in the page; we re-import its module to avoid duplicating auth logic from Node. This is the most robust approach against Vite-bundled production builds where module paths are hashed.

If `import('/src/api/base44Client.js')` ever fails (e.g. dev-mode-only), the helper falls back to importing `@base44/sdk` from esm.sh and synthesizing a client from `localStorage['base44_access_token']`.

### `e2e/helpers/cleanup.ts`

`cleanupForUser({ email, only?, exclude? })` walks a fixed entity order (children-before-parents) and deletes everything `created_by` the given email, swallowing per-entity errors so one failing entity doesn't block the rest.

For the `fresh` slot's account-deletion spec, `deleteFreshAccount()` calls the deployed `deleteAccount` backend function. After it runs, the `fresh.json` storage state is invalidated and must be re-captured.

### `e2e/helpers/seed.ts`

All seeded rows are tagged with `E2E::` in a string field (notes / title / content) so a stranded test row is visually distinguishable from real user data.

### Test isolation

- `playwright.config.ts` defines 8 projects: `anonymous`, `pro`, `free`, `admin`, `fresh`, `mobile-pro`, `promo`, `promo-mobile`.
- `fullyParallel: false` to avoid two specs racing on the same slot's data.
- `workers: 2` in CI, `4` locally.

---

## Marketing capture (`npm run e2e:promo`)

The `promo` and `promo-mobile` projects walk the app's key surfaces with slow-motion (`slowMo: 350 ms`) and write to:

```
promo-assets/
├── screenshots/     # NN-<slug>.png (full-page, retina) and 1NN-mobile-<slug>.png
├── raw/             # desktop test artifacts (Playwright structure)
├── raw-mobile/      # mobile test artifacts
└── videos/          # collected .webm files with friendly names (after collect script runs)
```

The `e2e:promo` npm script runs both projects then invokes `scripts/collect-promo-assets.mjs` to copy the videos out of Playwright's raw output dirs into `promo-assets/videos/` with names like `desktop-walkthrough.webm` and `mobile-walkthrough.webm`.

**Outputs at the end of a run:**

- 9 desktop screenshots: `01-dashboard.png`, `02-workout-calendar.png`, `03-log-workout-empty.png`, `04-log-workout-filled.png`, `05-templates.png`, `06-reports.png`, `07-metrics.png`, `08-coach-chat.png`, `09-coach-chat-with-prompt.png`, `10-community.png`, `11-settings.png`.
- 4 mobile screenshots: `101-mobile-dashboard.png`, `102-mobile-chat.png`, `103-mobile-log-workout.png`, `104-mobile-settings.png`.
- 2 videos: `desktop-…webm`, `mobile-…webm` (1080p and 390×844 respectively).

The `promo-assets/` directory is gitignored. Copy the files you want to share to a shared drive / Notion / etc.

> Tip: convert `.webm` to `.mp4` for compatibility with platforms that don't support WebM:
> ```bash
> ffmpeg -i promo-assets/videos/desktop-walkthrough.webm -c:v libx264 -crf 18 -preset slow promo-assets/videos/desktop-walkthrough.mp4
> ```

---

## Adding a new spec

1. Pick a slot (or invent one and add it to `playwright.config.ts`).
2. Drop a `*.spec.ts` in `e2e/tests/` and add it to the `testMatch` regex of the relevant project(s).
3. Use the `test` and `expect` from `@fixtures/test`, not from `@playwright/test` directly — that's where the `api`, `slot`, and `slotEmail` fixtures live.
4. Always add a `test.afterEach(cleanup …)` block.
5. Reference any new selectors / route paths from `helpers/selectors.ts`. Don't sprinkle magic strings.

---

## CI integration

`.github/workflows/e2e.yml` runs on `push` to `main` and on PRs. Required secrets:

| Secret | Purpose |
|---|---|
| `PREVIEW_URL` | Target URL — usually `https://<APP_ID>.preview.base44.app` |
| `BASE44_APP_ID` | Live airon.coach app ID |
| `TEST_*_EMAIL` | Per-slot test account emails |
| `STORAGE_STATE_*_B64` | Base64-encoded `e2e/.auth/<slot>.json` |
| `STRIPE_TEST_KEY` | Optional. Set to enable §4.6. |
| `PAYU_E2E` | Optional. Set to `1` to enable §4.6b. |

---

## Troubleshooting

- **`browserType.launch: … SEGV` / bundled Chromium crashes** → Some environments (IDE sandboxes, hardened VMs) kill Playwright’s downloaded Chromium. Fix one of:
  - Run tests **outside** the sandbox in a normal terminal on your Mac.
  - Set `PLAYWRIGHT_CHANNEL=chrome` in `.env` and install Chrome for Playwright: `npx playwright install chrome` (or install Google Chrome to the default `/Applications` path).
- **`Missing required env var TEST_*_EMAIL`** → fill in `.env` from `.env.example`. (Anonymous smoke only needs `BASE_URL`; other projects need all four emails.)
- **All tests fail with auth errors** → re-capture storage state (`npm run e2e:auth-setup -- --slot=...`). Google sessions expire silently after ~30 days.
- **`apiClient.loadSdk: no token / app_id in localStorage`** → the slot's storage state was captured on a different host than `BASE_URL`. Re-capture after fixing `BASE_URL`.
- **Stripe spec hangs at `checkout.stripe.com`** → Stripe occasionally renames its hosted-page selectors. Update `e2e/helpers/stripeCheckout.ts`.
- **`expectActivityLog` always fails for non-admin slots** → ActivityLog read RLS is `created_by = user.email` for non-admins; only the OWN slot can see its rows. To assert another slot's logs, pass an admin `apiClient`.
- **Promo videos missing after `e2e:promo`** → the spec only writes them when the test passes. Check the HTML report (`npm run e2e:report`) for failures, or run `node scripts/collect-promo-assets.mjs` manually after a successful run.
