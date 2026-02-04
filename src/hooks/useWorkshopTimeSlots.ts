import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WorkshopTimeSlot } from '@/types/database';

/**
 * Hook para gestionar turnos horarios de talleres
 */
export function useWorkshopTimeSlots(eventId: string) {
  const queryClient = useQueryClient();

  // Obtener turnos del evento
  const { data: timeSlots, isLoading } = useQuery({
    queryKey: ['workshop-time-slots', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_time_slots')
        .select('*')
        .eq('event_id', eventId)
        .order('slot_number');
      
      if (error) throw error;
      return data as WorkshopTimeSlot[];
    },
    enabled: !!eventId,
  });

  // Crear turno
  const createSlotMutation = useMutation({
    mutationFn: async (slot: Omit<WorkshopTimeSlot, 'id' | 'created_at'>) => {
      const { error } = await supabase
        .from('workshop_time_slots')
        .insert(slot);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-time-slots', eventId] });
      toast.success('Turno creado correctamente');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Actualizar turno
  const updateSlotMutation = useMutation({
    mutationFn: async ({ 
      slotId, 
      updates 
    }: { 
      slotId: string; 
      updates: Partial<WorkshopTimeSlot>; 
    }) => {
      const { error } = await supabase
        .from('workshop_time_slots')
        .update(updates)
        .eq('id', slotId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-time-slots', eventId] });
      toast.success('Turno actualizado');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Eliminar turno
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from('workshop_time_slots')
        .delete()
        .eq('id', slotId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-time-slots', eventId] });
      toast.success('Turno eliminado');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Guardar todos los turnos (reemplaza los existentes)
  const saveAllSlotsMutation = useMutation({
    mutationFn: async (slots: { slot_number: number; start_time: string; end_time: string }[]) => {
      // Eliminar turnos existentes
      const { error: deleteError } = await supabase
        .from('workshop_time_slots')
        .delete()
        .eq('event_id', eventId);

      if (deleteError) throw deleteError;

      // Insertar nuevos turnos
      if (slots.length > 0) {
        const slotsToInsert = slots.map(slot => ({
          event_id: eventId,
          ...slot,
        }));

        const { error: insertError } = await supabase
          .from('workshop_time_slots')
          .insert(slotsToInsert);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-time-slots', eventId] });
      toast.success('Turnos guardados correctamente');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  return {
    timeSlots,
    isLoading,
    createSlot: createSlotMutation.mutateAsync,
    updateSlot: updateSlotMutation.mutateAsync,
    deleteSlot: deleteSlotMutation.mutateAsync,
    saveAllSlots: saveAllSlotsMutation.mutateAsync,
    isCreating: createSlotMutation.isPending,
    isUpdating: updateSlotMutation.isPending,
    isDeleting: deleteSlotMutation.isPending,
    isSaving: saveAllSlotsMutation.isPending,
  };
}
