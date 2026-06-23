import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { uploadArtifacts, type ArtifactRecord } from '../helpers/fcvUpload';

export const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'test-results', 'wave1-artifacts');

export async function ensureArtifactsDir(): Promise<string> {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  return ARTIFACTS_DIR;
}

export async function screenshotFullPage(
  page: Page,
  name: string,
  viewport?: { width: number; height: number },
): Promise<string> {
  const dir = await ensureArtifactsDir();
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export async function acceptCookiesIfPresent(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: /^Accept$/i });
  if (await accept.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await accept.click({ force: true });
  }
}

export async function dismissCookieBannerForFirstVisit(page: Page): Promise<void> {
  // Fresh context should show banner — do NOT accept so we can assert it
}

export async function scrollToPricingSection(page: Page): Promise<void> {
  // Pricing nav may be a button (desktop) or inside mobile menu
  const pricingBtn = page.getByRole('button', { name: /^Pricing$/i }).first();
  const pricingLink = page.getByRole('link', { name: /^Pricing$/i }).first();

  if (await pricingBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await pricingBtn.click({ force: true });
  } else if (await pricingLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await pricingLink.click();
  } else {
    // Mobile hamburger — open menu first
    const menuBtn = page
      .getByRole('button', { name: /menu|open navigation|☰/i })
      .or(page.locator('button[aria-label*="menu" i]'))
      .first();
    if (await menuBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await menuBtn.click();
      await page.getByRole('button', { name: /^Pricing$/i }).first().click({ force: true });
    }
  }

  await page.waitForTimeout(800);

  const freeTier = page
    .getByRole('heading', { name: /^Free$/i })
    .or(page.getByText(/^Free$/i))
    .first();
  for (let i = 0; i < 20; i++) {
    if (await freeTier.isVisible().catch(() => false)) break;
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
  }
  await freeTier.scrollIntoViewIfNeeded({ timeout: 10_000 }).catch(() => {});
}

export async function uploadWave1Artifacts(
  artifacts: Array<{ label: string; localPath: string; tags: string[] }>,
): Promise<ArtifactRecord[]> {
  const results = await uploadArtifacts(artifacts);
  // Persist manifest for PR body generation
  const manifestPath = path.join(await ensureArtifactsDir(), 'upload-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(results, null, 2));
  return results;
}
