import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { JudgingEventConfig } from '@/types/database';

export function useJudgingConfig(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ['judging-config', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judging_event_config')
        .select('*')
        .eq('event_id', eventId!)
        .maybeSingle();

      if (error) throw error;
      return data as JudgingEventConfig | null;
    },
    enabled: !!eventId,
  });

  const createConfig = useMutation({
    mutationFn: async (config: {
      total_rooms?: number;
      teams_per_group?: number;
      judges_per_group?: number;
      sessions_per_turn?: number;
    }) => {
      const { data, error } = await supabase
        .from('judging_event_config')
        .insert({
          event_id: eventId!,
          total_rooms: config.total_rooms ?? 5,
          teams_per_group: config.teams_per_group ?? 6,
          judges_per_group: config.judges_per_group ?? 6,
          sessions_per_turn: config.sessions_per_turn ?? 2,
        })
        .select()
        .single();

      if (error) throw error;
      return data as JudgingEventConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-config', eventId] });
      toast.success('Configuración de jurado creada');
    },
    onError: (error: any) => {
      toast.error(`Error al crear configuración: ${error.message}`);
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (config: {
      id: string;
      total_rooms?: number;
      teams_per_group?: number;
      judges_per_group?: number;
      sessions_per_turn?: number;
    }) => {
      const { id, ...updates } = config;
      const { data, error } = await supabase
        .from('judging_event_config')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as JudgingEventConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-config', eventId] });
      toast.success('Configuración actualizada');
    },
    onError: (error: any) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  return {
    config: configQuery.data,
    isLoading: configQuery.isLoading,
    error: configQuery.error,
    createConfig: createConfig.mutateAsync,
    updateConfig: updateConfig.mutateAsync,
    isCreating: createConfig.isPending,
    isUpdating: updateConfig.isPending,
  };
}
