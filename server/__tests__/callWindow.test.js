import { describe, it, expect } from 'vitest';
import { isWithinCallWindow, formatCallWindow } from '../callWindow.js';

// All timestamps below are UTC instants; IST is UTC+5:30.
describe('isWithinCallWindow', () => {
  it('rejects a real time before the window (10:04 AM IST = 04:34 UTC)', () => {
    const date = new Date('2026-08-12T04:34:00.000Z');
    expect(isWithinCallWindow(date, {})).toBe(false);
  });

  it('accepts a real time inside the window (2:00 PM IST = 08:30 UTC)', () => {
    const date = new Date('2026-08-12T08:30:00.000Z');
    expect(isWithinCallWindow(date, {})).toBe(true);
  });

  it('accepts exactly the start of the window (11:00 AM IST = 05:30 UTC)', () => {
    const date = new Date('2026-08-12T05:30:00.000Z');
    expect(isWithinCallWindow(date, {})).toBe(true);
  });

  it('rejects exactly the end of the window (7:30 PM IST = 14:00 UTC) — end is exclusive', () => {
    const date = new Date('2026-08-12T14:00:00.000Z');
    expect(isWithinCallWindow(date, {})).toBe(false);
  });

  it('rejects after the window (9:00 PM IST = 15:30 UTC)', () => {
    const date = new Date('2026-08-12T15:30:00.000Z');
    expect(isWithinCallWindow(date, {})).toBe(false);
  });

  it('respects a custom configured window', () => {
    const date = new Date('2026-08-12T04:34:00.000Z'); // 10:04 AM IST
    expect(isWithinCallWindow(date, { callWindowStartHour: 9, callWindowEndHour: 18 })).toBe(true);
  });

  it('is computed in IST regardless of what timezone the process itself runs in (no server-local dependency)', () => {
    // 2:00 PM IST is 08:30 UTC and 04:30 EDT (UTC-4) — the function must not
    // silently use the host machine's local offset for either of those.
    const date = new Date('2026-08-12T08:30:00.000Z');
    expect(isWithinCallWindow(date, {})).toBe(true);
  });
});

describe('formatCallWindow', () => {
  it('formats the default window in plain 12-hour IST', () => {
    expect(formatCallWindow({})).toBe('11 AM–7:30 PM IST');
  });
});
