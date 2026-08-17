export type EmailDomainVerdict = 'ok' | 'free' | 'blocked';
export type EmailVerdict = EmailDomainVerdict | 'invalid';

export interface EmailValidation {
  ok: boolean;
  verdict: EmailVerdict;
  message: string | null;
  domain: string | null;
}

export const EMAIL_RE: RegExp;
export const EMAIL_DOMAIN_MESSAGES: {
  readonly invalid: string;
  readonly blocked: string;
  readonly free: string;
};
export function emailDomain(email: string): string | null;
