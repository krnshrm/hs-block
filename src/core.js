// Pure logic. No domain data lives here, so both the full and the light entry
// points can share it without dragging each other's lists into the bundle.

/** Shape check. Deliberately loose: real validation is delivery, not regex. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** User-facing messages. Single source of truth for every consumer. */
export const EMAIL_DOMAIN_MESSAGES = {
  invalid: 'Please provide a valid email address.',
  blocked: 'This domain is restricted.',
  free: 'Please use your corporate work email.',
};

/** Extract a normalised domain from an email address, or null if malformed. */
export function emailDomain(email) {
  const parts = String(email ?? '').toLowerCase().trim().split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  return parts[1];
}

/** Exact match or any sub-domain. Used for competitor and manual blocks. */
function matchesAny(domain, list) {
  for (const b of list) {
    if (domain === b || domain.endsWith('.' + b)) return true;
  }
  return false;
}

/**
 * Classify a domain against a set of lists.
 * Blocked lists match sub-domains; the free list is exact match only.
 */
export function classifyDomain(domain, lists) {
  if (!domain) return 'ok';
  if (matchesAny(domain, lists.competitors)) return 'blocked';
  if (matchesAny(domain, lists.blocked)) return 'blocked';
  if (lists.free.has ? lists.free.has(domain) : lists.free.includes(domain)) return 'free';
  return 'ok';
}

/**
 * Domain-only verdict. Returns 'ok' for a malformed address, matching the
 * original site behaviour, so callers must run the regex themselves.
 * Prefer validateEmail() in new code.
 */
export function classifyWith(email, lists) {
  return classifyDomain(emailDomain(email), lists);
}

/**
 * The one call most consumers want: shape check plus domain rules, with the
 * message already resolved.
 * Returns { ok, verdict, message, domain } where verdict is
 * 'ok' | 'invalid' | 'free' | 'blocked'.
 */
export function validateWith(email, lists) {
  const raw = String(email ?? '').trim();
  if (!EMAIL_RE.test(raw)) {
    return { ok: false, verdict: 'invalid', message: EMAIL_DOMAIN_MESSAGES.invalid, domain: null };
  }
  const domain = emailDomain(raw);
  const verdict = classifyDomain(domain, lists);
  return {
    ok: verdict === 'ok',
    verdict,
    message: verdict === 'ok' ? null : EMAIL_DOMAIN_MESSAGES[verdict],
    domain,
  };
}
