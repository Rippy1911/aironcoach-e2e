/**
 * Centralized routes and text selectors. Keep airon.coach-specific strings
 * here so a UI rewording only requires updating one place.
 *
 * Verified against aironcoach/src HEAD on 2026-05-08 (post-PayU integration,
 * post-onboarding rewrite, post-4-tier upgrade UI).
 *
 * Sources of truth:
 *  - aironcoach/src/Layout.jsx                 (nav)
 *  - aironcoach/src/pages/Onboarding.jsx       (3-step trial flow)
 *  - aironcoach/src/pages/Settings.jsx         (4 upgrade buttons + provider toggle)
 *  - aironcoach/src/pages/Chat.jsx             (premium overlay)
 *  - aironcoach/src/pages/LogWorkout.jsx       (workout form)
 *  - aironcoach/base44/functions/createCheckoutSession/entry.ts
 *  - aironcoach/base44/functions/payuCreateOrder/entry.ts
 */

export const routes = {
  landing: '/Landing',
  dashboard: '/Dashboard',
  onboarding: '/Onboarding',
  chat: '/Chat',
  settings: '/Settings',
  workoutCalendar: '/WorkoutCalendar',
  logWorkout: '/LogWorkout',
  workoutDetails: '/WorkoutDetails',
  reports: '/Reports',
  metrics: '/Metrics',
  templates: '/Templates',
  community: '/Community',
  trainees: '/Trainees',
  appDev: '/AppDev',
  admin: '/Admin',
  nutrition: '/Nutrition',
  mealPlanner: '/MealPlanner',
  myFoods: '/MyFoods',
  shoppingList: '/ShoppingList',
} as const;

export const text = {
  landing: {
    // LandingNav: native <button> with t('nav_login') — EN "Login", PL "Zaloguj się"
    loginCta: /log in|^login$|zaloguj|sign in/i,
    // Hero + nav CTA: t('hero_cta') — EN "Start Free", PL "Zacznij za darmo"
    startFreeCta: /start free|get started|zacznij|start free trial/i,
  },
  settings: {
    freePlanBadge: /free plan/i,
    premiumActiveBadge: /premium active/i,
    /** New 4-button layout (Settings.jsx ll. 312–336). */
    upgrade: {
      proMonthly: /29\.99\s*PLN/i,
      proYearly: /299\.99\s*PLN/i,
      eliteMonthly: /89\.99\s*PLN/i,
      eliteYearly: /899\.99\s*PLN/i,
    },
    /** Provider toggle (Settings.jsx ll. 303–310). */
    provider: {
      stripeButton: /Card \(Stripe\)|💳/i,
      payuButton: /BLIK.*Przelewy.*PayU|🇵🇱/i,
    },
    /** AIRONCOACH50 announcement banner (Settings.jsx ll. 300–302). */
    promoBanner: /AIRONCOACH50.*50%/i,
    redeemButton: /^redeem$/i,
    /** Onboarding-renamed: "Enter your invite code" (Settings.jsx l. 345). */
    couponPlaceholder: /enter (your )?(coupon|invite) code/i,
    deleteAccountButton: /delete account/i,
    deleteConfirmDialog: /delete account/i,
    deleteSuccessToast: /deleted|removed/i,
    /** Stripe success redirect toast (Settings.jsx l. 39). */
    upgradeSuccessToast: /Płatność zakończona sukcesem|payment.*success|witaj w pro/i,
    upgradeCancelToast: /Płatność anulowana|payment.*cancel/i,
  },
  chat: {
    overlayTitle: /premium feature|upgrade to|płatna funkcja/i,
    overlayCta: /view premium options|upgrade to (pro|elite)|wybierz plan/i,
    sendPlaceholder: /send message|wpisz|ask anything|spróbuj/i,
    dailyLimitReached: /daily limit reached|limit dzienny|wykorzystano/i,
  },
  onboarding: {
    /** Step 1 — three goal cards (Onboarding.jsx ll. 167–189). */
    goalCard: {
      gainMuscle: /build muscle|💪/i,
      loseWeight: /lose weight|🔥/i,
      maintain: /maintain|⚖️/i,
    },
    unitsToggle: { metric: /kg \/ cm|metric/i, imperial: /lbs \/ in|imperial/i },
    heightLabel: /^height/i,
    weightLabel: /^weight/i,
    continueButton: /^continue$|^dalej$/i,
    /** Final step CTA — "Start free trial" (Onboarding.jsx l. 300). */
    submitButton: /start free trial|start trial|rozpocznij/i,
    trialBanner: /you're getting pro free|14 days|free trial/i,
  },
  workout: {
    saveButton: /save workout|zapisz/i,
    addExercise: /add exercise|dodaj/i,
    notesPlaceholder: /notes|notatki/i,
    namePlaceholder: /exercise|ćwiczen/i,
    repsPlaceholder: /reps/i,
    weightPlaceholder: /weight|kg/i,
  },
  /** 6 nav items in Layout.jsx — Trainees only renders for coach-team members. */
  nav: {
    home: /home|dashboard/i,
    training: /training|trening/i,
    coach: /coach|chat|trener/i,
    trainees: /trainees|podopiec/i,
    community: /community|społeczność/i,
    settings: /settings|ustawienia/i,
  },
} as const;

export const selectors = {
  bottomNav: '[data-mobile-nav], nav[aria-label="bottom"], nav.bottom-nav',
  toast: '[data-sonner-toast], .sonner-toast, [role="status"]',
  dialog: '[role="dialog"]',
} as const;
