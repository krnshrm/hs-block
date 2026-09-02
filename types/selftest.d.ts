import type { EmailValidation } from './core.js';

export interface Fixture {
  email: string;
  verdict: string;
  required: boolean;
  why: string;
}

export interface SelfTestResult {
  failures: string[];
  warnings: string[];
  passed: number;
}

export interface ListCounts {
  free?: number;
  competitors?: number;
  disposable?: number;
}

export const FIXTURES: readonly Fixture[];
export const MIN_COUNTS: { free: number; competitors: number; disposable: number };

/** Run the fixtures against a validate function. Never throws. */
export function runSelfTest(
  validate: (email: string) => EmailValidation,
  counts?: ListCounts | null,
): SelfTestResult;

/** Same as runSelfTest but throws on any required failure. */
export function assertRules(
  validate: (email: string) => EmailValidation,
  counts?: ListCounts | null,
): SelfTestResult;
