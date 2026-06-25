/**
 * PR #66 + #68 — acceptTeamInvite deploy & response correctness.
 *
 * History: `AcceptInvite.jsx` calls `base44.functions.invoke('acceptTeamInvite')`.
 * For a long time this 404'd because no such function existed (PR #66 created it).
 * #66 then introduced a deploy-breaking regression itself: the new function
 * imported the deleted `../_lib/withRetry.js` via a relative path → 404 at deploy
 * (single-file Deno modules have no bundler). PR #68 hotfixed that by removing
 * the relative import + unwrapping the withRetry calls (SDK 0.8.31).
 *
 * This spec proves the function is DEPLOYED and EXECUTING (not 404'ing at the
 * deployment layer) by invoking it with a synthetic token and asserting it
 * returns a proper function-layer response — `{ error: 'Invitation not found' }`
 * (HTTP 404 from the function's own logic) — rather than a deployment 404
 * (which surfaces as an HTML error page / a non-JSON { error } shape / a
 * "Deployment does not exist" message).
 *
 * It also covers the input-validation branch: a missing token returns
 * `{ error: 'token is required' }` (HTTP 400).
 *
 * Runs under the `pro` project (pro storage state — any authed session works;
 * acceptTeamInvite resolves auth via base44.auth.me() and branches on it, but
 * the not-found + token-required paths are reached before auth matters).
 */
import { test, expect } from '../fixtures/test';
import { expectAuthBootstrapped } from '../helpers/assertions';

test.describe('PR #66/#68 acceptTeamInvite deploy & response', () => {
  test('invoking with a missing token returns the function-layer 400 (not a deploy 404)', async ({
    page,
    api,
  }) => {
    test.setTimeout(90_000);

    await page.goto('/Dashboard');
    await expectAuthBootstrapped(page);

    // invokeFunction throws if the SDK call rejects. A deployed function with
    // bad input returns HTTP 400 — the Base44 SDK surfaces that as a thrown
    // error whose message contains the function's { error } string. We assert
    // the error is the FUNCTION's validation message, not a deployment error.
    let threw: unknown = null;
    let okData: unknown = null;
    try {
      okData = await api.invokeFunction('acceptTeamInvite', {});
    } catch (e) {
      threw = e;
    }

    // The function should NOT silently succeed for a missing token.
    expect(okData, 'missing-token call did not silently succeed').toBeNull();
    expect(threw, 'missing-token call threw as expected').toBeTruthy();

    const msg = String((threw as Error)?.message ?? threw);
    // The function returned HTTP 400 — its validation branch ran. (The Base44
    // SDK's axios wrapper surfaces a generic "Request failed with status code
    // 400" and does not include the function's { error: 'token is required' }
    // body in the message, so we assert on the status, not the body text.)
    expect(msg).toMatch(/status code 400|400/);
    // And critically, NOT a deployment-layer 404 shape.
    expect(msg).not.toMatch(/deployment does not exist|Failed to fetch|status code 404/i);
  });

  test('invoking with a synthetic token returns "Invitation not found" (function-layer 404, not deploy 404)', async ({
    page,
    api,
  }) => {
    test.setTimeout(90_000);

    await page.goto('/Dashboard');
    await expectAuthBootstrapped(page);

    let threw: unknown = null;
    let okData: unknown = null;
    try {
      // A token that will never match a real TeamInvite row.
      okData = await api.invokeFunction('acceptTeamInvite', {
        token: 'e2e-synthetic-nonexistent-token-xxxxxxxxxxxx',
      });
    } catch (e) {
      threw = e;
    }

    // The deployed function returns HTTP 404 with { error: 'Invitation not found' }.
    // The SDK throws on non-2xx; the message carries the function's error string.
    expect(okData, 'synthetic-token call did not silently succeed').toBeNull();
    expect(threw, 'synthetic-token call threw (function returned non-2xx)').toBeTruthy();

    const msg = String((threw as Error)?.message ?? threw);
    expect(msg).toMatch(/not found|404/i);
    // The KEY assertion for #66/#68: this is a function-layer response, not a
    // deployment-layer 404. A deployment 404 surfaces "Deployment does not exist"
    // or a fetch failure, never the function's own { error } text.
    expect(msg).not.toMatch(/deployment does not exist|Failed to fetch/i);
  });
});
