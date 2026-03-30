import { describe, it, expect } from 'vitest';
import {
  normalizeTeamName,
  levenshtein,
  generateTeamCode,
  parseCsvRow,
  normalizeCategory,
} from '@/hooks/useEventTeamImport';

// ─── normalizeTeamName ─────────────────────────────────────────────

describe('normalizeTeamName', () => {
  it('converts to lowercase', () => {
    expect(normalizeTeamName('LAS TECHNOVATORS')).toBe('las technovators');
  });

  it('trims whitespace', () => {
    expect(normalizeTeamName('  hello world  ')).toBe('hello world');
  });

  it('collapses multiple spaces into one', () => {
    expect(normalizeTeamName('team   super   star')).toBe('team super star');
  });

  it('handles all transformations combined', () => {
    expect(normalizeTeamName('  LAS   CHICAS   TECH  ')).toBe('las chicas tech');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeTeamName('')).toBe('');
  });

  it('handles single word', () => {
    expect(normalizeTeamName('TEAM')).toBe('team');
  });
});

// ─── levenshtein ───────────────────────────────────────────────────

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length of b for empty a', () => {
    expect(levenshtein('', 'abc')).toBe(3);
  });

  it('returns length of a for empty b', () => {
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('computes single substitution', () => {
    expect(levenshtein('cat', 'car')).toBe(1);
  });

  it('computes single insertion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
  });

  it('computes single deletion', () => {
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('computes known distance for "kitten"/"sitting"', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });

  it('computes known distance for "saturday"/"sunday"', () => {
    expect(levenshtein('saturday', 'sunday')).toBe(3);
  });

  it('early-exits when length difference exceeds maxThreshold', () => {
    // "ab" vs "abcdef" → length diff = 4, threshold = 2 → should return 4 (length diff)
    expect(levenshtein('ab', 'abcdef', 2)).toBe(4);
  });

  it('computes normally when length difference is within maxThreshold', () => {
    expect(levenshtein('cat', 'car', 5)).toBe(1);
  });
});

// ─── generateTeamCode ──────────────────────────────────────────────

describe('generateTeamCode', () => {
  it('generates senior morning codes', () => {
    expect(generateTeamCode('senior', 'morning', 0)).toBe('SM1');
    expect(generateTeamCode('senior', 'morning', 4)).toBe('SM5');
  });

  it('generates junior afternoon codes', () => {
    expect(generateTeamCode('junior', 'afternoon', 0)).toBe('JT1');
    expect(generateTeamCode('junior', 'afternoon', 9)).toBe('JT10');
  });

  it('generates beginner morning codes', () => {
    expect(generateTeamCode('beginner', 'morning', 0)).toBe('BM1');
  });

  it('generates beginner afternoon codes', () => {
    expect(generateTeamCode('beginner', 'afternoon', 2)).toBe('BT3');
  });

  it('handles large index', () => {
    expect(generateTeamCode('senior', 'afternoon', 99)).toBe('ST100');
  });
});

// ─── parseCsvRow ───────────────────────────────────────────────────

describe('parseCsvRow', () => {
  it('parses standard Technovation Global headers (capitalized)', () => {
    const row = {
      'Name': 'Las Innovadoras',
      'Division': 'Senior Division',
      'Team ID': 'TG-12345',
      'Student emails': 'a@b.com, c@d.com',
      'Mentor emails': 'mentor@x.com',
    };
    const result = parseCsvRow(row);
    expect(result.name).toBe('Las Innovadoras');
    expect(result.division).toBe('Senior Division');
    expect(result.teamId).toBe('TG-12345');
    expect(result.studentEmails).toBe('a@b.com, c@d.com');
    expect(result.mentorEmails).toBe('mentor@x.com');
  });

  it('parses lowercase headers', () => {
    const row = {
      'name': 'Tech Girls',
      'division': 'junior',
      'student_emails': 'x@y.com',
      'mentor_emails': '',
    };
    const result = parseCsvRow(row);
    expect(result.name).toBe('Tech Girls');
    expect(result.division).toBe('junior');
    expect(result.teamId).toBeNull();
    expect(result.studentEmails).toBe('x@y.com');
    expect(result.mentorEmails).toBe('');
  });

  it('uses "team" fallback for name column', () => {
    const row = { 'team': 'Equipo Alpha', 'division': 'beginner' };
    const result = parseCsvRow(row as Record<string, string>);
    expect(result.name).toBe('Equipo Alpha');
  });

  it('returns empty strings for completely missing columns', () => {
    const row = {} as Record<string, string>;
    const result = parseCsvRow(row);
    expect(result.name).toBe('');
    expect(result.division).toBe('');
    expect(result.teamId).toBeNull();
    expect(result.studentEmails).toBe('');
    expect(result.mentorEmails).toBe('');
  });

  it('prioritizes "Name" over "name"', () => {
    const row = { 'Name': 'Capitalized', 'name': 'lowercase' };
    const result = parseCsvRow(row);
    expect(result.name).toBe('Capitalized');
  });
});

// ─── normalizeCategory ─────────────────────────────────────────────

describe('normalizeCategory', () => {
  it('normalizes "Senior Division"', () => {
    expect(normalizeCategory('Senior Division')).toBe('senior');
  });

  it('normalizes "Junior Division"', () => {
    expect(normalizeCategory('Junior Division')).toBe('junior');
  });

  it('normalizes "Beginner Division"', () => {
    expect(normalizeCategory('Beginner Division')).toBe('beginner');
  });

  it('handles lowercase', () => {
    expect(normalizeCategory('senior')).toBe('senior');
    expect(normalizeCategory('junior')).toBe('junior');
    expect(normalizeCategory('beginner')).toBe('beginner');
  });

  it('handles mixed case with extra whitespace', () => {
    expect(normalizeCategory('  SENIOR  ')).toBe('senior');
  });

  it('returns null for unrecognized division', () => {
    expect(normalizeCategory('Principiante')).toBeNull();
    expect(normalizeCategory('Advanced')).toBeNull();
    expect(normalizeCategory('')).toBeNull();
  });

  it('matches partial inclusion (e.g. "senioor" contains "senior" → no match because "senior" not included)', () => {
    // "senioor" does NOT contain the substring "senior"
    expect(normalizeCategory('senioor')).toBeNull();
  });

  it('matches when category word is embedded', () => {
    // "This is the senior group" contains "senior"
    expect(normalizeCategory('This is the senior group')).toBe('senior');
  });
});
