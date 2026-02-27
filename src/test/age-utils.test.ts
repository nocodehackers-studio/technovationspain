import { describe, it, expect } from 'vitest';
import { getCycleReferenceDate, isMinor, calculateAge } from '@/lib/age-utils';

describe('getCycleReferenceDate', () => {
  it('returns previous year Aug 1 when in January', () => {
    expect(getCycleReferenceDate(new Date('2026-01-15T12:00:00Z'))).toBe('2025-08-01');
  });

  it('returns previous year Aug 1 when in July', () => {
    expect(getCycleReferenceDate(new Date('2026-07-15T12:00:00Z'))).toBe('2025-08-01');
  });

  it('returns previous year Aug 1 at last moment before cycle flip (July 31 23:59:59 UTC)', () => {
    expect(getCycleReferenceDate(new Date('2026-07-31T23:59:59Z'))).toBe('2025-08-01');
  });

  it('returns current year Aug 1 at first moment of new cycle (August 1 00:00:00 UTC)', () => {
    expect(getCycleReferenceDate(new Date('2026-08-01T00:00:00Z'))).toBe('2026-08-01');
  });

  it('returns current year Aug 1 when in August', () => {
    expect(getCycleReferenceDate(new Date('2026-08-15T12:00:00Z'))).toBe('2026-08-01');
  });

  it('returns current year Aug 1 when in December', () => {
    expect(getCycleReferenceDate(new Date('2026-12-15T12:00:00Z'))).toBe('2026-08-01');
  });
});

describe('isMinor (cycle-based integration)', () => {
  // Simulate being within the cycle Aug 1 2025 → Jul 31 2026
  // by passing `now` in Jan 2026 → getCycleReferenceDate returns "2025-08-01"
  const duringCycle = new Date('2026-01-15T12:00:00Z');

  it('born 2011-07-15: age at Aug 1 2025 = 14 → adult (false)', () => {
    expect(isMinor('2011-07-15', duringCycle)).toBe(false);
  });

  it('born 2011-08-01: age at Aug 1 2025 = 14 (birthday matches reference exactly) → adult', () => {
    expect(isMinor('2011-08-01', duringCycle)).toBe(false);
  });

  it('born 2011-08-02: age at Aug 1 2025 = 13 → minor (true)', () => {
    expect(isMinor('2011-08-02', duringCycle)).toBe(true);
  });

  it('born 2012-07-15: age at Aug 1 2025 = 13 → minor (true)', () => {
    expect(isMinor('2012-07-15', duringCycle)).toBe(true);
  });

  it('null birthDate → isMinor returns true (safe default)', () => {
    expect(isMinor(null)).toBe(true);
  });

  it('undefined birthDate → isMinor returns true (safe default)', () => {
    expect(isMinor(undefined)).toBe(true);
  });

  it('malformed birthDate → isMinor returns true (safe default)', () => {
    expect(isMinor('not-a-date', duringCycle)).toBe(true);
  });
});

describe('calculateAge', () => {
  it('works with explicit referenceDate', () => {
    expect(calculateAge('2011-07-15', '2025-08-01')).toBe(14);
  });

  it('works with no referenceDate (uses today, age is reasonable)', () => {
    const expectedAge = new Date().getUTCFullYear() - 2010;
    const age = calculateAge('2010-01-01');
    expect(age).toBeGreaterThanOrEqual(expectedAge - 1);
    expect(age).toBeLessThanOrEqual(expectedAge);
  });

  it('returns -1 for null birthDate', () => {
    expect(calculateAge(null)).toBe(-1);
  });

  it('returns -1 for undefined birthDate', () => {
    expect(calculateAge(undefined)).toBe(-1);
  });

  it('returns -1 for malformed birthDate string', () => {
    expect(calculateAge('not-a-date')).toBe(-1);
    expect(calculateAge('9999-99-99')).toBe(-1);
    expect(calculateAge('abc')).toBe(-1);
  });
});
