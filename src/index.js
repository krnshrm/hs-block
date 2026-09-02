// FULL entry point. Use this on any server. Pulls the complete free-provider and
// disposable lists (thousands of domains each), so never import this into
// browser code.
import { FREE, COMPETITORS, BLOCKED, DISPOSABLE, VERSION, GENERATED_AT } from '../generated/data-full.js';
import { classifyWith, validateWith, classifyDomain, toSet } from './core.js';

export { EMAIL_RE, EMAIL_DOMAIN_MESSAGES, emailDomain } from './core.js';
export const FREE_EMAIL_DOMAINS = new Set(FREE);
export const DISPOSABLE_DOMAINS = DISPOSABLE;
export const COMPETITOR_DOMAINS = COMPETITORS;
export const BLOCKED_DOMAINS = BLOCKED;
export const LIST_VERSION = VERSION;
export const LIST_GENERATED_AT = GENERATED_AT;

const lists = {
  free: FREE_EMAIL_DOMAINS,
  competitors: toSet(COMPETITORS),
  blocked: toSet(BLOCKED),
  disposable: toSet(DISPOSABLE),
};

/** Domain-only verdict: 'ok' | 'blocked' | 'disposable' | 'free'. Malformed input returns 'ok'. */
export function classifyEmail(email) {
  return classifyWith(email, lists);
}

/** Shape check plus domain rules plus message. Prefer this. */
export function validateEmail(email) {
  return validateWith(email, lists);
}

/** Classify a bare domain, no email parsing. */
export function classifyEmailDomain(domain) {
  return classifyDomain(String(domain ?? '').toLowerCase().trim(), lists);
}
