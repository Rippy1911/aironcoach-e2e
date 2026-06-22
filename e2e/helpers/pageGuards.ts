import { expect, type Page, type Response } from '@playwright/test';

export type PageGuardResult = {
  consoleErrors: string[];
  pageErrors: string[];
  serverErrors: Array<{ url: string; status: number }>;
};

/**
 * Attach listeners that collect console errors, unhandled page errors, and 5xx responses.
 * Call `detach()` in afterEach or at end of test.
 */
export function attachPageGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const serverErrors: Array<{ url: string; status: number }> = [];

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore noisy third-party / hydration warnings that aren't app bugs
      if (/favicon|ResizeObserver|chunk load/i.test(text)) return;
      consoleErrors.push(text);
    }
  };

  const onPageError = (err: Error) => {
    pageErrors.push(err.message);
  };

  const onResponse = (res: Response) => {
    const status = res.status();
    if (status >= 500) {
      serverErrors.push({ url: res.url(), status });
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  return {
    snapshot: (): PageGuardResult => ({
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      serverErrors: [...serverErrors],
    }),
    detach: () => {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);
    },
    assertClean: (label = 'page') => {
      const snap = {
        consoleErrors: [...consoleErrors],
        pageErrors: [...pageErrors],
        serverErrors: [...serverErrors],
      };
      expect(snap.consoleErrors, `${label}: console errors`).toEqual([]);
      expect(snap.pageErrors, `${label}: unhandled page errors`).toEqual([]);
      expect(snap.serverErrors, `${label}: 5xx responses`).toEqual([]);
    },
  };
}

/**
 * Wait for a network response matching `urlPart` with expected status.
 */
export async function waitForApiResponse(
  page: Page,
  urlPart: string,
  status: number,
  action: () => Promise<void>,
): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(urlPart) && res.status() === status,
      { timeout: 15_000 },
    ),
    action(),
  ]);
  return response;
}
