// LIVE entry point. This is what makes a block take effect without deploying
// the app. It starts from the lists bundled in this package (the floor: always
// present, works offline) and periodically replaces them with the published
// JSON from the repo's main branch.
//
// Server-side only. It imports the full list.
import { FREE, COMPETITORS, BLOCKED, VERSION, GENERATED_AT } from '../generated/data-full.js';
import { classifyDomain, validateWith, emailDomain } from './core.js';

export const LIVE_URL =
  'https://raw.githubusercontent.com/krnshrm/hs-block/main/generated/email-domains.json';

// Sanity floors. A truncated or half-written file must never silently wipe the
// block lists, so a payload that looks wrong is rejected and the previous
// lists stay in place.
const MIN_FREE = 1000;
const MIN_COMPETITORS = 10;

function shapeOk(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const { free, competitors, blocked } = payload;
  if (!Array.isArray(free) || !Array.isArray(competitors) || !Array.isArray(blocked)) return false;
  if (free.length < MIN_FREE || competitors.length < MIN_COMPETITORS) return false;
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
    competitors: COMPETITORS,
    blocked: BLOCKED,
  };
  let meta = {
    source: 'bundled',
    version: VERSION,
    generatedAt: GENERATED_AT,
    lastRefresh: null,
    lastError: null,
  };
  let timer = null;

  async function refresh() {
    if (typeof fetchImpl !== 'function') {
      throw new Error('hs-block/live: no fetch available. Pass options.fetchImpl.');
    }
    try {
      const res = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`hs-block/live: HTTP ${res.status} from ${url}`);
      const payload = await res.json();
      if (!shapeOk(payload)) throw new Error('hs-block/live: payload failed sanity checks');

      lists = {
        free: new Set(payload.free),
        competitors: payload.competitors,
        blocked: payload.blocked,
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
            free: payload.free.length,
            competitors: payload.competitors.length,
            blocked: payload.blocked.length,
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
    status: () => ({ ...meta, url, intervalMs }),
    classify: (email) => classifyDomain(emailDomain(email), lists),
    validate: (email) => validateWith(email, lists),
  };
}
