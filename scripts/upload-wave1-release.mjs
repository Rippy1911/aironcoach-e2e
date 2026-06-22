#!/usr/bin/env node
/**
 * Fallback artifact upload via GitHub Release when FCU_API_KEY is unavailable.
 *
 * Usage:
 *   node scripts/upload-wave1-release.mjs [--tag=wave1-YYYYMMDD]
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const ARTIFACTS_DIR = path.resolve('test-results/wave1-artifacts');
const tag =
  process.argv.find((a) => a.startsWith('--tag='))?.split('=')[1] ??
  `wave1-${new Date().toISOString().slice(0, 10)}`;

async function main() {
  const manifestPath = path.join(ARTIFACTS_DIR, 'upload-manifest.json');
  let files = [];
  try {
    const entries = await fs.readdir(ARTIFACTS_DIR);
    files = entries.filter((f) => f.endsWith('.png')).map((f) => path.join(ARTIFACTS_DIR, f));
  } catch {
    console.error(`No artifacts in ${ARTIFACTS_DIR}. Run e2e:smoke first.`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No PNG artifacts to upload.');
    process.exit(1);
  }

  console.log(`Creating draft release ${tag} with ${files.length} assets…`);

  try {
    execSync(
      `gh release create "${tag}" ${files.map((f) => `"${f}"`).join(' ')} --repo Rippy1911/aironcoach-e2e --title "Wave 1 E2E artifacts ${tag}" --notes "Auto-uploaded Wave 1 smoke screenshots (FCU fallback)" --draft`,
      { stdio: 'inherit' },
    );
    const url = execSync(
      `gh release view "${tag}" --repo Rippy1911/aironcoach-e2e --json url -q .url`,
      { encoding: 'utf8' },
    ).trim();
    console.log(`Release URL: ${url}`);

    const assetUrls = execSync(
      `gh release view "${tag}" --repo Rippy1911/aironcoach-e2e --json assets -q '.assets[].url'`,
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    await fs.writeFile(
      path.join(ARTIFACTS_DIR, 'github-release-manifest.json'),
      JSON.stringify({ tag, releaseUrl: url, assetUrls }, null, 2),
    );
  } catch (err) {
    console.error('GitHub release upload failed:', err.message);
    process.exit(1);
  }
}

main();
