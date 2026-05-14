#!/usr/bin/env node
/**
 * Run after `npm run e2e:promo` to give the recorded videos human-friendly
 * filenames inside promo-assets/videos/. Screenshots are already named by
 * the spec; this only deals with the .webm output.
 *
 * Playwright writes videos to ./promo-assets/raw/<test-id>/video.webm; we
 * walk that folder and copy each one to ./promo-assets/videos/<slug>.webm.
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const RAW_DIR = path.join(ROOT, 'promo-assets/raw');
const RAW_MOBILE_DIR = path.join(ROOT, 'promo-assets/raw-mobile');
const OUT_DIR = path.join(ROOT, 'promo-assets/videos');
const SCREENS_DIR = path.join(ROOT, 'promo-assets/screenshots');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function findVideos(dir) {
  if (!(await exists(dir))) return [];
  const result = [];
  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.endsWith('.webm')) result.push(full);
    }
  }
  await walk(dir);
  return result;
}

function slugFromPath(p, kind) {
  const folder = path.basename(path.dirname(p));
  // Folder names look like "tests-promo-capture-promo-walkthrough-...".
  const slug = folder
    .replace(/^tests-?/, '')
    .replace(/^promo-capture-?/, '')
    .replace(/^promo-?/, '')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${kind}-${slug || 'walkthrough'}.webm`;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const desktop = await findVideos(RAW_DIR);
  const mobile = await findVideos(RAW_MOBILE_DIR);

  if (desktop.length === 0 && mobile.length === 0) {
    console.error('No video files found. Did you run `npm run e2e:promo`?');
    process.exit(1);
  }

  for (const v of desktop) {
    const dest = path.join(OUT_DIR, slugFromPath(v, 'desktop'));
    await fs.copyFile(v, dest);
    console.log(`✓ ${path.relative(ROOT, dest)}`);
  }
  for (const v of mobile) {
    const dest = path.join(OUT_DIR, slugFromPath(v, 'mobile'));
    await fs.copyFile(v, dest);
    console.log(`✓ ${path.relative(ROOT, dest)}`);
  }

  // List screenshots for convenience.
  if (await exists(SCREENS_DIR)) {
    const shots = (await fs.readdir(SCREENS_DIR)).sort();
    if (shots.length > 0) {
      console.log(`\nScreenshots (${shots.length}) at ${path.relative(ROOT, SCREENS_DIR)}:`);
      for (const s of shots) console.log(`  ${s}`);
    }
  }

  console.log(`\nVideos copied to: ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
