// LIVE entry point. This is what makes a block take effect without deploying
// the app. It starts from the lists bundled in this package (the floor: always
// present, works offline) and periodically replaces them with the published
// JSON from the repo's main branch.
//
// Server-side only. It imports the full list.
import { FREE, COMPETITORS, BLOCKED, DISPOSABLE, VERSION, GENERATED_AT } from '../generated/data-full.js';
import { classifyDomain, validateWith, emailDomain, toSet } from './core.js';

export const LIVE_URL =
  'https://raw.githubusercontent.com/krnshrm/hs-block/main/generated/email-domains.json';

// Sanity floors. A truncated or half-written file must never silently wipe the
// block lists, so a payload that looks wrong is rejected and the previous
// lists stay in place.
const MIN_FREE = 1000;
const MIN_COMPETITORS = 10;
const MIN_DISPOSABLE = 5000;

function shapeOk(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const { free, competitors, blocked, disposable } = payload;
  if (!Array.isArray(free) || !Array.isArray(competitors) || !Array.isArray(blocked)) return false;
  if (free.length < MIN_FREE || competitors.length < MIN_COMPETITORS) return false;
  // disposable may be absent on an older payload; if present it must be sane.
  if (disposable !== undefined) {
    if (!Array.isArray(disposable) || disposable.length < MIN_DISPOSABLE) return false;
  }
  return true;
}

/**
 * Create a validator that keeps itself up to date.
 *
 *   const emails = createLiveValidator();
 *   await emails.refresh();            // optional: warm it on boot
 *   emails.start();                    // background refresh
 *   const v = emails.validate(input);  // { ok, verdict, message, domain }
 *
 * Options:
 *   url         where to fetch the published list from
 *   intervalMs  refresh period, default 5 minutes
 *   fetchImpl   inject a fetch for tests
 *   onError     called with the error when a refresh fails
 *   onUpdate    called with { version, generatedAt, counts } after a swap
 */
export function createLiveValidator(options = {}) {
  const {
    url = LIVE_URL,
    intervalMs = 5 * 60 * 1000,
    fetchImpl = globalThis.fetch,
    onError = null,
    onUpdate = null,
  } = options;

  let lists = {
    free: new Set(FREE),
    competitors: toSet(COMPETITORS),
    blocked: toSet(BLOCKED),
    disposable: toSet(DISPOSABLE),
  };
  let meta = {
    source: 'bundled',
    version: VERSION,
    generatedAt: GENERATED_AT,
    lastRefresh: null,
    lastError: null,
  };
  let etag = null;
  let timer = null;

  async function refresh() {
    if (typeof fetchImpl !== 'function') {
      throw new Error('hs-block/live: no fetch available. Pass options.fetchImpl.');
    }
    try {
      const headers = { accept: 'application/json' };
      // The payload is a few hundred KB and rarely changes, so ask for it only
      // when it actually has.
      if (etag) headers['if-none-match'] = etag;

      const res = await fetchImpl(url, { headers, cache: 'no-store' });

      if (res.status === 304) {
        meta = { ...meta, lastRefresh: new Date().toISOString(), lastError: null };
        return true;
      }
      if (!res.ok) throw new Error(`hs-block/live: HTTP ${res.status} from ${url}`);

      const payload = await res.json();
      if (!shapeOk(payload)) throw new Error('hs-block/live: payload failed sanity checks');

      etag = (res.headers && typeof res.headers.get === 'function' && res.headers.get('etag')) || null;

      lists = {
        free: new Set(payload.free),
        competitors: toSet(payload.competitors),
        blocked: toSet(payload.blocked),
        // A payload with no disposable list is an older one: keep the bundled
        // list rather than silently dropping the rule.
        disposable: payload.disposable ? toSet(payload.disposable) : toSet(DISPOSABLE),
      };
      meta = {
        source: 'live',
        version: payload.version ?? null,
        generatedAt: payload.generatedAt ?? null,
        lastRefresh: new Date().toISOString(),
        lastError: null,
      };
      if (onUpdate) {
        onUpdate({
          version: meta.version,
          generatedAt: meta.generatedAt,
          counts: {
            free: lists.free.size,
            competitors: lists.competitors.size,
            blocked: lists.blocked.size,
            disposable: lists.disposable.size,
          },
        });
      }
      return true;
    } catch (err) {
      // Keep serving whatever we already have. A stale list still blocks.
      meta = { ...meta, lastError: String(err && err.message ? err.message : err) };
      if (onError) onError(err);
      return false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => { refresh(); }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    refresh();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    refresh,
    start,
    stop,
    status: () => ({
      ...meta,
      url,
      intervalMs,
      counts: {
        free: lists.free.size,
        competitors: lists.competitors.size,
        blocked: lists.blocked.size,
        disposable: lists.disposable.size,
      },
    }),
    classify: (email) => classifyDomain(emailDomain(email), lists),
    validate: (email) => validateWith(email, lists),
  };
}
