// Omnidimension caps simultaneous calls. Real incident 2026-10-08: a 5-lead batch
// returned 1 success + 4 `concurrency_limit_exceeded`. Without this guard the
// autonomous sweep would fire hundreds of doomed requests at their API every
// 5 minutes once the ceiling is hit.
import { describe, it, expect } from 'vitest';
import { isConcurrencyLimit } from '../scheduler.js';

describe('isConcurrencyLimit', () => {
  it('detects the real Omnidimension rejection', () => {
    expect(isConcurrencyLimit(new Error('concurrency_limit_exceeded'))).toBe(true);
  });

  it('detects it inside a larger JSON error body', () => {
    expect(isConcurrencyLimit(new Error('{"error":"concurrency_limit_exceeded","detail":"too many"}'))).toBe(true);
  });

  it('detects the human-readable phrasing too', () => {
    expect(isConcurrencyLimit(new Error('Concurrency limit reached for your plan'))).toBe(true);
  });

  it('does NOT trip on unrelated failures, which must keep the sweep going', () => {
    expect(isConcurrencyLimit(new Error('Lead not found'))).toBe(false);
    expect(isConcurrencyLimit(new Error('invalid phone number'))).toBe(false);
    expect(isConcurrencyLimit(new Error('500 server error'))).toBe(false);
  });

  it('handles a missing/!malformed error object without throwing', () => {
    expect(isConcurrencyLimit(undefined)).toBe(false);
    expect(isConcurrencyLimit({})).toBe(false);
  });
});
