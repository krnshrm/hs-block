#!/usr/bin/env node
// Add or remove blocked domains, then regenerate generated/.
//
//   npm run block -- baddomain.com throwaway.io
//   npm run block:competitor -- newcompetitor.com
//   npm run block -- --remove baddomain.com
//   npm run block:competitor -- --remove oldcompetitor.com
//
// Editing data/blocked.json or data/competitors.json by hand works too, as long
// as you run npm run build afterwards.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const raw = process.argv.slice(2);
const competitorMode = raw.includes('--competitor');
const removeMode = raw.includes('--remove');
const domains = raw
  .filter((a) => !a.startsWith('--'))
  .map((d) => d.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''));

if (!domains.length) {
  console.error('Usage: npm run block -- domain.com [more...]');
  console.error('       npm run block:competitor -- domain.com [more...]');
  console.error('       npm run block -- --remove domain.com');
  process.exit(1);
}

for (const d of domains) {
  if (!d.includes('.') || /\s/.test(d)) {
    console.error(`not a domain: ${d}`);
    process.exit(1);
  }
}

const file = competitorMode ? 'data/competitors.json' : 'data/blocked.json';
const otherFile = competitorMode ? 'data/blocked.json' : 'data/competitors.json';
const label = competitorMode ? 'competitor' : 'blocked';

const path = join(root, file);
const list = new Set(JSON.parse(readFileSync(path, 'utf-8')));
const other = new Set(JSON.parse(readFileSync(join(root, otherFile), 'utf-8')));

const changed = [];
for (const d of domains) {
  if (removeMode) {
    if (!list.has(d)) {
      console.log(`not on the ${label} list: ${d}`);
      continue;
    }
    list.delete(d);
    changed.push(d);
    continue;
  }
  if (list.has(d)) {
    console.log(`already ${label}: ${d}`);
    continue;
  }
  if (other.has(d)) {
    console.log(`already on the other list, skipping: ${d}`);
    continue;
  }
  list.add(d);
  changed.push(d);
}

if (!changed.length) {
  console.log('nothing to do.');
  process.exit(0);
}

writeFileSync(path, JSON.stringify([...list].sort(), null, 2) + '\n', 'utf-8');
console.log(`${removeMode ? 'removed from' : 'added to'} ${file}: ${changed.join(', ')}`);

execFileSync(process.execPath, [join(root, 'bin/build.mjs')], { stdio: 'inherit' });

console.log('\nNext:');
console.log('  git add data generated');
console.log(`  git commit -m "${removeMode ? 'Unblock' : 'Block'}: ${changed.join(', ')}"`);
console.log('  git push');
console.log('\nThe app picks this up within its refresh window. No deploy needed.');
