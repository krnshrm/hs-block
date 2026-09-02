// LIGHT entry point. Safe for browser bundles: carries only the curated common
// free providers plus the competitor and manual block lists. Instant UX
// feedback only. The server must re-check with the full entry point, because
// anything running in a browser can be bypassed with devtools.
//
// The disposable list is deliberately NOT here. At thousands of domains it
// would dominate the page weight, so disposable addresses are caught on submit
// by the server rather than as you type.
import { COMMON_FREE, COMPETITORS, BLOCKED, VERSION } from '../generated/data-light.js';
import { classifyWith, validateWith, toSet } from './core.js';

export { EMAIL_RE, EMAIL_DOMAIN_MESSAGES, emailDomain } from './core.js';
export const COMMON_FREE_DOMAINS = new Set(COMMON_FREE);
export const COMPETITOR_DOMAINS = COMPETITORS;
export const BLOCKED_DOMAINS = BLOCKED;
export const LIST_VERSION = VERSION;

const lists = {
  free: COMMON_FREE_DOMAINS,
  competitors: toSet(COMPETITORS),
  blocked: toSet(BLOCKED),
  disposable: null,
};

/** Domain-only verdict against the small list. UX only, never returns 'disposable'. */
export function classifyEmailLight(email) {
  return classifyWith(email, lists);
}

/** Shape check plus small-list domain rules plus message. UX only. */
export function validateEmailLight(email) {
  return validateWith(email, lists);
}
