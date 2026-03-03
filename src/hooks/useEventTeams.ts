import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventTeam {
  id: string;
  name: string;
  category: string | null;
  validated: boolean;
  participantCount: number;
}

/**
 * Hook para obtener todos los equipos registrados en un evento.
 * Descubre equipos via event_registrations.team_id y team_members.
 * Reutiliza la lógica de useAllTeamsPreferences sin traer preferencias.
 */
export function useEventTeams(eventId: string) {
  return useQuery({
    queryKey: ['event-teams', eventId],
    queryFn: async (): Promise<EventTeam[]> => {
      // 1. Obtener todos los registros activos del evento
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select('team_id, user_id')
        .eq('event_id', eventId)
        .eq('is_companion', false)
        .neq('registration_status', 'cancelled');

      if (regError) throw regError;
      if (!registrations || registrations.length === 0) return [];

      // 2. Recopilar team_ids directos del registro
      const directTeamIds = new Set(
        registrations.map(r => r.team_id).filter((id): id is string => !!id)
      );

      // 3. Para usuarios sin team_id en el registro, buscar via team_members
      const userIdsWithoutTeam = registrations
        .filter(r => !r.team_id && r.user_id)
        .map(r => r.user_id)
        .filter((id): id is string => !!id);

      const membershipTeamIds = new Set<string>();
      if (userIdsWithoutTeam.length > 0) {
        const { data: memberships, error: memError } = await supabase
          .from('team_members')
          .select('team_id, user_id')
          .in('user_id', userIdsWithoutTeam)
          .not('team_id', 'is', null);

        if (memError) throw memError;
        memberships?.forEach(m => {
          if (m.team_id) membershipTeamIds.add(m.team_id);
        });
      }

      // 4. Unir todos los team_ids
      const allTeamIds = [...new Set([...directTeamIds, ...membershipTeamIds])];
      if (allTeamIds.length === 0) return [];

      // 5. Obtener info de equipos y miembros en paralelo
      const [teamsResult, membersResult] = await Promise.all([
        supabase.from('teams').select('id, name, category, validated').in('id', allTeamIds),
        supabase.from('team_members').select('team_id, member_type, user_id').in('team_id', allTeamIds),
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (membersResult.error) throw membersResult.error;

      // 6. Contar participantes con entrada al evento + 1 (mentor fijo)
      const registeredUserIds = new Set(
        registrations.map(r => r.user_id).filter((id): id is string => !!id)
      );

      const registeredParticipantCounts = new Map<string, number>();
      membersResult.data?.forEach(m => {
        if (!m.team_id || !m.user_id) return;
        if (m.member_type === 'participant' && registeredUserIds.has(m.user_id)) {
          registeredParticipantCounts.set(
            m.team_id,
            (registeredParticipantCounts.get(m.team_id) || 0) + 1
          );
        }
      });

      const participantCountByTeam = new Map<string, number>();
      for (const teamId of allTeamIds) {
        const registeredParticipants = registeredParticipantCounts.get(teamId) || 0;
        participantCountByTeam.set(teamId, registeredParticipants + 1);
      }

      // 7. Construir array de equipos
      return (teamsResult.data || []).map(team => ({
        id: team.id,
        name: team.name,
        category: team.category,
        validated: team.validated ?? false,
        participantCount: participantCountByTeam.get(team.id) || 1,
      }));
    },
    enabled: !!eventId,
  });
}
