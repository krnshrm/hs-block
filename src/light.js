// LIGHT entry point. Safe for browser bundles: carries only the curated common
// free providers plus the competitor and manual block lists. Instant UX
// feedback only. The server must re-check with the full entry point, because
// anything running in a browser can be bypassed with devtools.
import { COMMON_FREE, COMPETITORS, BLOCKED, VERSION } from '../generated/data-light.js';
import { classifyWith, validateWith } from './core.js';

export { EMAIL_RE, EMAIL_DOMAIN_MESSAGES, emailDomain } from './core.js';
export const COMMON_FREE_DOMAINS = new Set(COMMON_FREE);
export const COMPETITOR_DOMAINS = COMPETITORS;
export const BLOCKED_DOMAINS = BLOCKED;
export const LIST_VERSION = VERSION;

const lists = { free: COMMON_FREE_DOMAINS, competitors: COMPETITORS, blocked: BLOCKED };

/** Domain-only verdict against the small list. UX only. */
export function classifyEmailLight(email) {
  return classifyWith(email, lists);
}

/** Shape check plus small-list domain rules plus message. UX only. */
export function validateEmailLight(email) {
  return validateWith(email, lists);
}
