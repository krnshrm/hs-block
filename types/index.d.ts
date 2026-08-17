export * from './core.js';
import type { EmailDomainVerdict, EmailValidation } from './core.js';

export const FREE_EMAIL_DOMAINS: ReadonlySet<string>;
export const COMPETITOR_DOMAINS: readonly string[];
export const BLOCKED_DOMAINS: readonly string[];
export const LIST_VERSION: string;
export const LIST_GENERATED_AT: string;

/** Domain-only verdict. Malformed input returns 'ok'; run the regex yourself. */
export function classifyEmail(email: string): EmailDomainVerdict;
/** Shape check plus domain rules plus resolved message. Prefer this. */
export function validateEmail(email: string): EmailValidation;
/** Classify a bare domain with no email parsing. */
export function classifyEmailDomain(domain: string): EmailDomainVerdict;
