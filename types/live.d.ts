import type { EmailDomainVerdict, EmailValidation } from './core.js';

export const LIVE_URL: string;

export interface LiveStatus {
  source: 'bundled' | 'live';
  version: string | null;
  generatedAt: string | null;
  lastRefresh: string | null;
  lastError: string | null;
  url: string;
  intervalMs: number;
}

export interface LiveUpdate {
  version: string | null;
  generatedAt: string | null;
  counts: { free: number; competitors: number; blocked: number };
}

export interface LiveOptions {
  url?: string;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
  onError?: (err: unknown) => void;
  onUpdate?: (info: LiveUpdate) => void;
}

export interface LiveValidator {
  refresh(): Promise<boolean>;
  start(): void;
  stop(): void;
  status(): LiveStatus;
  classify(email: string): EmailDomainVerdict;
  validate(email: string): EmailValidation;
}

export function createLiveValidator(options?: LiveOptions): LiveValidator;
