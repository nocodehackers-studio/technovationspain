import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  clearAttempts,
  clearAuth,
  getLockoutStatus,
  getRecentAttempts,
  isAuthenticated,
  markAuthenticated,
  recordAttempt,
} from '@/lib/escaletaAccess';

const TOKEN = 'tkn-test-1234';
const OTHER_TOKEN = 'tkn-test-other';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('escaletaAccess - attempts ledger', () => {
  it('returns empty array when nothing recorded', () => {
    expect(getRecentAttempts(TOKEN)).toEqual([]);
  });

  it('records attempts and returns them in order', () => {
    const now = 1_000_000_000;
    recordAttempt(TOKEN, now);
    recordAttempt(TOKEN, now + 1000);
    expect(getRecentAttempts(TOKEN, now + 1500)).toEqual([now, now + 1000]);
  });

  it('filters out attempts older than the 15-minute window', () => {
    const now = 2_000_000_000;
    recordAttempt(TOKEN, now);
    recordAttempt(TOKEN, now + 60_000);
    // Advance time so the first attempt falls outside the window
    const future = now + LOCKOUT_MS + 1;
    expect(getRecentAttempts(TOKEN, future)).toEqual([now + 60_000]);
  });

  it('isolates attempts per token', () => {
    const now = 3_000_000_000;
    recordAttempt(TOKEN, now);
    expect(getRecentAttempts(OTHER_TOKEN, now)).toEqual([]);
  });

  it('clearAttempts removes the entry for a token', () => {
    const now = 4_000_000_000;
    recordAttempt(TOKEN, now);
    clearAttempts(TOKEN);
    expect(getRecentAttempts(TOKEN, now)).toEqual([]);
  });
});

describe('escaletaAccess - lockout status', () => {
  it('reports unlocked with full attempts when nothing recorded', () => {
    const status = getLockoutStatus(TOKEN);
    expect(status.locked).toBe(false);
    expect(status.attemptsLeft).toBe(MAX_ATTEMPTS);
    expect(status.secondsRemaining).toBe(0);
  });

  it('counts down attemptsLeft as failures accumulate', () => {
    const now = 5_000_000_000;
    for (let i = 0; i < 4; i++) {
      recordAttempt(TOKEN, now + i * 1000);
    }
    const status = getLockoutStatus(TOKEN, now + 4000);
    expect(status.locked).toBe(false);
    expect(status.attemptsLeft).toBe(1);
  });

  it('locks out after MAX_ATTEMPTS within the window', () => {
    const now = 6_000_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordAttempt(TOKEN, now + i * 1000);
    }
    const status = getLockoutStatus(TOKEN, now + MAX_ATTEMPTS * 1000);
    expect(status.locked).toBe(true);
    expect(status.attemptsLeft).toBe(0);
    expect(status.secondsRemaining).toBeGreaterThan(0);
  });

  it('reopens once attempts age out of the window', () => {
    const now = 7_000_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordAttempt(TOKEN, now + i * 1000);
    }
    const future = now + LOCKOUT_MS + 10_000;
    const status = getLockoutStatus(TOKEN, future);
    expect(status.locked).toBe(false);
    expect(status.attemptsLeft).toBe(MAX_ATTEMPTS);
  });
});

describe('escaletaAccess - session marker', () => {
  it('roundtrips markAuthenticated / isAuthenticated / clearAuth', () => {
    expect(isAuthenticated(TOKEN)).toBe(false);
    markAuthenticated(TOKEN);
    expect(isAuthenticated(TOKEN)).toBe(true);
    clearAuth(TOKEN);
    expect(isAuthenticated(TOKEN)).toBe(false);
  });

  it('isolates session per token', () => {
    markAuthenticated(TOKEN);
    expect(isAuthenticated(OTHER_TOKEN)).toBe(false);
  });
});
