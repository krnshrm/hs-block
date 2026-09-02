export * from './core.js';
import type { EmailDomainVerdict, EmailValidation } from './core.js';

export const COMMON_FREE_DOMAINS: ReadonlySet<string>;
export const COMPETITOR_DOMAINS: readonly string[];
export const BLOCKED_DOMAINS: readonly string[];
export const LIST_VERSION: string;

/** UX-only verdict against the small curated list. Never returns 'disposable'. */
export function classifyEmailLight(email: string): EmailDomainVerdict;
/** UX-only shape check plus small-list rules. Never authoritative. */
export function validateEmailLight(email: string): EmailValidation;
