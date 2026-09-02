import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEmail, validateEmail, FREE_EMAIL_DOMAINS, COMPETITOR_DOMAINS } from '../src/index.js';
import { classifyEmailLight } from '../src/light.js';
import { createLiveValidator } from '../src/live.js';

test('corporate addresses pass', () => {
  assert.equal(classifyEmail('karan@hubsell.com'), 'ok');
  assert.equal(validateEmail('karan@hubsell.com').ok, true);
});

test('free providers are rejected', () => {
  for (const e of ['karan@gmail.com', 'karan@web.de', 'karan@yahoo.co.uk']) {
    assert.equal(classifyEmail(e), 'free', e);
  }
});

test('competitors are rejected, including sub-domains', () => {
  assert.equal(classifyEmail('karan@apollo.io'), 'blocked');
  assert.equal(classifyEmail('karan@sales.apollo.io'), 'blocked');
  assert.equal(classifyEmail('karan@a.b.apollo.io'), 'blocked');
});

test('manual blocks are rejected', () => {
  assert.equal(classifyEmail('karan@virgilian.com'), 'blocked');
});

test('the free list is exact match only, no sub-domains', () => {
  assert.equal(classifyEmail('karan@foo.gmail.com'), 'ok');
});

test('a domain that merely ends in a blocked string is not blocked', () => {
  assert.equal(classifyEmail('karan@notapollo.io'), 'ok');
});

test('case and whitespace are normalised', () => {
  assert.equal(classifyEmail('  KARAN@GMAIL.COM '), 'free');
});

test('malformed addresses: classifyEmail says ok, validateEmail catches them', () => {
  for (const e of ['karan@example', 'karan@@hubsell.com', 'karan', '']) {
    assert.equal(validateEmail(e).verdict, 'invalid', e);
  }
  assert.equal(classifyEmail('karan@example'), 'ok');
});

test('validateEmail resolves the message', () => {
  assert.match(validateEmail('karan@gmail.com').message, /corporate/i);
  assert.match(validateEmail('karan@apollo.io').message, /restricted/i);
  assert.equal(validateEmail('karan@hubsell.com').message, null);
});

test('the light list agrees with the full list on common cases', () => {
  assert.equal(classifyEmailLight('karan@gmail.com'), 'free');
  assert.equal(classifyEmailLight('karan@apollo.io'), 'blocked');
  assert.equal(classifyEmailLight('karan@hubsell.com'), 'ok');
});

test('lists are populated', () => {
  assert.ok(FREE_EMAIL_DOMAINS.size > 4000);
  assert.ok(COMPETITOR_DOMAINS.length > 40);
});

test('live: falls back to bundled lists when the fetch fails', async () => {
  const v = createLiveValidator({ fetchImpl: async () => { throw new Error('offline'); } });
  const ok = await v.refresh();
  assert.equal(ok, false);
  assert.equal(v.status().source, 'bundled');
  assert.equal(v.classify('karan@gmail.com'), 'free');
});

test('live: a good payload replaces the lists', async () => {
  const payload = {
    version: '9.9.9',
    generatedAt: '2026-01-01T00:00:00.000Z',
    free: Array.from({ length: 1500 }, (_, i) => `free${i}.com`),
    competitors: Array.from({ length: 12 }, (_, i) => `comp${i}.com`),
    blocked: ['freshlyblocked.com'],
  };
  const v = createLiveValidator({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => payload }),
  });
  assert.equal(await v.refresh(), true);
  assert.equal(v.status().source, 'live');
  assert.equal(v.classify('a@freshlyblocked.com'), 'blocked');
  assert.equal(v.classify('a@free7.com'), 'free');
});

test('live: a suspiciously small payload is rejected', async () => {
  const v = createLiveValidator({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ free: ['gmail.com'], competitors: [], blocked: [] }),
    }),
  });
  assert.equal(await v.refresh(), false);
  assert.equal(v.status().source, 'bundled');
  assert.equal(v.classify('karan@apollo.io'), 'blocked');
});

// ---- disposable list ----
import { DISPOSABLE_DOMAINS } from '../src/index.js';

test('disposable addresses get their own verdict and message', () => {
  assert.equal(classifyEmail('karan@mailinator.com'), 'disposable');
  const v = validateEmail('karan@mailinator.com');
  assert.equal(v.ok, false);
  assert.match(v.message, /permanent/i);
});

test('disposable matches sub-domains, per upstream', () => {
  assert.equal(classifyEmail('karan@x.mailinator.com'), 'disposable');
  assert.equal(classifyEmail('karan@a.b.mailinator.com'), 'disposable');
});

test('the disposable list never catches real providers', () => {
  for (const e of ['a@hubsell.com', 'a@microsoft.com', 'a@siemens.com']) {
    assert.notEqual(classifyEmail(e), 'disposable', e);
  }
  assert.equal(classifyEmail('a@gmail.com'), 'free');
  assert.equal(classifyEmail('a@apollo.io'), 'blocked');
});

test('competitor and manual blocks still win over disposable', () => {
  assert.equal(classifyEmail('karan@apollo.io'), 'blocked');
  assert.equal(classifyEmail('karan@virgilian.com'), 'blocked');
});

test('the light entry point never returns disposable', () => {
  assert.equal(classifyEmailLight('karan@mailinator.com'), 'ok');
});

test('the disposable list is big enough to be real', () => {
  assert.ok(DISPOSABLE_DOMAINS.length > 5000);
});

test('live: a payload with a truncated disposable list is rejected', async () => {
  const v = createLiveValidator({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        free: Array.from({ length: 1500 }, (_, i) => `free${i}.com`),
        competitors: Array.from({ length: 12 }, (_, i) => `comp${i}.com`),
        blocked: [],
        disposable: ['mailinator.com'],
      }),
    }),
  });
  assert.equal(await v.refresh(), false);
  assert.equal(v.status().source, 'bundled');
});

test('live: 304 keeps the current lists', async () => {
  const v = createLiveValidator({
    fetchImpl: async () => ({ ok: false, status: 304, headers: { get: () => null } }),
  });
  assert.equal(await v.refresh(), true);
  assert.equal(v.classify('a@mailinator.com'), 'disposable');
});
