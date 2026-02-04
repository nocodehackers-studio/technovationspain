import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WorkshopPreference, Workshop } from '@/types/database';

interface PreferenceWithWorkshop extends WorkshopPreference {
  workshop?: Workshop;
}

interface TeamPreferencesData {
  teamId: string;
  teamName: string;
  preferences: PreferenceWithWorkshop[];
  submittedBy: string | null;
  submittedAt: string | null;
  canSubmit: boolean;
  blockedReason: string | null;
}

/**
 * Hook para gestionar preferencias de talleres de un equipo
 */
export function useWorkshopPreferences(eventId: string, teamId?: string) {
  const queryClient = useQueryClient();

  // Obtener talleres del evento
  const { data: workshops, isLoading: workshopsLoading } = useQuery({
    queryKey: ['event-workshops', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('event_id', eventId)
        .order('name');
      
      if (error) throw error;
      return data as Workshop[];
    },
    enabled: !!eventId,
  });

  // Obtener preferencias existentes del equipo
  const { data: teamPreferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['team-workshop-preferences', eventId, teamId],
    queryFn: async () => {
      if (!teamId) return null;

      const { data, error } = await supabase
        .from('workshop_preferences')
        .select(`
          *,
          workshop:workshops(*)
        `)
        .eq('event_id', eventId)
        .eq('team_id', teamId)
        .order('preference_order');
      
      if (error) throw error;
      return data as PreferenceWithWorkshop[];
    },
    enabled: !!eventId && !!teamId,
  });

  // Verificar si el equipo ya tiene preferencias enviadas
  const { data: submissionStatus } = useQuery({
    queryKey: ['team-preferences-status', eventId, teamId],
    queryFn: async () => {
      if (!teamId) return { submitted: false, submittedBy: null, submittedAt: null };

      const { data, error } = await supabase
        .from('workshop_preferences')
        .select('submitted_by, submitted_at')
        .eq('event_id', eventId)
        .eq('team_id', teamId)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        // Obtener nombre del mentor que envió
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.submitted_by)
          .single();

        return {
          submitted: true,
          submittedBy: profile ? `${profile.first_name} ${profile.last_name}` : 'Otro mentor',
          submittedAt: data.submitted_at,
          submittedById: data.submitted_by,
        };
      }

      return { submitted: false, submittedBy: null, submittedAt: null, submittedById: null };
    },
    enabled: !!eventId && !!teamId,
  });

  // Guardar preferencias
  const submitPreferencesMutation = useMutation({
    mutationFn: async ({ 
      orderedWorkshopIds, 
      userId 
    }: { 
      orderedWorkshopIds: string[]; 
      userId: string;
    }) => {
      if (!teamId || !eventId) {
        throw new Error('Faltan datos del equipo o evento');
      }

      // Primero verificar que no existan preferencias
      const { data: existing } = await supabase
        .from('workshop_preferences')
        .select('id')
        .eq('event_id', eventId)
        .eq('team_id', teamId)
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error('Las preferencias ya fueron enviadas para este equipo');
      }

      // Crear todas las preferencias
      const preferencesToInsert = orderedWorkshopIds.map((workshopId, index) => ({
        team_id: teamId,
        event_id: eventId,
        workshop_id: workshopId,
        preference_order: index + 1,
        submitted_by: userId,
      }));

      const { error } = await supabase
        .from('workshop_preferences')
        .insert(preferencesToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-workshop-preferences', eventId, teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-preferences-status', eventId, teamId] });
      toast.success('¡Preferencias guardadas correctamente!');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Admin: actualizar preferencias
  const updatePreferencesMutation = useMutation({
    mutationFn: async ({ orderedWorkshopIds }: { orderedWorkshopIds: string[] }) => {
      if (!teamId || !eventId) {
        throw new Error('Faltan datos del equipo o evento');
      }

      // Eliminar preferencias existentes
      const { error: deleteError } = await supabase
        .from('workshop_preferences')
        .delete()
        .eq('event_id', eventId)
        .eq('team_id', teamId);

      if (deleteError) throw deleteError;

      // Si hay nuevas preferencias, insertarlas
      if (orderedWorkshopIds.length > 0) {
        const preferencesToInsert = orderedWorkshopIds.map((workshopId, index) => ({
          team_id: teamId,
          event_id: eventId,
          workshop_id: workshopId,
          preference_order: index + 1,
          submitted_by: (submissionStatus as any)?.submittedById || '',
        }));

        const { error: insertError } = await supabase
          .from('workshop_preferences')
          .insert(preferencesToInsert);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-workshop-preferences', eventId, teamId] });
      toast.success('Preferencias actualizadas');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  return {
    workshops,
    workshopsLoading,
    teamPreferences,
    preferencesLoading,
    submissionStatus,
    isLoading: workshopsLoading || preferencesLoading,
    submitPreferences: submitPreferencesMutation.mutateAsync,
    updatePreferences: updatePreferencesMutation.mutateAsync,
    isSubmitting: submitPreferencesMutation.isPending,
    isUpdating: updatePreferencesMutation.isPending,
  };
}

/**
 * Hook para obtener estado de preferencias de todos los equipos (admin)
 */
export function useAllTeamsPreferences(eventId: string) {
  return useQuery({
    queryKey: ['all-teams-preferences', eventId],
    queryFn: async () => {
      // Obtener equipos con registros al evento
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          team_id,
          team:teams(id, name, category),
          participant_count
        `)
        .eq('event_id', eventId)
        .not('team_id', 'is', null);

      if (regError) throw regError;

      // Agrupar por equipo
      const teamsMap = new Map<string, { id: string; name: string; category: string | null; participantCount: number }>();
      registrations?.forEach(reg => {
        if (reg.team_id && reg.team) {
          const existing = teamsMap.get(reg.team_id);
          teamsMap.set(reg.team_id, {
            id: reg.team_id,
            name: (reg.team as any).name,
            category: (reg.team as any).category,
            participantCount: (existing?.participantCount || 0) + (reg.participant_count || 1),
          });
        }
      });

      const teams = Array.from(teamsMap.values());

      // Obtener preferencias de todos los equipos
      const { data: allPreferences, error: prefError } = await supabase
        .from('workshop_preferences')
        .select(`
          team_id,
          submitted_by,
          submitted_at,
          preference_order,
          workshop:workshops(id, name)
        `)
        .eq('event_id', eventId)
        .order('preference_order');

      if (prefError) throw prefError;

      // Obtener perfiles de quienes enviaron
      const submitterIds = [...new Set(allPreferences?.map(p => p.submitted_by) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', submitterIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, `${p.first_name} ${p.last_name}`]));

      // Agrupar preferencias por equipo
      const preferencesMap = new Map<string, {
        preferences: { order: number; workshopName: string }[];
        submittedBy: string;
        submittedAt: string;
      }>();

      allPreferences?.forEach(pref => {
        const existing = preferencesMap.get(pref.team_id);
        const newPref = {
          order: pref.preference_order,
          workshopName: (pref.workshop as any)?.name || '',
        };

        if (existing) {
          existing.preferences.push(newPref);
        } else {
          preferencesMap.set(pref.team_id, {
            preferences: [newPref],
            submittedBy: profilesMap.get(pref.submitted_by) || 'Desconocido',
            submittedAt: pref.submitted_at,
          });
        }
      });

      // Combinar datos
      return teams.map(team => ({
        ...team,
        hasPreferences: preferencesMap.has(team.id),
        preferencesData: preferencesMap.get(team.id) || null,
      }));
    },
    enabled: !!eventId,
  });
}
