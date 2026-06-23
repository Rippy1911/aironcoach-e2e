import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { expectAuthBootstrapped } from './assertions';
import { uploadArtifacts, type ArtifactRecord } from './fcvUpload';
import { acceptCookiesIfPresent } from './wave1';
import { pauseForApi, WAVE2_PACE_MS } from './wave2';
import { routes } from './selectors';

/** Same Base44 rate-limit pacing as Wave 2. */
export const WAVE3_PACE_MS = WAVE2_PACE_MS;

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'test-results', 'wave3-artifacts');

export async function ensureWave3ArtifactsDir(): Promise<string> {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  return ARTIFACTS_DIR;
}

export async function screenshotWave3(page: Page, name: string): Promise<string> {
  const dir = await ensureWave3ArtifactsDir();
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export async function uploadWave3Artifacts(
  artifacts: Array<{ label: string; localPath: string; tags: string[] }>,
): Promise<ArtifactRecord[]> {
  const tagged = artifacts.map((a) => ({
    ...a,
    tags: ['wave-3', ...a.tags],
  }));
  const results = await uploadArtifacts(tagged);
  const manifestPath = path.join(await ensureWave3ArtifactsDir(), 'upload-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(results, null, 2));
  return results;
}

/** /Workouts redirects to WorkoutCalendar on prod. */
export async function openWorkouts(page: Page): Promise<void> {
  await page.goto('/Workouts');
  await expectAuthBootstrapped(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await acceptCookiesIfPresent(page);
  await pauseForApi(page);
  await expect(page).toHaveURL(/\/WorkoutCalendar/);
}

export async function hasWorkoutTemplates(page: Page): Promise<boolean> {
  const templateCard = page
    .getByText(/Day \d+[A-Z]? - /i)
    .or(page.getByText(/sets · \d+/i))
    .first();
  return templateCard.isVisible({ timeout: 8_000 }).catch(() => false);
}

export async function pickVisibleTemplateName(page: Page): Promise<string | null> {
  const card = page.getByText(/Day \d+[A-Z]? - [A-Za-z ()]+/i).first();
  if (!(await card.isVisible({ timeout: 5_000 }).catch(() => false))) return null;
  const text = (await card.innerText()).trim();
  const match = text.match(/Day \d+[A-Z]? - [^\n]+/i);
  return match?.[0]?.trim() ?? text.split('\n')[0]?.trim() ?? null;
}

export async function ensureProSession(page: Page): Promise<void> {
  await page.goto(routes.home);
  await expectAuthBootstrapped(page);
  await acceptCookiesIfPresent(page);
  await pauseForApi(page, 1_000);
}

export async function clickStartWorkout(page: Page): Promise<void> {
  const start = page.getByRole('button', { name: /^Start$/i }).first();
  await expect(start, 'Start button should be visible').toBeVisible({ timeout: 15_000 });
  await start.click();
  await pauseForApi(page);
  await expectActiveWorkoutPage(page);
}

/** Preferred entry: Training tab → Start → ActiveWorkout. */
export async function startWorkoutFromTraining(page: Page): Promise<void> {
  await page.goto(routes.training);
  await expectAuthBootstrapped(page);
  await acceptCookiesIfPresent(page);
  await pauseForApi(page, WAVE3_PACE_MS);
  await clickStartWorkout(page);
}

export async function wave3PaceBetweenSpecs(page: Page): Promise<void> {
  await ensureProSession(page);
  await pauseForApi(page, WAVE3_PACE_MS);
}

export async function expectActiveWorkoutPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/ActiveWorkout/, { timeout: 20_000 });
  await expectAuthBootstrapped(page);
  await acceptCookiesIfPresent(page);

  const ready = () =>
    page
      .getByRole('button', { name: /add exercise/i })
      .or(page.getByPlaceholder(/workout name/i))
      .or(page.getByRole('button', { name: /finish workout/i }));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await ready().first().isVisible({ timeout: 12_000 }).catch(() => false)) return;

    if (attempt === 2) {
      await page.goto(routes.training);
      await expectAuthBootstrapped(page);
      await acceptCookiesIfPresent(page);
      await page.getByRole('button', { name: /^Start$/i }).first().click();
      await pauseForApi(page);
      continue;
    }

    await page.goto(routes.activeWorkout);
    await expectAuthBootstrapped(page);
    await acceptCookiesIfPresent(page);
    await pauseForApi(page);
  }

  await expect(ready().first()).toBeVisible({ timeout: 20_000 });
}

export function activeWorkoutRoot(page: Page): Locator {
  return page.locator('body');
}

export function isActiveWorkoutModal(page: Page): boolean {
  return false;
}

export async function addExerciseFromSearch(page: Page, query: string): Promise<void> {
  await acceptCookiesIfPresent(page);
  const root = activeWorkoutRoot(page);
  await root.getByRole('button', { name: /add exercise/i }).click();
  await pauseForApi(page, 1_000);

  const search = page.locator('input[placeholder*="Search exercise" i]');
  await expect(search).toBeVisible({ timeout: 10_000 });
  await search.fill(query);
  await pauseForApi(page, 1_500);

  const suggestion = page
    .locator('button.w-full.text-left')
    .filter({ hasText: new RegExp(query.split(/\s+/)[0]!, 'i') })
    .first();
  if (await suggestion.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await suggestion.click();
    await pauseForApi(page, 500);
  }

  await page.getByRole('button', { name: /^Add$/i }).click({ force: true });
  await pauseForApi(page);
}

export async function expectFirstExerciseVisible(
  page: Page,
  namePattern: RegExp | string,
): Promise<void> {
  const pattern = typeof namePattern === 'string' ? new RegExp(namePattern, 'i') : namePattern;
  await expect(
    page.getByText(pattern).first(),
    'ActiveWorkout should show the first exercise',
  ).toBeVisible({ timeout: 15_000 });
}

export function exerciseBlock(page: Page, keyword?: RegExp | string): Locator {
  const pattern =
    typeof keyword === 'string' ? new RegExp(keyword, 'i') : keyword ?? /./;
  return page
    .locator('div')
    .filter({ hasText: pattern })
    .filter({ has: page.getByRole('spinbutton') })
    .last();
}

export function activeStrengthExercise(page: Page, keyword?: RegExp | string): Locator {
  if (keyword) return exerciseBlock(page, keyword);
  return page
    .locator('div')
    .filter({ has: page.getByRole('button', { name: /^Add Set$/i }) })
    .last();
}

export function exerciseSetSpinbuttons(page: Page, keyword?: RegExp | string): Locator {
  return activeStrengthExercise(page, keyword).getByRole('spinbutton');
}

/** Each set row exposes reps, kg, sec spinbuttons (3 per set). */
export async function logSet(
  page: Page,
  setIndex: number,
  reps: number,
  weight: number,
  exerciseKeyword?: string,
): Promise<void> {
  const spins = exerciseSetSpinbuttons(page, exerciseKeyword);
  const base = setIndex * 3;
  await expect(spins.nth(base), `set ${setIndex + 1} reps input`).toBeVisible({
    timeout: 10_000,
  });
  await spins.nth(base).fill(String(reps));
  await spins.nth(base + 1).fill(String(weight));
  await pauseForApi(page);
}

export async function addSetRow(page: Page, exerciseKeyword?: string): Promise<void> {
  await activeStrengthExercise(page, exerciseKeyword)
    .getByRole('button', { name: /^Add Set$/i })
    .first()
    .click();
  await pauseForApi(page, 1_000);
}

export type ParsedSetRow = {
  setNumber: number;
  reps: number;
  weight: number;
};

export async function readSetRows(page: Page, exerciseKeyword?: string): Promise<ParsedSetRow[]> {
  const spins = exerciseSetSpinbuttons(page, exerciseKeyword);
  const count = await spins.count();
  const rows: ParsedSetRow[] = [];
  for (let i = 0; i + 1 < count; i += 3) {
    const reps = parseInt((await spins.nth(i).inputValue()) || '0', 10);
    const weight = parseInt((await spins.nth(i + 1).inputValue()) || '0', 10);
    if (reps > 0 || weight > 0) {
      rows.push({ setNumber: rows.length + 1, reps, weight });
    }
  }
  return rows;
}

export async function expectSetInHistory(
  page: Page,
  reps: number,
  weight: number,
  exerciseKeyword?: string,
): Promise<void> {
  const rows = await readSetRows(page, exerciseKeyword);
  const match = rows.find((r) => r.reps === reps && r.weight === weight);
  expect(
    match,
    `expected a logged set ${reps} reps @ ${weight}kg in set history; got ${JSON.stringify(rows)}`,
  ).toBeTruthy();

  const setsLabel = activeStrengthExercise(page, exerciseKeyword)
    .getByText(new RegExp(`${rows.length}\\s*sets`, 'i'))
    .first();
  await expect(setsLabel).toBeVisible({ timeout: 10_000 });
}

export async function rpeInput(page: Page): Promise<Locator | null> {
  const input = page.locator('input[placeholder*="RPE" i], [aria-label*="RPE" i]').first();
  if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) return input;

  const rpeBtn = page.getByRole('button', { name: /^RPE$|^RPE\s*\d/i }).first();
  if (await rpeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) return rpeBtn;

  const rpeSpin = page.getByRole('spinbutton', { name: /RPE/i }).first();
  if (await rpeSpin.isVisible({ timeout: 1_000 }).catch(() => false)) return rpeSpin;

  return null;
}

export async function setRpeIfPresent(page: Page, value: number): Promise<boolean> {
  const control = await rpeInput(page);
  if (!control) return false;

  const tag = await control.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'input' || tag === 'textarea') {
    await control.fill(String(value));
  } else {
    await control.click();
    await pauseForApi(page, 500);
    const pick = page.getByRole('button', { name: new RegExp(`^${value}$`) }).first();
    if (await pick.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await pick.click();
    } else {
      await page.getByText(new RegExp(`RPE\\s*${value}`, 'i')).first().click().catch(() => {});
    }
  }
  await pauseForApi(page);
  return true;
}

export async function expectRpePersists(page: Page, value: number): Promise<void> {
  const body = await page.locator('body').innerText();
  expect(body).toMatch(new RegExp(`RPE\\s*${value}`, 'i'));
}

export async function finishWorkout(page: Page): Promise<void> {
  await acceptCookiesIfPresent(page);
  await page.getByRole('button', { name: /finish workout/i }).click({ force: true });
  await pauseForApi(page, 2_000);

  const confirm = page
    .getByRole('button', { name: /finish workout|confirm|yes|complete/i })
    .filter({ hasNotText: /finish workout/i })
    .last();
  if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await confirm.click();
    await pauseForApi(page);
  }

  const dialogConfirm = page.locator('[role="alertdialog"], [role="dialog"]').getByRole('button', {
    name: /finish|confirm|yes|complete/i,
  });
  if (await dialogConfirm.last().isVisible({ timeout: 2_000 }).catch(() => false)) {
    await dialogConfirm.last().click();
    await pauseForApi(page);
  }
}

export async function expectFinishSummary(page: Page): Promise<void> {
  await expect(page.getByText(/workout completed/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\d+\s*\n?\s*exercises/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/\d+\s*\n?\s*sets/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/\d+\s*\n?\s*volume/i).first()).toBeVisible({ timeout: 10_000 });
}

export async function closeFinishSummary(page: Page): Promise<void> {
  const done = page.getByRole('button', { name: /^Done$|^Close$/i }).first();
  if (await done.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await done.click();
    await pauseForApi(page, 1_000);
  }
}

export async function openWorkoutHistoryList(page: Page): Promise<void> {
  await page.goto('/WorkoutCalendar');
  await expectAuthBootstrapped(page);
  await acceptCookiesIfPresent(page);
  await pauseForApi(page);

  const listBtn = page.getByRole('button', { name: /^List$/i }).first();
  await expect(listBtn).toBeVisible({ timeout: 15_000 });
  await listBtn.click();
  await pauseForApi(page);
}

export async function expectWorkoutInHistory(
  page: Page,
  exerciseKeyword: string,
): Promise<void> {
  await expect(page.getByText(/Today/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(new RegExp(exerciseKeyword, 'i')).first(),
    `finished workout containing "${exerciseKeyword}" should appear in calendar list`,
  ).toBeVisible({ timeout: 15_000 });
}

export async function cleanupActiveWorkout(page: Page): Promise<void> {
  await page.goto(routes.activeWorkout);
  await expectAuthBootstrapped(page);
  await acceptCookiesIfPresent(page);

  const finish = page.getByRole('button', { name: /finish workout/i });
  if (!(await finish.isVisible({ timeout: 8_000 }).catch(() => false))) return;

  const discard = page.getByRole('button', { name: /discard workout/i });
  if (await discard.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await discard.click({ force: true });
    await pauseForApi(page, 1_000);
    const confirm = page
      .locator('[role="alertdialog"], [role="dialog"]')
      .getByRole('button', { name: /discard|delete|confirm|yes/i })
      .last();
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.click({ force: true });
      await pauseForApi(page);
    }
    return;
  }

  await finishWorkout(page);
  await closeFinishSummary(page);
}

export async function discardActiveWorkout(page: Page): Promise<void> {
  await page.goto(routes.workoutCalendar);
  await expectAuthBootstrapped(page);
  await acceptCookiesIfPresent(page);
  await pauseForApi(page, 1_000);

  const inProgress = page.getByText(/workout in progress/i);
  if (!(await inProgress.isVisible({ timeout: 4_000 }).catch(() => false))) return;

  await cleanupActiveWorkout(page);
}

/** Clear any in-progress ActiveWorkout so the next spec starts clean. */
export async function dismissInProgressWorkoutIfNeeded(page: Page): Promise<void> {
  await ensureProSession(page);
  await discardActiveWorkout(page);
}
