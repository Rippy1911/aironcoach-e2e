import { expect, type Page } from '@playwright/test';
import type { ApiClient } from './apiClient';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Assert that an ActivityLog row of the given action_type exists for `email`,
 * created within the last `withinMs` milliseconds.
 *
 * Note RLS: ActivityLog read RLS is `$or [{user.role:admin}, {created_by:'<sebastian>'}, {created_by:'{{user.email}}'}]`.
 * In practice that means:
 *   - The `pro`/`free`/`fresh` slot can only assert on its OWN ActivityLog rows.
 *   - The `admin` slot can assert on anyone's. Pass the admin's ApiClient when
 *     a non-admin slot's logs need verification.
 */
export async function expectActivityLog(
  api: ApiClient,
  opts: {
    email: string;
    actionType: string;
    withinMs?: number;
    minCount?: number;
  },
): Promise<void> {
  const within = opts.withinMs ?? ONE_DAY_MS;
  const minCount = opts.minCount ?? 1;
  const cutoff = new Date(Date.now() - within).toISOString();

  const rows = await api.filter<{ created_date: string; action_type: string }>(
    'ActivityLog',
    { action_type: opts.actionType, created_by: opts.email },
    { sort: '-created_date', limit: 50 },
  );
  const recent = rows.filter((r) => r.created_date >= cutoff);
  expect(
    recent.length,
    `expected ≥ ${minCount} ActivityLog rows action_type=${opts.actionType} for ${opts.email} within ${within}ms; got ${recent.length}`,
  ).toBeGreaterThanOrEqual(minCount);
}

/**
 * Assert that an AppLog row exists with the given category/action, created
 * within `withinMs` ms.
 *
 * AppLog read RLS is admin-only. Pass an admin-slot ApiClient.
 */
export async function expectAppLog(
  adminApi: ApiClient,
  opts: {
    category: string;
    action: string;
    withinMs?: number;
    minCount?: number;
    metadataMatcher?: (md: Record<string, unknown> | undefined) => boolean;
  },
): Promise<void> {
  const within = opts.withinMs ?? ONE_DAY_MS;
  const minCount = opts.minCount ?? 1;
  const cutoff = new Date(Date.now() - within).toISOString();

  const rows = await adminApi.filter<{
    created_date: string;
    category: string;
    action: string;
    metadata?: Record<string, unknown>;
  }>(
    'AppLog',
    { category: opts.category, action: opts.action },
    { sort: '-created_date', limit: 100 },
  );
  let recent = rows.filter((r) => r.created_date >= cutoff);
  if (opts.metadataMatcher) {
    recent = recent.filter((r) => opts.metadataMatcher!(r.metadata));
  }

  expect(
    recent.length,
    `expected ≥ ${minCount} AppLog rows category=${opts.category} action=${opts.action} within ${within}ms; got ${recent.length}`,
  ).toBeGreaterThanOrEqual(minCount);
}

export async function expectEntityCount(
  api: ApiClient,
  entity: string,
  filter: Record<string, unknown>,
  expected: number,
): Promise<void> {
  const rows = await api.filter(entity, filter, { limit: 200 });
  expect(rows.length, `${entity} count for filter=${JSON.stringify(filter)}`).toBe(
    expected,
  );
}

/**
 * Returns the current path (no host). Useful for asserting a SPA redirect
 * landed at the expected page.
 */
export async function currentPath(page: Page): Promise<string> {
  return new URL(page.url()).pathname;
}

export async function expectAtPath(
  page: Page,
  expectedPath: RegExp | string,
  opts: { timeout?: number } = {},
): Promise<void> {
  await expect
    .poll(async () => currentPath(page), { timeout: opts.timeout ?? 10_000 })
    .toMatch(expectedPath instanceof RegExp ? expectedPath : new RegExp(`^${expectedPath}`));
}

/**
 * Wait for `localStorage.base44_access_token` to be present, indicating the
 * SDK loaded the token. Useful as a barrier before invoking the apiClient.
 */
export async function expectAuthBootstrapped(page: Page): Promise<void> {
  await expect
    .poll(
      async () => page.evaluate(() => !!localStorage.getItem('base44_access_token')),
      { timeout: 15_000 },
    )
    .toBe(true);
}
