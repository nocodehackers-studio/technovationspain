import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface JudgeCheckinItem {
  registrationId: string;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
}

export interface TeamCheckinItem {
  eventTeamId: string;
  teamId: string;
  teamCode: string;
  name: string;
  category: string;
  turn: string;
  checkedInAt: string | null;          // manual check-in from event_teams
  participantCheckedIn: boolean;       // auto check-in via QR (any participant)
  notArrivedAt: string | null;         // marked as no-show by admin
  notArrivedBy: string | null;
}

export interface CheckinStatusResult {
  judges: {
    list: JudgeCheckinItem[];
    checkedInUserIds: Set<string>;
    total: number;
    arrived: number;
  };
  teams: {
    list: TeamCheckinItem[];
    checkedInTeamIds: Set<string>;
    noShowTeamIds: Set<string>;
    total: number;
    arrived: number;
    noShow: number;
  };
  markJudgeArrived: (registrationId: string) => Promise<void>;
  markJudgeDeparted: (registrationId: string) => Promise<void>;
  markTeamArrived: (eventTeamId: string) => Promise<void>;
  markTeamDeparted: (eventTeamId: string) => Promise<void>;
  markTeamNoShow: (eventTeamId: string) => Promise<void>;
  unmarkTeamNoShow: (eventTeamId: string) => Promise<void>;
  isLoading: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useCheckinStatus(eventId: string | undefined): CheckinStatusResult {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id;

  // --- Query: Judges (event_registrations with for_judges ticket) ---
  const judgesQuery = useQuery({
    queryKey: ['checkin-judges', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_registrations')
        .select('id, user_id, first_name, last_name, email, checked_in_at, checked_in_by, event_ticket_types!ticket_type_id(for_judges)')
        .eq('event_id', eventId!)
        .neq('registration_status', 'cancelled');

      if (error) throw error;

      // Filter to only judge registrations
      const judgeRegs = (data || []).filter((r: any) => {
        const ticketType = r.event_ticket_types;
        return ticketType?.for_judges === true;
      });

      return judgeRegs.map((r: any): JudgeCheckinItem => ({
        registrationId: r.id,
        userId: r.user_id,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        checkedInAt: r.checked_in_at,
        checkedInBy: r.checked_in_by,
      }));
    },
    enabled: !!eventId,
    refetchInterval: 30000,
  });

  // --- Query: Teams (event_teams) ---
  const teamsQuery = useQuery({
    queryKey: ['checkin-teams', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_teams')
        .select('id, team_id, team_code, category, turn, is_active, checked_in_at, checked_in_by, not_arrived_at, not_arrived_by, teams(name)')
        .eq('event_id', eventId!)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
    refetchInterval: 30000,
  });

  // --- Query: Auto-check (participants with QR scanned) ---
  const autoCheckQuery = useQuery({
    queryKey: ['checkin-auto-teams', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_registrations')
        .select('team_id')
        .eq('event_id', eventId!)
        .not('team_id', 'is', null)
        .not('checked_in_at', 'is', null);

      if (error) throw error;
      // Return sorted array for stable identity (Set created via useMemo below)
      return (data || []).map((r: any) => r.team_id as string).sort();
    },
    enabled: !!eventId,
    refetchInterval: 30000,
  });

  // --- Derived data (memoized to avoid unnecessary re-renders) ---
  const judgesList: JudgeCheckinItem[] = judgesQuery.data || [];
  const checkedInUserIds = useMemo(
    () => new Set(
      judgesList
        .filter(j => j.checkedInAt !== null && j.userId !== null)
        .map(j => j.userId!)
    ),
    [judgesList]
  );
  const judgesArrived = judgesList.filter(j => j.checkedInAt !== null).length;

  const autoCheckedTeamIds = useMemo(
    () => new Set(autoCheckQuery.data || []),
    [autoCheckQuery.data]
  );
  const teamsList: TeamCheckinItem[] = useMemo(
    () => (teamsQuery.data || []).map((et: any) => ({
      eventTeamId: et.id,
      teamId: et.team_id,
      teamCode: et.team_code,
      name: (et.teams as any)?.name || '',
      category: et.category,
      turn: et.turn,
      checkedInAt: et.checked_in_at,
      participantCheckedIn: autoCheckedTeamIds.has(et.team_id),
      notArrivedAt: et.not_arrived_at,
      notArrivedBy: et.not_arrived_by,
    })),
    [teamsQuery.data, autoCheckedTeamIds]
  );

  const checkedInTeamIds = useMemo(
    () => new Set(
      teamsList
        .filter(t => t.checkedInAt !== null || t.participantCheckedIn)
        .map(t => t.teamId)
    ),
    [teamsList]
  );
  const teamsArrived = checkedInTeamIds.size;

  // No-show wins only when there's no positive arrival signal (manual check-in or QR participant scan)
  const noShowTeamIds = useMemo(
    () => new Set(
      teamsList
        .filter(t => t.notArrivedAt !== null && t.checkedInAt === null && !t.participantCheckedIn)
        .map(t => t.teamId)
    ),
    [teamsList]
  );
  const teamsNoShow = noShowTeamIds.size;

  // --- Mutations ---
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['checkin-judges', eventId] });
    queryClient.invalidateQueries({ queryKey: ['checkin-teams', eventId] });
    queryClient.invalidateQueries({ queryKey: ['checkin-auto-teams', eventId] });
  };

  const markJudgeArrivedMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from('event_registrations')
        .update({
          checked_in_at: new Date().toISOString(),
          checked_in_by: currentUserId || null,
          registration_status: 'checked_in',
        })
        .eq('id', registrationId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (error: any) => toast.error(`Error al marcar juez: ${error.message}`),
  });

  const markJudgeDepartedMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from('event_registrations')
        .update({
          checked_in_at: null,
          checked_in_by: null,
          registration_status: 'confirmed',
        })
        .eq('id', registrationId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (error: any) => toast.error(`Error al desmarcar juez: ${error.message}`),
  });

  const markTeamArrivedMutation = useMutation({
    mutationFn: async (eventTeamId: string) => {
      const { error } = await supabase
        .from('event_teams')
        .update({
          checked_in_at: new Date().toISOString(),
          checked_in_by: currentUserId || null,
        })
        .eq('id', eventTeamId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (error: any) => toast.error(`Error al marcar equipo: ${error.message}`),
  });

  const markTeamDepartedMutation = useMutation({
    mutationFn: async (eventTeamId: string) => {
      const { error } = await supabase
        .from('event_teams')
        .update({
          checked_in_at: null,
          checked_in_by: null,
        })
        .eq('id', eventTeamId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (error: any) => toast.error(`Error al desmarcar equipo: ${error.message}`),
  });

  const markTeamNoShowMutation = useMutation({
    mutationFn: async (eventTeamId: string) => {
      const { error } = await supabase
        .from('event_teams')
        .update({
          not_arrived_at: new Date().toISOString(),
          not_arrived_by: currentUserId || null,
        })
        .eq('id', eventTeamId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (error: any) => toast.error(`Error al marcar no-llegada: ${error.message}`),
  });

  const unmarkTeamNoShowMutation = useMutation({
    mutationFn: async (eventTeamId: string) => {
      const { error } = await supabase
        .from('event_teams')
        .update({
          not_arrived_at: null,
          not_arrived_by: null,
        })
        .eq('id', eventTeamId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (error: any) => toast.error(`Error al quitar marca de no-llegada: ${error.message}`),
  });

  return {
    judges: {
      list: judgesList,
      checkedInUserIds,
      total: judgesList.length,
      arrived: judgesArrived,
    },
    teams: {
      list: teamsList,
      checkedInTeamIds,
      noShowTeamIds,
      total: teamsList.length,
      arrived: teamsArrived,
      noShow: teamsNoShow,
    },
    markJudgeArrived: markJudgeArrivedMutation.mutateAsync,
    markJudgeDeparted: markJudgeDepartedMutation.mutateAsync,
    markTeamArrived: markTeamArrivedMutation.mutateAsync,
    markTeamDeparted: markTeamDepartedMutation.mutateAsync,
    markTeamNoShow: markTeamNoShowMutation.mutateAsync,
    unmarkTeamNoShow: unmarkTeamNoShowMutation.mutateAsync,
    isLoading: judgesQuery.isLoading || teamsQuery.isLoading || autoCheckQuery.isLoading,
  };
}
