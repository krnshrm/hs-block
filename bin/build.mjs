#!/usr/bin/env node
// Regenerates everything in generated/ from the JSON in data/.
//
//   npm run build            write generated/
//   npm run build -- --check exit 1 if generated/ is stale (used by CI)
//
// data/ is the source of truth that humans and the block CLI edit.
// generated/ is what code imports and what the app fetches at runtime.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf-8'));
const pkg = readJson('package.json');

// Normalise: lowercase, trim, drop blanks and anything without a dot, dedupe, sort.
function normalise(list, label) {
  const out = new Set();
  for (const raw of list) {
    const d = String(raw).trim().toLowerCase().replace(/^@/, '');
    if (!d) continue;
    if (/\s/.test(d)) throw new Error(`${label}: "${raw}" contains whitespace`);
    if (!d.includes('.')) throw new Error(`${label}: "${raw}" is not a domain`);
    out.add(d);
  }
  return [...out].sort();
}

const free = normalise(readJson('data/free.json'), 'data/free.json');
const commonFree = normalise(readJson('data/common-free.json'), 'data/common-free.json');
const competitors = normalise(readJson('data/competitors.json'), 'data/competitors.json');
const blocked = normalise(readJson('data/blocked.json'), 'data/blocked.json');
// Machine-maintained: written by bin/sync-disposable.mjs, never edited by hand.
let disposable = [];
try {
  disposable = normalise(readJson('data/disposable.json'), 'data/disposable.json');
} catch {
  console.warn('warning: no data/disposable.json yet, run npm run sync:disposable');
}

// A domain on both the competitor and the ad-hoc list is harmless but pointless.
const overlap = blocked.filter((d) => competitors.includes(d));
if (overlap.length) {
  console.warn(`warning: in both competitors and blocked: ${overlap.join(', ')}`);
}

const generatedAt = new Date().toISOString();
const banner = `// GENERATED FILE. Do not edit.\n// Source: data/*.json. Regenerate with: npm run build\n`;

const arr = (name, list) =>
  `export const ${name} = ${JSON.stringify(list)};\n`;

const full =
  banner +
  arr('FREE', free) +
  arr('COMPETITORS', competitors) +
  arr('BLOCKED', blocked) +
  arr('DISPOSABLE', disposable) +
  `export const VERSION = ${JSON.stringify(pkg.version)};\n` +
  `export const GENERATED_AT = ${JSON.stringify(generatedAt)};\n`;

const light =
  banner +
  arr('COMMON_FREE', commonFree) +
  arr('COMPETITORS', competitors) +
  arr('BLOCKED', blocked) +
  `export const VERSION = ${JSON.stringify(pkg.version)};\n` +
  `export const GENERATED_AT = ${JSON.stringify(generatedAt)};\n`;

const published =
  JSON.stringify(
    {
      version: pkg.version,
      generatedAt,
      counts: {
        free: free.length,
        commonFree: commonFree.length,
        competitors: competitors.length,
        blocked: blocked.length,
        disposable: disposable.length,
      },
      commonFree,
      competitors,
      blocked,
      free,
      disposable,
    },
    null,
    2,
  ) + '\n';

const targets = [
  ['generated/data-full.js', full],
  ['generated/data-light.js', light],
  ['generated/email-domains.json', published],
];

// GENERATED_AT and generatedAt change on every run, so --check compares the
// content with the timestamps stripped out. Only real list changes count.
const stripTime = (s) =>
  s.replace(/"?generated_?at"?\s*[:=]\s*"[^"]*"/gi, 'TS');

if (checkOnly) {
  let stale = false;
  for (const [path, content] of targets) {
    let current = '';
    try {
      current = readFileSync(join(root, path), 'utf-8');
    } catch {
      current = '';
    }
    if (stripTime(current) !== stripTime(content)) {
      console.error(`stale: ${path}`);
      stale = true;
    }
  }
  if (stale) {
    console.error('\nRun: npm run build, then commit generated/');
    process.exit(1);
  }
  console.log('generated/ is in sync with data/');
  process.exit(0);
}

for (const [path, content] of targets) {
  writeFileSync(join(root, path), content, 'utf-8');
}

console.log(
  `built v${pkg.version}: ${free.length} free, ${commonFree.length} common, ` +
    `${competitors.length} competitors, ${blocked.length} blocked, ` +
    `${disposable.length} disposable`,
);
