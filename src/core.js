// Pure logic. No domain data lives here, so both the full and the light entry
// points can share it without dragging each other's lists into the bundle.

/** Shape check. Deliberately loose: real validation is delivery, not regex. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** User-facing messages. Single source of truth for every consumer. */
export const EMAIL_DOMAIN_MESSAGES = {
  invalid: 'Please provide a valid email address.',
  blocked: 'This domain is restricted.',
  disposable: 'Please use a permanent work email address.',
  free: 'Please use your corporate work email.',
};

/** Extract a normalised domain from an email address, or null if malformed. */
export function emailDomain(email) {
  const parts = String(email ?? '').toLowerCase().trim().split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  return parts[1];
}

/** Accept an array or a Set, always return a Set. */
export function toSet(list) {
  return list instanceof Set ? list : new Set(list ?? []);
}

/**
 * Match a domain or any of its parents against a set: a.b.mailinator.com walks
 * b.mailinator.com then mailinator.com. A bare TLD is never checked. This is a
 * handful of Set lookups rather than a scan of the whole list, which matters
 * now that the disposable list is thousands of entries long.
 */
function matchesSuffix(domain, set) {
  let d = domain;
  while (d.includes('.')) {
    if (set.has(d)) return true;
    d = d.slice(d.indexOf('.') + 1);
  }
  return false;
}

/**
 * Classify a domain against a set of lists.
 *
 * Competitor, manual and disposable lists match sub-domains, because upstream
 * publishes second-level domains and expects x.mailinator.com to hit
 * mailinator.com. The free list is exact match only, so foo.gmail.com is not
 * treated as a free provider.
 *
 * Order matters: the first list to match decides which message the person sees.
 * Disposable is checked before free, so the handful of domains on both lists
 * get the more accurate "permanent address" message.
 */
export function classifyDomain(domain, lists) {
  if (!domain) return 'ok';
  if (matchesSuffix(domain, lists.competitors)) return 'blocked';
  if (matchesSuffix(domain, lists.blocked)) return 'blocked';
  if (lists.disposable && matchesSuffix(domain, lists.disposable)) return 'disposable';
  if (lists.free.has(domain)) return 'free';
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
 * 'ok' | 'invalid' | 'blocked' | 'disposable' | 'free'.
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
