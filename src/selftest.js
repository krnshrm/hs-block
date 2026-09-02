// Shared self-test. Both consumers run this so a stale pin, a bad install or a
// broken list fails loudly instead of silently letting addresses through.
//
// It checks behaviour rather than version numbers, because the version is not
// what breaks. The website pinned v1.0.0 in its lockfile while package.json
// said v1.1.0, and every disposable address was accepted for a day.
//
//   import { validateEmail, DISPOSABLE_DOMAINS } from 'hs-block';
//   import { assertRules } from 'hs-block/selftest';
//   assertRules(validateEmail, { disposable: DISPOSABLE_DOMAINS.length });

/**
 * required: true  → a failure means the rules are genuinely broken.
 * required: false → a failure probably means upstream dropped the domain.
 *                   Reported as a warning so it never blocks a deploy.
 */
export const FIXTURES = [
  { email: 'karan@hubsell.com', verdict: 'ok', required: true, why: 'our own domain must always pass' },
  { email: 'karan@gmail.com', verdict: 'free', required: true, why: 'free provider list is loaded' },
  { email: 'karan@web.de', verdict: 'free', required: true, why: 'free list is the full one, not the small client list' },
  { email: 'karan@foo.gmail.com', verdict: 'ok', required: true, why: 'free list is exact match, not sub-domain' },
  { email: 'karan@apollo.io', verdict: 'blocked', required: true, why: 'competitor list is loaded' },
  { email: 'karan@sales.apollo.io', verdict: 'blocked', required: true, why: 'competitor sub-domain matching works' },
  { email: 'karan@mailinator.com', verdict: 'disposable', required: true, why: 'disposable list is loaded' },
  { email: 'karan@x.mailinator.com', verdict: 'disposable', required: true, why: 'disposable sub-domain matching works' },
  { email: 'karan@example', verdict: 'invalid', required: true, why: 'malformed addresses are caught' },
  { email: 'karan@@hubsell.com', verdict: 'invalid', required: true, why: 'malformed addresses are caught' },
  // The two that got through in production on 2 Sep 2026. Kept as a regression
  // check, but not required: upstream is free to drop them.
  { email: 'karan@alwayss.uno', verdict: 'disposable', required: false, why: 'regression: reported live' },
  { email: 'karan@aprte.com', verdict: 'disposable', required: false, why: 'regression: reported live' },
];

/** Minimum plausible list sizes. Anything below means a list failed to load. */
export const MIN_COUNTS = {
  free: 4000,
  competitors: 40,
  disposable: 5000,
};

/**
 * Run the fixtures against a validate function of the shape
 * (email) => { verdict, ... }, as returned by validateEmail or a live
 * validator's validate().
 *
 * counts is optional: { free, competitors, disposable } list sizes.
 * Returns { failures, warnings, passed }.
 */
export function runSelfTest(validate, counts = null) {
  const failures = [];
  const warnings = [];
  let passed = 0;

  for (const f of FIXTURES) {
    let actual;
    try {
      actual = validate(f.email).verdict;
    } catch (err) {
      actual = `threw: ${err && err.message ? err.message : err}`;
    }
    if (actual === f.verdict) {
      passed += 1;
      continue;
    }
    const detail = `${f.email}: expected ${f.verdict}, got ${actual} (${f.why})`;
    (f.required ? failures : warnings).push(detail);
  }

  if (counts) {
    for (const [name, min] of Object.entries(MIN_COUNTS)) {
      const n = counts[name];
      if (typeof n === 'number' && n < min) {
        failures.push(`${name} list has ${n} entries, expected at least ${min}`);
      }
    }
  }

  return { failures, warnings, passed };
}

/** Same as runSelfTest but throws on any required failure. */
export function assertRules(validate, counts = null) {
  const result = runSelfTest(validate, counts);
  if (result.failures.length) {
    const err = new Error(
      `hs-block self-test failed:\n  ${result.failures.join('\n  ')}`,
    );
    err.failures = result.failures;
    err.warnings = result.warnings;
    throw err;
  }
  return result;
}
