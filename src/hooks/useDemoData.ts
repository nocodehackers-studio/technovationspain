import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Workshop IDs for the event "Encuentro Equipos Technovation Girls Madrid 2026"
const WORKSHOP_IDS = {
  etica: '67698a90-1245-45fc-852b-d76a83a37107',
  prompting: '9c5172bc-d8e1-43a5-8d62-d73573a922c6',
  accesibilidad: 'e03d947d-da91-4fa1-9ed2-c5a06c99a2e4',
  ml4kids: '4c3f570a-5cc4-45d7-b3f3-a19d9d3ae078',
  logo: '382911bd-8a0c-4bd3-86d0-0c0b656b089d',
  diseno: 'f37fdae8-b752-46fb-9092-f1e4837ad316',
  comunicacion: '05a65a30-7456-4acf-b342-d6c99ced86ed',
};

// Demo teams configuration with their preferences
const DEMO_TEAMS = [
  {
    name: '[DEMO] Las Innovadoras',
    category: 'junior',
    participantCount: 5,
    preferences: ['etica', 'prompting', 'ml4kids', 'diseno', 'logo', 'accesibilidad', 'comunicacion'],
  },
  {
    name: '[DEMO] Tech Queens',
    category: 'senior',
    participantCount: 4,
    preferences: ['prompting', 'diseno', 'etica', 'accesibilidad', 'comunicacion', 'ml4kids', 'logo'],
  },
  {
    name: '[DEMO] Code Masters',
    category: 'beginner',
    participantCount: 6,
    preferences: ['ml4kids', 'logo', 'accesibilidad', 'etica', 'prompting', 'diseno', 'comunicacion'],
  },
  {
    name: '[DEMO] Digital Stars',
    category: 'junior',
    participantCount: 3,
    preferences: ['diseno', 'comunicacion', 'etica', 'ml4kids', 'logo', 'prompting', 'accesibilidad'],
  },
  {
    name: '[DEMO] Future Coders',
    category: 'senior',
    participantCount: 5,
    preferences: ['accesibilidad', 'etica', 'prompting', 'diseno', 'comunicacion', 'logo', 'ml4kids'],
  },
  {
    name: '[DEMO] AI Explorers',
    category: 'junior',
    participantCount: 4,
    preferences: ['etica', 'accesibilidad', 'prompting', 'comunicacion', 'diseno', 'ml4kids', 'logo'],
  },
  {
    name: '[DEMO] Web Wizards',
    category: 'beginner',
    participantCount: 5,
    preferences: ['logo', 'diseno', 'ml4kids', 'comunicacion', 'accesibilidad', 'etica', 'prompting'],
  },
  {
    name: '[DEMO] App Builders',
    category: 'senior',
    participantCount: 4,
    preferences: ['comunicacion', 'diseno', 'etica', 'accesibilidad', 'prompting', 'logo', 'ml4kids'],
  },
  {
    name: '[DEMO] Data Divas',
    category: 'junior',
    participantCount: 3,
    preferences: ['prompting', 'etica', 'accesibilidad', 'comunicacion', 'diseno', 'ml4kids', 'logo'],
  },
  {
    name: '[DEMO] Pixel Pioneers',
    category: 'beginner',
    participantCount: 6,
    preferences: ['logo', 'ml4kids', 'diseno', 'comunicacion', 'accesibilidad', 'etica', 'prompting'],
  },
];

export function useDemoData(eventId: string) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Query to count existing demo teams (regardless of event registrations)
  const { data: demoTeamsCount = 0, refetch: refetchDemoCount } = useQuery({
    queryKey: ['demo-teams-count'],
    queryFn: async () => {
      // Get ALL teams with [DEMO] prefix
      const { data, error } = await supabase
        .from('teams')
        .select('id')
        .like('name', '[DEMO]%');

      if (error) throw error;
      return data?.length || 0;
    },
  });

  const generateDemoData = async () => {
    if (!eventId) {
      toast.error('No hay evento seleccionado');
      return;
    }

    setIsGenerating(true);
    try {
      // Get current user for submitted_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Get ticket type for teams (usually "Equipos Participantes")
      // NOTE: We use maybeSingle to avoid errors if none exists.
      const { data: ticketType, error: ticketTypeError } = await supabase
        .from('event_ticket_types')
        .select('id')
        .eq('event_id', eventId)
        .eq('requires_team', true)
        .limit(1)
        .maybeSingle();

      if (ticketTypeError) {
        console.error('Error fetching ticket type:', ticketTypeError);
      }

      let teamsCreated = 0;
      const timestamp = Date.now().toString(36); // Short unique suffix

      for (let i = 0; i < DEMO_TEAMS.length; i++) {
        const teamConfig = DEMO_TEAMS[i];
        const demoIndex = String(i + 1).padStart(3, '0');
        const uniqueSuffix = `${timestamp}-${demoIndex}`;

        // 1. Create team with unique tg_team_id
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .insert({
            name: teamConfig.name,
            category: teamConfig.category,
            notes: '[DEMO] Equipo de prueba para asignación de talleres',
            tg_team_id: `DEMO-${uniqueSuffix}`,
          })
          .select()
          .single();

        if (teamError) {
          console.error('Error creating team:', teamError);
          continue;
        }

        // 2. Create event registration
        const qrCode = `DEMO-${eventId.slice(0, 8)}-${team.id.slice(0, 8)}`;
        const { error: regError } = await supabase
          .from('event_registrations')
          .insert({
            event_id: eventId,
            team_id: team.id,
            user_id: user.id,
            team_name: teamConfig.name,
            registration_number: `DEMO-${uniqueSuffix}`,
            participant_count: teamConfig.participantCount,
            qr_code: qrCode,
            registration_status: 'confirmed',
            ticket_type_id: ticketType?.id ?? null,
          });

        if (regError) {
          console.error('Error creating registration:', regError);
          continue;
        }

        // 3. Create workshop preferences
        const preferencesData = teamConfig.preferences.map((prefKey, index) => ({
          event_id: eventId,
          team_id: team.id,
          workshop_id: WORKSHOP_IDS[prefKey as keyof typeof WORKSHOP_IDS],
          preference_order: index + 1,
          submitted_by: user.id,
        }));

        const { error: prefError } = await supabase
          .from('workshop_preferences')
          .insert(preferencesData);

        if (prefError) {
          console.error('Error creating preferences:', prefError);
          continue;
        }

        teamsCreated++;
      }

      toast.success(`Se crearon ${teamsCreated} equipos DEMO con preferencias`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['demo-teams-count'] });
      queryClient.invalidateQueries({ queryKey: ['all-teams-preferences', eventId] });
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments', eventId] });

    } catch (error) {
      console.error('Error generating demo data:', error);
      toast.error('Error al generar datos DEMO');
    } finally {
      setIsGenerating(false);
    }
  };

  const clearDemoData = async () => {
    if (!eventId) {
      toast.error('No hay evento seleccionado');
      return;
    }

    setIsClearing(true);
    try {
      // Get all demo team IDs
      const { data: demoTeams, error: fetchError } = await supabase
        .from('teams')
        .select('id')
        .like('name', '[DEMO]%');

      if (fetchError) throw fetchError;

      const demoTeamIds = demoTeams?.map(t => t.id) || [];

      if (demoTeamIds.length === 0) {
        toast.info('No hay datos DEMO para eliminar');
        return;
      }

      // 1. Delete workshop preferences (for this event)
      const { error: prefError } = await supabase
        .from('workshop_preferences')
        .delete()
        .eq('event_id', eventId)
        .in('team_id', demoTeamIds);

      if (prefError) console.error('Error deleting preferences:', prefError);

      // 2. Delete workshop assignments (for this event)
      const { error: assignError } = await supabase
        .from('workshop_assignments')
        .delete()
        .eq('event_id', eventId)
        .in('team_id', demoTeamIds);

      if (assignError) console.error('Error deleting assignments:', assignError);

      // 3. Delete event registrations (for this event)
      const { error: regError } = await supabase
        .from('event_registrations')
        .delete()
        .eq('event_id', eventId)
        .in('team_id', demoTeamIds);

      if (regError) console.error('Error deleting registrations:', regError);

      // 4. Delete teams
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .like('name', '[DEMO]%');

      if (teamError) throw teamError;

      toast.success(`Se eliminaron ${demoTeamIds.length} equipos DEMO y sus datos relacionados`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['demo-teams-count'] });
      queryClient.invalidateQueries({ queryKey: ['all-teams-preferences', eventId] });
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments', eventId] });

    } catch (error) {
      console.error('Error clearing demo data:', error);
      toast.error('Error al eliminar datos DEMO');
    } finally {
      setIsClearing(false);
    }
  };

  return {
    demoTeamsCount,
    hasDemoData: demoTeamsCount > 0,
    isGenerating,
    isClearing,
    generateDemoData,
    clearDemoData,
    refetchDemoCount,
  };
}
