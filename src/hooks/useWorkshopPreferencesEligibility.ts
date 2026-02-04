import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EligibleTeamForPreferences {
  teamId: string;
  teamName: string;
  eventId: string;
  eventName: string;
  hasSubmittedPreferences: boolean;
  submittedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

interface WorkshopPreferencesEligibility {
  eligibleTeams: EligibleTeamForPreferences[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook para verificar si un mentor tiene equipos elegibles para asignar preferencias de talleres.
 * 
 * Condiciones para que un equipo sea elegible:
 * 1. El evento tiene workshop_preferences_open = true
 * 2. Al menos un participante del equipo está inscrito en el evento
 * 3. El mentor está vinculado al equipo
 */
export function useWorkshopPreferencesEligibility(userId: string | undefined): WorkshopPreferencesEligibility {
  const { data, isLoading, error } = useQuery({
    queryKey: ['workshop-preferences-eligibility', userId],
    queryFn: async () => {
      console.log('[WorkshopEligibility] Starting eligibility check for userId:', userId);
      if (!userId) {
        console.log('[WorkshopEligibility] No userId provided, returning empty');
        return [];
      }

      // 1. Get teams where user is mentor
      const { data: mentorTeams, error: teamsError } = await supabase
        .from('team_members')
        .select('team_id, team:teams(id, name)')
        .eq('user_id', userId)
        .eq('member_type', 'mentor');

      console.log('[WorkshopEligibility] Step 1 - Mentor teams:', mentorTeams, 'Error:', teamsError);
      if (teamsError) throw teamsError;
      if (!mentorTeams?.length) {
        console.log('[WorkshopEligibility] No mentor teams found, returning empty');
        return [];
      }

      const teamIds = mentorTeams.map(t => t.team_id).filter(Boolean) as string[];

      // 2. Get events with workshop_preferences_open = true
      const { data: openEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, name')
        .eq('workshop_preferences_open', true)
        .eq('status', 'published');

      console.log('[WorkshopEligibility] Step 2 - Open events:', openEvents, 'Error:', eventsError);
      if (eventsError) throw eventsError;
      if (!openEvents?.length) {
        console.log('[WorkshopEligibility] No open events found, returning empty');
        return [];
      }

      const eventIds = openEvents.map(e => e.id);
      const eventsMap = new Map(openEvents.map(e => [e.id, e.name]));

      // 3. Get team members (participants) for these teams
      const { data: teamParticipants, error: participantsError } = await supabase
        .from('team_members')
        .select('team_id, user_id')
        .in('team_id', teamIds)
        .eq('member_type', 'participant');

      console.log('[WorkshopEligibility] Step 3 - Team participants:', teamParticipants, 'Error:', participantsError);
      if (participantsError) throw participantsError;

      const participantsByTeam = new Map<string, string[]>();
      teamParticipants?.forEach(tp => {
        if (tp.team_id && tp.user_id) {
          const existing = participantsByTeam.get(tp.team_id) || [];
          participantsByTeam.set(tp.team_id, [...existing, tp.user_id]);
        }
      });

      // 4. Get registrations for these events where participant is registered
      const allParticipantIds = Array.from(new Set(teamParticipants?.map(tp => tp.user_id).filter(Boolean) || []));
      console.log('[WorkshopEligibility] Step 4a - All participant IDs:', allParticipantIds);
      
      if (!allParticipantIds.length) {
        console.log('[WorkshopEligibility] No participant IDs found, returning empty');
        return [];
      }

      const { data: registrations, error: regsError } = await supabase
        .from('event_registrations')
        .select('event_id, user_id')
        .in('event_id', eventIds)
        .in('user_id', allParticipantIds)
        .neq('registration_status', 'cancelled');

      console.log('[WorkshopEligibility] Step 4b - Registrations found:', registrations, 'Error:', regsError);
      if (regsError) throw regsError;

      // Build a set of "teamId|eventId" combinations where at least one participant is registered
      const registeredTeamEvents = new Set<string>();
      
      registrations?.forEach(reg => {
        // Find which team this participant belongs to
        for (const [teamId, participants] of participantsByTeam.entries()) {
          if (participants.includes(reg.user_id!)) {
            registeredTeamEvents.add(`${teamId}|${reg.event_id}`);
          }
        }
      });

      console.log('[WorkshopEligibility] Step 5a - Registered team-events:', Array.from(registeredTeamEvents));

      // 5. Check if preferences have already been submitted for each team+event
      const { data: existingPreferences, error: prefsError } = await supabase
        .from('workshop_preferences')
        .select(`
          team_id,
          event_id,
          submitted_by,
          submitter:profiles!workshop_preferences_submitted_by_fkey(id, first_name, last_name, email)
        `)
        .in('team_id', teamIds)
        .in('event_id', eventIds);

      console.log('[WorkshopEligibility] Step 5b - Existing preferences:', existingPreferences, 'Error:', prefsError);
      if (prefsError) throw prefsError;

      // Group preferences by team+event
      const preferencesMap = new Map<string, {
        submitted: boolean;
        submittedBy?: { id: string; firstName: string | null; lastName: string | null; email: string };
      }>();

      existingPreferences?.forEach(pref => {
        const key = `${pref.team_id}|${pref.event_id}`;
        if (!preferencesMap.has(key)) {
          const submitter = (pref.submitter as any);
          preferencesMap.set(key, {
            submitted: true,
            submittedBy: submitter ? {
              id: submitter.id,
              firstName: submitter.first_name,
              lastName: submitter.last_name,
              email: submitter.email,
            } : undefined,
          });
        }
      });

      // 6. Build final list of eligible teams
      const eligibleTeams: EligibleTeamForPreferences[] = [];

      for (const mt of mentorTeams) {
        const team = mt.team as any;
        if (!team) continue;

        for (const eventId of eventIds) {
          const key = `${team.id}|${eventId}`;
          
          // Check if at least one participant is registered
          if (registeredTeamEvents.has(key)) {
            const prefInfo = preferencesMap.get(key);
            
            eligibleTeams.push({
              teamId: team.id,
              teamName: team.name,
              eventId: eventId,
              eventName: eventsMap.get(eventId) || 'Evento',
              hasSubmittedPreferences: prefInfo?.submitted || false,
              submittedBy: prefInfo?.submittedBy,
            });
          }
        }
      }

      console.log('[WorkshopEligibility] Final eligible teams:', eligibleTeams);
      return eligibleTeams;
    },
    enabled: !!userId,
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    eligibleTeams: data || [],
    isLoading,
    error: error as Error | null,
  };
}
