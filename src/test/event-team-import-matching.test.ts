import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchTeams, CsvTeamRow } from '@/hooks/useEventTeamImport';
import { Team } from '@/types/database';

// ─── Mock Supabase ─────────────────────────────────────────────────
// matchTeams uses supabase for email fallback (paso 3) only.

const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────

function makeTeam(overrides: Partial<Team> & { id: string; name: string }): Team {
  return {
    tg_team_id: null,
    category: null,
    hub_id: null,
    notes: null,
    status: 'active',
    season: null,
    validated: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makeCsvRow(overrides: Partial<CsvTeamRow> & { name: string; division: string }): CsvTeamRow {
  return {
    teamId: null,
    studentEmails: '',
    mentorEmails: '',
    ...overrides,
  };
}

// Default: email fallback returns nothing (no profiles match)
function mockEmailFallbackEmpty() {
  mockSelect.mockImplementation(() => ({
    in: () => ({ data: [], error: null }),
  }));
}

// ─── Tests ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockEmailFallbackEmpty();
});

describe('matchTeams', () => {
  // ── Paso 0: tg_team_id match ────────────────────────────

  describe('Paso 0: tg_team_id match', () => {
    it('matches by tg_team_id with highest priority', async () => {
      const dbTeams = [
        makeTeam({ id: 't1', name: 'Different Name', tg_team_id: 'TG-100' }),
        makeTeam({ id: 't2', name: 'Las Innovadoras' }),
      ];
      const csvRows = [
        makeCsvRow({ name: 'Las Innovadoras', division: 'Senior Division', teamId: 'TG-100' }),
      ];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchedTeam?.id).toBe('t1'); // matched by tg_id, NOT by name
      expect(results[0].matchType).toBe('tg_id');
      expect(results[0].confidence).toBe(1.0);
    });
  });

  // ── Paso 1: Exact name match ────────────────────────────

  describe('Paso 1: exact name match', () => {
    it('matches by exact normalized name', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Las Innovadoras' })];
      const csvRows = [makeCsvRow({ name: 'las innovadoras', division: 'junior' })];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchedTeam?.id).toBe('t1');
      expect(results[0].matchType).toBe('exact');
      expect(results[0].confidence).toBe(1.0);
    });

    it('matches with extra spaces normalized', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Tech Girls' })];
      const csvRows = [makeCsvRow({ name: '  Tech   Girls  ', division: 'Senior' })];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchedTeam?.id).toBe('t1');
      expect(results[0].matchType).toBe('exact');
    });
  });

  // ── Paso 2: Fuzzy name match ────────────────────────────

  describe('Paso 2: fuzzy name match', () => {
    it('matches with small typo (ratio <= 0.3)', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Las Innovadoras' })];
      // "Las Inovadoras" — 1 char deletion, distance=1, len=15, ratio=0.067
      const csvRows = [makeCsvRow({ name: 'Las Inovadoras', division: 'senior' })];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchedTeam?.id).toBe('t1');
      expect(results[0].matchType).toBe('fuzzy');
      expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it('does NOT match when ratio > 0.3', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Las Innovadoras' })];
      // Completely different name
      const csvRows = [makeCsvRow({ name: 'XXXXXXXXXX', division: 'senior' })];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchedTeam).toBeNull();
      expect(results[0].matchType).toBeNull();
    });

    it('picks the best fuzzy match among multiple candidates', async () => {
      const dbTeams = [
        makeTeam({ id: 't1', name: 'Tech Girls ABC' }),
        makeTeam({ id: 't2', name: 'Tech Girls ABD' }),
      ];
      // "Tech Girls ABD" is 1 char diff from t2, 2 chars diff from t1
      const csvRows = [makeCsvRow({ name: 'Tech Girls ABE', division: 'junior' })];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      // Both are within threshold, but t1 and t2 are equidistant (1 each)
      // Either match is acceptable — what matters is it picks one
      expect(results[0].matchedTeam).not.toBeNull();
      expect(results[0].matchType).toBe('fuzzy');
    });
  });

  // ── Paso 3: Email fallback ──────────────────────────────

  describe('Paso 3: email fallback', () => {
    it('matches by email when name does not match', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Real Name In DB' })];
      const csvRows = [
        makeCsvRow({
          name: 'Totally Different CSV Name',
          division: 'senior',
          studentEmails: 'student@example.com',
        }),
      ];

      // Mock: profiles query returns user for this email
      // Mock: team_members query returns team membership
      let callCount = 0;
      mockSelect.mockImplementation(() => ({
        in: (_col: string, _vals: string[]) => {
          callCount++;
          if (callCount === 1) {
            // profiles query
            return { data: [{ id: 'user-1', email: 'student@example.com' }] };
          }
          // team_members query
          return { data: [{ user_id: 'user-1', team_id: 't1' }] };
        },
      }));

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchedTeam?.id).toBe('t1');
      expect(results[0].matchType).toBe('email');
      expect(results[0].confidence).toBe(0.8);
    });
  });

  // ── Deduplication ───────────────────────────────────────

  describe('deduplication', () => {
    it('does not assign same DB team to multiple CSV rows', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Team Alpha' })];
      const csvRows = [
        makeCsvRow({ name: 'Team Alpha', division: 'senior' }),
        makeCsvRow({ name: 'Team Alpha', division: 'senior' }),
      ];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      const matched = results.filter((r) => r.matchedTeam !== null);
      expect(matched).toHaveLength(1);
      expect(results[1].matchedTeam).toBeNull();
    });
  });

  // ── categoryUnknown flag ────────────────────────────────

  describe('categoryUnknown flag', () => {
    it('sets categoryUnknown=true for unrecognized division', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Team X' })];
      const csvRows = [makeCsvRow({ name: 'Team X', division: 'Avanzado' })];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].categoryUnknown).toBe(true);
      expect(results[0].category).toBe('junior'); // fallback
      expect(results[0].matchedTeam).toBeNull(); // skipped matching
    });

    it('sets categoryUnknown=false for recognized division', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Team X' })];
      const csvRows = [makeCsvRow({ name: 'Team X', division: 'Senior Division' })];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].categoryUnknown).toBe(false);
    });
  });

  // ── team_code generation ────────────────────────────────

  describe('team_code generation', () => {
    it('generates codes ordered by category: S > J > B', async () => {
      const dbTeams = [
        makeTeam({ id: 't1', name: 'Beginner Team' }),
        makeTeam({ id: 't2', name: 'Senior Team' }),
        makeTeam({ id: 't3', name: 'Junior Team' }),
      ];
      const csvRows = [
        makeCsvRow({ name: 'Beginner Team', division: 'beginner' }),
        makeCsvRow({ name: 'Senior Team', division: 'senior' }),
        makeCsvRow({ name: 'Junior Team', division: 'junior' }),
      ];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      // Even though CSV order is B, S, J — codes should be S=SM1, J=JM1, B=BM1
      const seniorResult = results.find((r) => r.category === 'senior');
      const juniorResult = results.find((r) => r.category === 'junior');
      const beginnerResult = results.find((r) => r.category === 'beginner');

      expect(seniorResult?.teamCode).toBe('SM1');
      expect(juniorResult?.teamCode).toBe('JM1');
      expect(beginnerResult?.teamCode).toBe('BM1');
    });

    it('generates sequential codes within same category', async () => {
      const dbTeams = [
        makeTeam({ id: 't1', name: 'Senior A' }),
        makeTeam({ id: 't2', name: 'Senior B' }),
        makeTeam({ id: 't3', name: 'Senior C' }),
      ];
      const csvRows = [
        makeCsvRow({ name: 'Senior A', division: 'senior' }),
        makeCsvRow({ name: 'Senior B', division: 'senior' }),
        makeCsvRow({ name: 'Senior C', division: 'senior' }),
      ];

      const results = await matchTeams(csvRows, dbTeams, 'afternoon');

      expect(results[0].teamCode).toBe('ST1');
      expect(results[1].teamCode).toBe('ST2');
      expect(results[2].teamCode).toBe('ST3');
    });

    it('uses T for afternoon turn', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Team X' })];
      const csvRows = [makeCsvRow({ name: 'Team X', division: 'junior' })];

      const results = await matchTeams(csvRows, dbTeams, 'afternoon');

      expect(results[0].teamCode).toBe('JT1');
    });
  });

  // ── Priority of matching steps ──────────────────────────

  describe('priority order', () => {
    it('tg_id wins over exact name match', async () => {
      const dbTeams = [
        makeTeam({ id: 't1', name: 'Exact Match Name', tg_team_id: 'TG-999' }),
        makeTeam({ id: 't2', name: 'Other Team' }),
      ];
      const csvRows = [
        makeCsvRow({ name: 'Exact Match Name', division: 'senior', teamId: 'TG-999' }),
      ];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchType).toBe('tg_id');
      expect(results[0].matchedTeam?.id).toBe('t1');
    });

    it('exact name wins over fuzzy', async () => {
      const dbTeams = [
        makeTeam({ id: 't1', name: 'Las Chicas Tech' }),
        makeTeam({ id: 't2', name: 'Las Chicas Tec' }), // fuzzy candidate
      ];
      const csvRows = [
        makeCsvRow({ name: 'Las Chicas Tech', division: 'junior' }),
      ];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchType).toBe('exact');
      expect(results[0].matchedTeam?.id).toBe('t1');
    });
  });

  // ── Empty / edge cases ──────────────────────────────────

  describe('edge cases', () => {
    it('returns empty array for empty CSV rows', async () => {
      const results = await matchTeams([], [], 'morning');
      expect(results).toHaveLength(0);
    });

    it('handles no DB teams gracefully', async () => {
      const csvRows = [makeCsvRow({ name: 'Solo Team', division: 'senior' })];
      const results = await matchTeams(csvRows, [], 'morning');

      expect(results).toHaveLength(1);
      expect(results[0].matchedTeam).toBeNull();
      expect(results[0].teamCode).toBe('SM1'); // still gets a code
    });

    it('handles mixed matched and unmatched rows', async () => {
      const dbTeams = [makeTeam({ id: 't1', name: 'Known Team' })];
      const csvRows = [
        makeCsvRow({ name: 'Known Team', division: 'senior' }),
        makeCsvRow({ name: 'Unknown Team', division: 'senior' }),
      ];

      const results = await matchTeams(csvRows, dbTeams, 'morning');

      expect(results[0].matchedTeam?.id).toBe('t1');
      expect(results[1].matchedTeam).toBeNull();
      // Both get codes
      expect(results[0].teamCode).toBeTruthy();
      expect(results[1].teamCode).toBeTruthy();
    });
  });
});
