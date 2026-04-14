import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ─── Mocks ─────────────────────────────────────────────────────────

// Mock useAuth
const mockUser = { id: 'admin-user-123' };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock Supabase client with chainable API
let mockResponses: Record<string, any> = {};

const createChainableMock = (table: string) => {
  const chain: any = {};
  const state: Record<string, any> = {};

  const resolveResponse = () => {
    const key = table;
    const response = mockResponses[key];
    if (response) return response;
    return { data: [], error: null };
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);

  // Make it thenable to resolve queries
  chain.then = (resolve: any, reject: any) => {
    const response = resolveResponse();
    return Promise.resolve(response).then(resolve, reject);
  };

  return chain;
};

const mockFrom = vi.fn((table: string) => createChainableMock(table));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────

import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import type { JudgeCheckinItem, TeamCheckinItem } from '@/hooks/useCheckinStatus';

// ─── Helpers ─────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

// Sample data
const judgeRegistrations = [
  {
    id: 'reg-j1',
    user_id: 'user-judge-1',
    first_name: 'María',
    last_name: 'García',
    email: 'maria@test.com',
    checked_in_at: '2026-04-10T10:00:00Z',
    checked_in_by: 'admin-1',
    event_ticket_types: { for_judges: true },
  },
  {
    id: 'reg-j2',
    user_id: 'user-judge-2',
    first_name: 'Pedro',
    last_name: 'López',
    email: 'pedro@test.com',
    checked_in_at: null,
    checked_in_by: null,
    event_ticket_types: { for_judges: true },
  },
  {
    id: 'reg-p1',
    user_id: 'user-participant-1',
    first_name: 'Ana',
    last_name: 'Ruiz',
    email: 'ana@test.com',
    checked_in_at: '2026-04-10T09:30:00Z',
    checked_in_by: 'admin-1',
    event_ticket_types: { for_judges: false },
  },
];

const eventTeams = [
  {
    id: 'et-1',
    team_id: 'team-1',
    team_code: 'S01',
    category: 'senior',
    turn: 'morning',
    is_active: true,
    checked_in_at: '2026-04-10T09:45:00Z',
    checked_in_by: 'admin-1',
    teams: { name: 'Las Innovadoras' },
  },
  {
    id: 'et-2',
    team_id: 'team-2',
    team_code: 'J01',
    category: 'junior',
    turn: 'morning',
    is_active: true,
    checked_in_at: null,
    checked_in_by: null,
    teams: { name: 'Tech Girls' },
  },
  {
    id: 'et-3',
    team_id: 'team-3',
    team_code: 'J02',
    category: 'junior',
    turn: 'afternoon',
    is_active: true,
    checked_in_at: null,
    checked_in_by: null,
    teams: { name: 'Code Queens' },
  },
];

// Participants with QR check-in (auto-check for teams)
const autoCheckRegistrations = [
  { team_id: 'team-2' }, // Tech Girls has a participant checked in via QR
];

function setupMockResponses(opts?: {
  judges?: any[];
  teams?: any[];
  autoCheck?: any[];
}) {
  mockResponses = {
    event_registrations: { data: opts?.judges ?? judgeRegistrations, error: null },
    event_teams: { data: opts?.teams ?? eventTeams, error: null },
  };

  // Auto-check query also hits event_registrations, but with different filters
  // We need to differentiate calls - use mockFrom call order
  const autoCheckData = opts?.autoCheck ?? autoCheckRegistrations;
  let eventRegCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    const chain = createChainableMock(table);

    if (table === 'event_registrations') {
      eventRegCallCount++;
      const isAutoCheckCall = eventRegCallCount > 1;

      chain.then = (resolve: any, reject: any) => {
        if (isAutoCheckCall) {
          return Promise.resolve({ data: autoCheckData, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: opts?.judges ?? judgeRegistrations, error: null }).then(resolve, reject);
      };
    }

    return chain;
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockResponses = {};
});

describe('useCheckinStatus', () => {
  describe('judges data derivation', () => {
    it('filters only judge registrations (for_judges === true)', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should have 2 judges (not the participant)
      expect(result.current.judges.total).toBe(2);
      expect(result.current.judges.list.length).toBe(2);
    });

    it('correctly counts arrived judges', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // María is checked in, Pedro is not
      expect(result.current.judges.arrived).toBe(1);
    });

    it('builds checkedInUserIds set correctly', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.judges.checkedInUserIds.has('user-judge-1')).toBe(true);
      expect(result.current.judges.checkedInUserIds.has('user-judge-2')).toBe(false);
    });

    it('maps judge fields correctly', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const maria = result.current.judges.list.find(j => j.registrationId === 'reg-j1');
      expect(maria).toBeDefined();
      expect(maria!.firstName).toBe('María');
      expect(maria!.lastName).toBe('García');
      expect(maria!.email).toBe('maria@test.com');
      expect(maria!.userId).toBe('user-judge-1');
      expect(maria!.checkedInAt).toBe('2026-04-10T10:00:00Z');
    });
  });

  describe('teams data derivation', () => {
    it('returns all active teams', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.teams.total).toBe(3);
    });

    it('correctly identifies manually checked-in teams', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const innovadoras = result.current.teams.list.find(t => t.teamCode === 'S01');
      expect(innovadoras!.checkedInAt).not.toBeNull();
    });

    it('detects auto-checked teams via participant QR', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const techGirls = result.current.teams.list.find(t => t.teamCode === 'J01');
      expect(techGirls!.participantCheckedIn).toBe(true);
    });

    it('counts arrived teams (manual + auto)', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // team-1: manual check-in, team-2: auto via QR, team-3: not arrived
      expect(result.current.teams.arrived).toBe(2);
    });

    it('builds checkedInTeamIds with both manual and auto', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.teams.checkedInTeamIds.has('team-1')).toBe(true); // manual
      expect(result.current.teams.checkedInTeamIds.has('team-2')).toBe(true); // auto QR
      expect(result.current.teams.checkedInTeamIds.has('team-3')).toBe(false); // not arrived
    });

    it('maps team fields correctly', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const codeQueens = result.current.teams.list.find(t => t.teamCode === 'J02');
      expect(codeQueens).toBeDefined();
      expect(codeQueens!.name).toBe('Code Queens');
      expect(codeQueens!.category).toBe('junior');
      expect(codeQueens!.turn).toBe('afternoon');
      expect(codeQueens!.eventTeamId).toBe('et-3');
      expect(codeQueens!.teamId).toBe('team-3');
    });
  });

  describe('edge cases', () => {
    it('returns empty data when no registrations exist', async () => {
      setupMockResponses({ judges: [], teams: [], autoCheck: [] });
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.judges.total).toBe(0);
      expect(result.current.judges.arrived).toBe(0);
      expect(result.current.teams.total).toBe(0);
      expect(result.current.teams.arrived).toBe(0);
    });

    it('does not load when eventId is undefined', async () => {
      setupMockResponses();
      const { result } = renderHook(() => useCheckinStatus(undefined), {
        wrapper: createWrapper(),
      });

      // Should stay in loading state (queries disabled)
      expect(result.current.judges.total).toBe(0);
      expect(result.current.teams.total).toBe(0);
    });

    it('handles team with no team name gracefully', async () => {
      setupMockResponses({
        teams: [
          {
            id: 'et-x',
            team_id: 'team-x',
            team_code: 'X01',
            category: 'beginner',
            turn: 'morning',
            is_active: true,
            checked_in_at: null,
            checked_in_by: null,
            teams: null, // no name
          },
        ],
        autoCheck: [],
      });
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.teams.list[0].name).toBe('');
    });

    it('judge with null userId is not included in checkedInUserIds even if checked in', async () => {
      setupMockResponses({
        judges: [
          {
            id: 'reg-anon',
            user_id: null,
            first_name: 'Anónimo',
            last_name: 'Juez',
            email: 'anon@test.com',
            checked_in_at: '2026-04-10T10:00:00Z',
            checked_in_by: 'admin-1',
            event_ticket_types: { for_judges: true },
          },
        ],
      });
      const { result } = renderHook(() => useCheckinStatus('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.judges.arrived).toBe(1);
      expect(result.current.judges.checkedInUserIds.size).toBe(0);
    });
  });
});
