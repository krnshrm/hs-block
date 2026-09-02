#!/usr/bin/env node
// Pulls the disposable-domain list from the upstream project and writes it to
// data/disposable.json, then regenerates generated/.
//
//   npm run sync:disposable
//   npm run sync:disposable -- --dry-run
//
// Upstream: https://github.com/disposable-email-domains/disposable-email-domains
// Licensed CC0, so no attribution obligation. Entries are second-level domains
// and are matched against a domain and all of its parents.
//
// This runs unattended on a schedule and feeds a live blocking path, so it
// refuses to write anything that looks wrong. Better a stale list than one that
// silently stops blocking, or one that blocks a real customer's domain.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const SOURCE =
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

// Guards
const MIN_DOMAINS = 5000;        // upstream is ~8,700; anything near this floor is broken
const MAX_SHRINK = 0.1;          // reject a sync that drops more than 10% of the list

// Domains that must never end up on the block list, whatever upstream says.
// A false positive here rejects real signups, so it is worth the belt and braces.
const NEVER_BLOCK = new Set([
  'hubsell.com',
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'gmx.de',
  'gmx.net',
  'web.de',
  'aol.com',
]);

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf-8'));

const res = await fetch(SOURCE, { headers: { accept: 'text/plain' } });
if (!res.ok) {
  console.error(`sync failed: HTTP ${res.status} from ${SOURCE}`);
  process.exit(1);
}
const text = await res.text();

const fetched = [
  ...new Set(
    text
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l && !l.startsWith('#') && l.includes('.') && !/\s/.test(l)),
  ),
].sort();

if (fetched.length < MIN_DOMAINS) {
  console.error(`sync refused: only ${fetched.length} domains, expected at least ${MIN_DOMAINS}`);
  process.exit(1);
}

const removed = fetched.filter((d) => NEVER_BLOCK.has(d));
const safe = fetched.filter((d) => !NEVER_BLOCK.has(d));
if (removed.length) {
  console.warn(`dropped by the never-block guard: ${removed.join(', ')}`);
}

let current = [];
try {
  current = readJson('data/disposable.json');
} catch {
  current = [];
}

if (current.length) {
  const shrink = (current.length - safe.length) / current.length;
  if (shrink > MAX_SHRINK) {
    console.error(
      `sync refused: list would shrink from ${current.length} to ${safe.length}, ` +
        `a ${(shrink * 100).toFixed(1)}% drop. Check upstream before forcing this.`,
    );
    process.exit(1);
  }
}

const currentSet = new Set(current);
const added = safe.filter((d) => !currentSet.has(d));
const safeSet = new Set(safe);
const dropped = current.filter((d) => !safeSet.has(d));

if (!added.length && !dropped.length) {
  console.log(`no change: ${safe.length} disposable domains`);
  process.exit(0);
}

console.log(`+${added.length} / -${dropped.length}, now ${safe.length} disposable domains`);
if (added.length) console.log(`  added, first few: ${added.slice(0, 5).join(', ')}`);
if (dropped.length) console.log(`  removed, first few: ${dropped.slice(0, 5).join(', ')}`);

if (dryRun) {
  console.log('dry run, nothing written.');
  process.exit(0);
}

writeFileSync(join(root, 'data/disposable.json'), JSON.stringify(safe, null, 2) + '\n', 'utf-8');
execFileSync(process.execPath, [join(root, 'bin/build.mjs')], { stdio: 'inherit' });
console.log('\nwrote data/disposable.json and regenerated generated/');
