/**
 * Base44 entity REST helper.
 *
 * All operations run inside `page.evaluate()` so they share the in-browser
 * Base44 SDK instance (and its already-authenticated state). This means the
 * helper never needs the auth token in Node — Playwright's storageState +
 * the deployed app's bundled SDK do all the work.
 *
 * Why not use `@base44/sdk` from Node?
 *   The SDK reads its config from URL params + localStorage at module init,
 *   which only works inside a browser. Re-implementing auth from Node is
 *   brittle and unnecessary when the page is already authed.
 *
 * Limitations / TODO:
 *   - Base44's entity REST URL shape isn't published in the airon.coach repo.
 *     Until verified by network capture, the helper falls back to dynamically
 *     importing the SDK module that's already loaded in the page (via the
 *     same import path the app uses). If that import path changes in a
 *     future Base44 release, update `loadSdk` below.
 *   - All filter results respect RLS (the user-scoped SDK is what's used),
 *     so e.g. `expectActivityLog(email, ...)` only works for the slot whose
 *     storage state is loaded — or for the admin slot, since ActivityLog
 *     read RLS includes `$or [{user.role:admin}, ...]`.
 */
import type { Page } from '@playwright/test';

/** Playwright pages start at `about:blank`; localStorage/SDK only work on the app origin. */
async function ensureAppOrigin(page: Page): Promise<void> {
  const raw = page.url();
  let host = '';
  try {
    host = new URL(raw).hostname;
  } catch {
    host = '';
  }
  const base = (process.env.BASE_URL ?? 'https://break-through-ai.base44.app').replace(
    /\/$/,
    '',
  );
  const onApp =
    host.endsWith('base44.app') ||
    host.endsWith('airon.coach') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  if (raw === 'about:blank' || !onApp) {
    await page.goto(`${base}/Dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  }
}

function isRateLimitError(err: unknown): boolean {
  const s = String(err);
  return /rate limit|429|too many requests/i.test(s);
}

/** Base44 may throttle bursts during long single-worker E2E runs — backoff and retry. */
async function retryOnRateLimit<T>(operation: () => Promise<T>, attempts = 8): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (e) {
      last = e;
      if (!isRateLimitError(e) || i === attempts - 1) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw last;
}

export type EntityFilter = Record<string, unknown>;

declare global {
  interface Window {
    __e2e_base44?: unknown;
  }
}

/**
 * Inject (once per page) a `window.__e2e_base44` reference to the loaded
 * SDK so subsequent evaluate() calls can use it without re-importing.
 *
 * This works on the deployed Vite-built app because the airon.coach bundle
 * exposes the base44 client through its own module graph; we re-import the
 * same source module the app uses.
 */
async function loadSdk(page: Page): Promise<void> {
  const alreadyLoaded = await page.evaluate(() => !!window.__e2e_base44);
  if (alreadyLoaded) return;

  await page.evaluate(async () => {
    // The app exposes the configured client via a known module path.
    // The airon.coach bundle hashes the path, so we walk the document for
    // a script that imports `@base44/sdk` and reuse its global if present.
    //
    // Strategy: dynamically import('/src/api/base44Client.js') first
    // (works on dev server + preview Vite serve), and fall back to using
    // the SDK directly via /node_modules path (won't work on prod) — in
    // that case we synthesize a client from localStorage + SDK CDN.
    try {
      // @ts-expect-error - dynamic import for in-page execution
      const mod = await import('/src/api/base44Client.js');
      window.__e2e_base44 = mod.base44;
      return;
    } catch {
      /* fall through */
    }

    // Fallback: synthesize via the published SDK with localStorage token.
    const token = localStorage.getItem('base44_access_token');
    const appId = localStorage.getItem('base44_app_id');
    const appBaseUrl = localStorage.getItem('base44_app_base_url') || window.location.origin;
    if (!token || !appId) {
      throw new Error(
        'apiClient.loadSdk: no token / app_id in localStorage. ' +
          'Has storage state been captured for this slot? Re-run e2e:auth-setup.',
      );
    }
    // @ts-expect-error - dynamic import of esm.sh CDN
    const { createClient } = await import('https://esm.sh/@base44/sdk@0.8.27');
    window.__e2e_base44 = createClient({
      appId,
      token,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl,
    });
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type EntityClient = {
  filter(f: EntityFilter, sort?: string, limit?: number): Promise<any[]>;
  list(sort?: string, limit?: number): Promise<any[]>;
  get(id: string): Promise<any>;
  create(data: Record<string, unknown>): Promise<any>;
  update(id: string, data: Record<string, unknown>): Promise<any>;
  delete(id: string): Promise<void>;
  bulkCreate(items: Record<string, unknown>[]): Promise<any[]>;
};

export class ApiClient {
  constructor(private readonly page: Page) {}

  async ready(): Promise<void> {
    await ensureAppOrigin(this.page);
    await loadSdk(this.page);
  }

  async filter<T = any>(
    entity: string,
    filter: EntityFilter = {},
    opts: { sort?: string; limit?: number } = {},
  ): Promise<T[]> {
    await this.ready();
    return retryOnRateLimit(() =>
      this.page.evaluate(
        async ({ entity, filter, sort, limit }) => {
          const sdk = window.__e2e_base44 as { entities: Record<string, EntityClient> };
          return sdk.entities[entity].filter(filter, sort ?? '-created_date', limit ?? 100);
        },
        { entity, filter, sort: opts.sort, limit: opts.limit },
      ),
    );
  }

  async list<T = any>(
    entity: string,
    opts: { sort?: string; limit?: number } = {},
  ): Promise<T[]> {
    await this.ready();
    return retryOnRateLimit(() =>
      this.page.evaluate(
        async ({ entity, sort, limit }) => {
          const sdk = window.__e2e_base44 as { entities: Record<string, EntityClient> };
          return sdk.entities[entity].list(sort ?? '-created_date', limit ?? 100);
        },
        { entity, sort: opts.sort, limit: opts.limit },
      ),
    );
  }

  async create<T = any>(entity: string, data: Record<string, unknown>): Promise<T> {
    await this.ready();
    return retryOnRateLimit(() =>
      this.page.evaluate(
        async ({ entity, data }) => {
          const sdk = window.__e2e_base44 as { entities: Record<string, EntityClient> };
          return sdk.entities[entity].create(data);
        },
        { entity, data },
      ),
    );
  }

  async update<T = any>(
    entity: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    await this.ready();
    return retryOnRateLimit(() =>
      this.page.evaluate(
        async ({ entity, id, data }) => {
          const sdk = window.__e2e_base44 as { entities: Record<string, EntityClient> };
          return sdk.entities[entity].update(id, data);
        },
        { entity, id, data },
      ),
    );
  }

  async delete(entity: string, id: string): Promise<void> {
    await this.ready();
    await retryOnRateLimit(() =>
      this.page.evaluate(
        async ({ entity, id }) => {
          const sdk = window.__e2e_base44 as { entities: Record<string, EntityClient> };
          await sdk.entities[entity].delete(id);
        },
        { entity, id },
      ),
    );
  }

  async bulkCreate<T = any>(
    entity: string,
    items: Record<string, unknown>[],
  ): Promise<T[]> {
    await this.ready();
    return retryOnRateLimit(() =>
      this.page.evaluate(
        async ({ entity, items }) => {
          const sdk = window.__e2e_base44 as { entities: Record<string, EntityClient> };
          return sdk.entities[entity].bulkCreate(items);
        },
        { entity, items },
      ),
    );
  }

  async invokeFunction<T = any>(
    name: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    await this.ready();
    return retryOnRateLimit(() =>
      this.page.evaluate(
        async ({ name, payload }) => {
          const sdk = window.__e2e_base44 as {
            functions: { invoke(name: string, payload: unknown): Promise<{ data: unknown }> };
          };
          const res = await sdk.functions.invoke(name, payload);
          return res.data as T;
        },
        { name, payload },
      ),
    );
  }

  /** Returns `await base44.auth.me()` from inside the page. */
  async me(): Promise<{ id: string; email: string; full_name?: string; role?: string }> {
    await this.ready();
    return retryOnRateLimit(() =>
      this.page.evaluate(async () => {
        const sdk = window.__e2e_base44 as { auth: { me(): Promise<unknown> } };
        return sdk.auth.me() as Promise<{
          id: string;
          email: string;
          full_name?: string;
          role?: string;
        }>;
      }),
    );
  }
}
