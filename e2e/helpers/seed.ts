import type { ApiClient } from './apiClient';

const TEST_PREFIX = 'E2E::';

/**
 * All seeded entities should include this prefix in a string field
 * (notes, content, title, etc.) so they're identifiable and removable
 * even if cleanup races with a real user action.
 */
export const E2E_TAG = TEST_PREFIX;

/** Match Playwright `use.timezoneId` so seeded calendar rows appear on the day the UI opens. */
export function calendarDateInPlaywrightTZ(d = new Date()): string {
  const tz = process.env.TZ ?? 'Europe/Warsaw';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

/** Pick a day likely free of the user's completed workouts (compact grid hides plans behind workouts). */
export function addCalendarDaysPlaywrightTZ(days: number, from = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  return calendarDateInPlaywrightTZ(d);
}

export type SeededWorkout = {
  workoutId: string;
  setIds: string[];
};

export async function seedWorkout(
  api: ApiClient,
  opts: { date?: string; exerciseName?: string; sets?: number } = {},
): Promise<SeededWorkout> {
  const date = opts.date ?? calendarDateInPlaywrightTZ();
  const exerciseName = (opts.exerciseName ?? 'bench press').toLowerCase();
  const setCount = opts.sets ?? 3;

  const workout = await api.create<{ id: string }>('Workout', {
    date,
    type: 'strength',
    duration: 60,
    notes: `${TEST_PREFIX} seedWorkout`,
    status: 'completed',
    total_volume: 60 * setCount * 10,
  });

  const sets = Array.from({ length: setCount }, (_, i) => ({
    workout_id: workout.id,
    exercise_name: exerciseName,
    exercise_order: 0,
    reps: 10,
    weight: 60,
    set_number: i + 1,
  }));
  const created = await api.bulkCreate<{ id: string }>('ExerciseSet', sets);

  return {
    workoutId: workout.id,
    setIds: created.map((s) => s.id),
  };
}

export type SeededPlan = {
  planId: string;
  plannedSetIds: string[];
};

export async function seedPlannedWorkout(
  api: ApiClient,
  opts: { date?: string; exerciseCount?: number } = {},
): Promise<SeededPlan> {
  const date = opts.date ?? calendarDateInPlaywrightTZ();
  const exerciseCount = opts.exerciseCount ?? 2;

  const plan = await api.create<{ id: string }>('PlannedWorkout', {
    date,
    title: `${TEST_PREFIX} seed plan`,
    type: 'strength',
    status: 'planned',
  });

  // Prefer entity bulkCreate: `createPlannedExerciseSets` may be absent on older deploys (HTTP 404).
  const rows = Array.from({ length: exerciseCount }, (_, i) => ({
    planned_workout_id: plan.id,
    exercise_name: i === 0 ? 'squat' : 'deadlift',
    sets: 3,
    reps: 5,
    weight: 100,
    order: i,
  }));
  const created = await api.bulkCreate<{ id: string }>('PlannedExerciseSet', rows);

  return {
    planId: plan.id,
    plannedSetIds: created.map((s) => s.id),
  };
}

export async function seedConversation(
  api: ApiClient,
): Promise<{ conversationId: string }> {
  const conv = await api.create<{ id: string }>('Conversation', {
    title: `${TEST_PREFIX} seed convo`,
    is_active: true,
  });
  return { conversationId: conv.id };
}

export async function seedActivityLogsForToday(
  api: ApiClient,
  opts: { count: number; actionType: string },
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < opts.count; i += 1) {
    const row = await api.create<{ id: string }>('ActivityLog', {
      action_type: opts.actionType,
      details: { source: TEST_PREFIX, i },
    });
    ids.push(row.id);
  }
  return ids;
}

export async function seedCoupon(
  api: ApiClient,
  opts: { code: string; rewardType?: string; maxRedemptions?: number },
): Promise<{ id: string; code: string }> {
  const coupon = await api.create<{ id: string; code: string }>('Coupon', {
    code: opts.code,
    reward_type: opts.rewardType ?? 'premium_1_month',
    active: true,
    max_redemptions: opts.maxRedemptions ?? 1,
    times_redeemed: 0,
    notes: `${TEST_PREFIX} seed coupon`,
  });
  return coupon;
}
