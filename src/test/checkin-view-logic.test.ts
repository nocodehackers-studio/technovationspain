import { describe, it, expect } from 'vitest';
import type { JudgeCheckinItem, TeamCheckinItem } from '@/hooks/useCheckinStatus';

// ─── Pure logic extracted from EventCheckinView for testing ─────────

function filterJudges(list: JudgeCheckinItem[], search: string): JudgeCheckinItem[] {
  return list
    .filter(j => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (j.firstName || '').toLowerCase().includes(q) ||
        (j.lastName || '').toLowerCase().includes(q) ||
        (j.email || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aChecked = a.checkedInAt ? 1 : 0;
      const bChecked = b.checkedInAt ? 1 : 0;
      if (aChecked !== bChecked) return bChecked - aChecked;
      const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return aName.localeCompare(bName);
    });
}

function filterTeams(list: TeamCheckinItem[], search: string): TeamCheckinItem[] {
  return list
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.teamCode.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aArrived = (a.checkedInAt || a.participantCheckedIn) ? 1 : 0;
      const bArrived = (b.checkedInAt || b.participantCheckedIn) ? 1 : 0;
      if (aArrived !== bArrived) return bArrived - aArrived;
      return a.teamCode.localeCompare(b.teamCode);
    });
}

function getTeamVia(team: TeamCheckinItem): string {
  const isArrived = team.checkedInAt !== null || team.participantCheckedIn;
  const isAutoOnly = !team.checkedInAt && team.participantCheckedIn;
  if (!isArrived) return '—';
  if (isAutoOnly) return 'QR participante';
  if (team.checkedInAt && team.participantCheckedIn) return 'Manual + QR';
  return 'Manual';
}

// ─── Test Data ──────────────────────────────────────────────────────

const judges: JudgeCheckinItem[] = [
  { registrationId: 'r1', userId: 'u1', firstName: 'María', lastName: 'García', email: 'maria@test.com', checkedInAt: '2026-04-10T10:00:00Z', checkedInBy: null },
  { registrationId: 'r2', userId: 'u2', firstName: 'Pedro', lastName: 'López', email: 'pedro@test.com', checkedInAt: null, checkedInBy: null },
  { registrationId: 'r3', userId: 'u3', firstName: 'Ana', lastName: 'Martínez', email: 'ana@test.com', checkedInAt: '2026-04-10T10:05:00Z', checkedInBy: null },
  { registrationId: 'r4', userId: 'u4', firstName: 'Carlos', lastName: 'Ruiz', email: 'carlos@test.com', checkedInAt: null, checkedInBy: null },
];

const teams: TeamCheckinItem[] = [
  { eventTeamId: 'et1', teamId: 't1', teamCode: 'S01', name: 'Las Innovadoras', category: 'senior', turn: 'morning', checkedInAt: '2026-04-10T09:45:00Z', participantCheckedIn: false, notArrivedAt: null, notArrivedBy: null },
  { eventTeamId: 'et2', teamId: 't2', teamCode: 'J01', name: 'Tech Girls', category: 'junior', turn: 'morning', checkedInAt: null, participantCheckedIn: true, notArrivedAt: null, notArrivedBy: null },
  { eventTeamId: 'et3', teamId: 't3', teamCode: 'J02', name: 'Code Queens', category: 'junior', turn: 'afternoon', checkedInAt: null, participantCheckedIn: false, notArrivedAt: null, notArrivedBy: null },
  { eventTeamId: 'et4', teamId: 't4', teamCode: 'B01', name: 'Bit Stars', category: 'beginner', turn: 'morning', checkedInAt: '2026-04-10T09:50:00Z', participantCheckedIn: true, notArrivedAt: null, notArrivedBy: null },
];

// ─── Tests ──────────────────────────────────────────────────────────

describe('Judge filtering & sorting', () => {
  it('returns all judges when search is empty', () => {
    const result = filterJudges(judges, '');
    expect(result.length).toBe(4);
  });

  it('sorts arrived judges first', () => {
    const result = filterJudges(judges, '');
    // First two should be checked-in (Ana and María alphabetically)
    expect(result[0].checkedInAt).not.toBeNull();
    expect(result[1].checkedInAt).not.toBeNull();
    // Last two should be not checked-in
    expect(result[2].checkedInAt).toBeNull();
    expect(result[3].checkedInAt).toBeNull();
  });

  it('sorts alphabetically within same check-in status', () => {
    const result = filterJudges(judges, '');
    // Among checked-in: Ana Martínez < María García
    expect(result[0].firstName).toBe('Ana');
    expect(result[1].firstName).toBe('María');
    // Among not checked-in: Carlos Ruiz < Pedro López
    expect(result[2].firstName).toBe('Carlos');
    expect(result[3].firstName).toBe('Pedro');
  });

  it('filters by first name (case-insensitive)', () => {
    const result = filterJudges(judges, 'mar');
    // Should match María and Ana Martínez
    expect(result.length).toBe(2);
    expect(result.some(j => j.firstName === 'María')).toBe(true);
    expect(result.some(j => j.lastName === 'Martínez')).toBe(true);
  });

  it('filters by email', () => {
    const result = filterJudges(judges, 'pedro@');
    expect(result.length).toBe(1);
    expect(result[0].firstName).toBe('Pedro');
  });

  it('returns empty for no-match search', () => {
    const result = filterJudges(judges, 'zzz_nonexistent');
    expect(result.length).toBe(0);
  });

  it('handles judges with null names', () => {
    const withNulls: JudgeCheckinItem[] = [
      { registrationId: 'rx', userId: 'ux', firstName: null, lastName: null, email: 'x@test.com', checkedInAt: null, checkedInBy: null },
    ];
    const result = filterJudges(withNulls, '');
    expect(result.length).toBe(1);
  });
});

describe('Team filtering & sorting', () => {
  it('returns all teams when search is empty', () => {
    const result = filterTeams(teams, '');
    expect(result.length).toBe(4);
  });

  it('sorts arrived teams first (manual and auto)', () => {
    const result = filterTeams(teams, '');
    // First three arrived (S01 manual, J01 auto, B01 both), last one not arrived (J02)
    const arrivedCount = result.filter((_, i) => i < 3).filter(t => t.checkedInAt || t.participantCheckedIn).length;
    expect(arrivedCount).toBe(3);
    expect(result[3].teamCode).toBe('J02'); // not arrived, last
  });

  it('sorts by team code within same arrival status', () => {
    const result = filterTeams(teams, '');
    // Among arrived: B01, J01, S01 (alphabetical by code)
    const arrived = result.filter(t => t.checkedInAt || t.participantCheckedIn);
    expect(arrived[0].teamCode).toBe('B01');
    expect(arrived[1].teamCode).toBe('J01');
    expect(arrived[2].teamCode).toBe('S01');
  });

  it('filters by team code', () => {
    const result = filterTeams(teams, 'J01');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Tech Girls');
  });

  it('filters by team name (case-insensitive)', () => {
    const result = filterTeams(teams, 'innov');
    expect(result.length).toBe(1);
    expect(result[0].teamCode).toBe('S01');
  });

  it('returns empty for no-match search', () => {
    const result = filterTeams(teams, 'xyz_nothing');
    expect(result.length).toBe(0);
  });
});

describe('Team "Vía" display logic', () => {
  it('shows "—" for non-arrived teams', () => {
    const team = teams.find(t => t.teamCode === 'J02')!;
    expect(getTeamVia(team)).toBe('—');
  });

  it('shows "Manual" for manually checked-in only', () => {
    const team = teams.find(t => t.teamCode === 'S01')!;
    expect(getTeamVia(team)).toBe('Manual');
  });

  it('shows "QR participante" for auto-only check-in', () => {
    const team = teams.find(t => t.teamCode === 'J01')!;
    expect(getTeamVia(team)).toBe('QR participante');
  });

  it('shows "Manual + QR" when both manual and auto', () => {
    const team = teams.find(t => t.teamCode === 'B01')!;
    expect(getTeamVia(team)).toBe('Manual + QR');
  });
});
