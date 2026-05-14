import type { ApiClient } from './apiClient';

/**
 * Entity cleanup order. Children first, then parents. Mirrors
 * `aironcoach/base44/functions/deleteAccount/entry.ts` ordering for safety.
 *
 * UserProfile is intentionally NOT in this list — we never delete a slot's
 * profile from cleanup (would require re-onboarding next run). Use
 * `deleteFreshAccount()` for the fresh slot instead.
 */
export const CLEANUP_ENTITIES = [
  'ExerciseSet',
  'PlannedExerciseSet',
  'Workout',
  'PlannedWorkout',
  'WorkoutComment',
  'WorkoutTemplate',
  'ExerciseGoal',
  'UserExerciseHistory',
  'Meal',
  'WaterLog',
  'FavoriteFood',
  'Recipe',
  'UserMetric',
  'Notepad',
  'Report',
  'Message',
  'Conversation',
  'PrivateMessage',
  'PrivateConversation',
  'CoachMessage',
  'TeamMember',
  'DashboardConfig',
  'Subscription',
  'ActivityLog',
  'FeedbackVote',
  'Feedback',
] as const;

export type CleanupOptions = {
  email: string;
  /** If provided, only clean rows from this set of entities. */
  only?: readonly string[];
  /** If provided, exclude these entities from cleanup. */
  exclude?: readonly string[];
  /** If true, log per-entity counts to the test console. */
  verbose?: boolean;
};

/**
 * Best-effort cleanup of all rows where created_by = email.
 * Errors per-entity are swallowed and logged so one failing entity doesn't
 * block the rest.
 *
 * Returns a map of entity -> deleted count.
 */
export async function cleanupForUser(
  api: ApiClient,
  opts: CleanupOptions,
): Promise<Record<string, number>> {
  const entities = (opts.only ?? CLEANUP_ENTITIES).filter(
    (e) => !opts.exclude?.includes(e),
  );
  const counts: Record<string, number> = {};

  for (const entity of entities) {
    try {
      const rows = await api.filter<{ id: string }>(
        entity,
        { created_by: opts.email },
        { limit: 500 },
      );
      let n = 0;
      for (const row of rows) {
        try {
          await api.delete(entity, row.id);
          n += 1;
        } catch (err) {
          if (opts.verbose) {
            console.warn(`[cleanup] ${entity}.delete(${row.id}) failed:`, err);
          }
        }
      }
      counts[entity] = n;
      if (opts.verbose && n > 0) {
        console.log(`[cleanup] ${entity}: deleted ${n}`);
      }
    } catch (err) {
      if (opts.verbose) {
        console.warn(`[cleanup] ${entity}.filter failed:`, err);
      }
      counts[entity] = 0;
    }
  }

  return counts;
}

/**
 * Permanent deletion of the fresh-slot account (profile + everything).
 * Calls the deployed `deleteAccount` backend function. After this returns
 * the `fresh.json` storage state is invalidated and must be re-captured.
 */
export async function deleteFreshAccount(
  api: ApiClient,
): Promise<{ success: boolean; results?: unknown }> {
  return api.invokeFunction<{ success: boolean; results?: unknown }>('deleteAccount', {});
}
