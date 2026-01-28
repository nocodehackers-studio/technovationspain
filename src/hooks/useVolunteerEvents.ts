import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EventVolunteerSignup {
  id: string;
  event_id: string;
  user_id: string;
  notes: string | null;
  created_at: string;
  event: {
    id: string;
    name: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    location_name: string | null;
    location_city: string | null;
    status: string | null;
  };
}

export interface EventVolunteerWithProfile {
  id: string;
  event_id: string;
  user_id: string;
  notes: string | null;
  created_at: string;
  profile: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  };
}

export function useVolunteerEvents(userId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch user's volunteer signups
  const { data: mySignups, isLoading: isLoadingSignups } = useQuery({
    queryKey: ['volunteer-signups', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('event_volunteers')
        .select(`
          id,
          event_id,
          user_id,
          notes,
          created_at,
          event:events (
            id,
            name,
            date,
            start_time,
            end_time,
            location_name,
            location_city,
            status
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as EventVolunteerSignup[];
    },
    enabled: !!userId,
  });

  // Fetch all published events
  const { data: availableEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['volunteer-available-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, date, start_time, end_time, location_name, location_city, status, description')
        .eq('status', 'published')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Sign up mutation
  const signupMutation = useMutation({
    mutationFn: async ({ eventId, notes }: { eventId: string; notes?: string }) => {
      if (!userId) throw new Error('No user ID');
      
      const { data, error } = await supabase
        .from('event_volunteers')
        .insert({
          event_id: eventId,
          user_id: userId,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer-signups', userId] });
      toast.success('¡Te has apuntado como voluntario/a!');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('Ya estás inscrito/a en este evento');
      } else {
        toast.error(`Error: ${error.message}`);
      }
    },
  });

  // Cancel signup mutation
  const cancelMutation = useMutation({
    mutationFn: async (signupId: string) => {
      const { error } = await supabase
        .from('event_volunteers')
        .delete()
        .eq('id', signupId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer-signups', userId] });
      toast.success('Inscripción cancelada');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Get IDs of events user is signed up for
  const signedUpEventIds = mySignups?.map(s => s.event_id) || [];

  return {
    mySignups,
    availableEvents,
    signedUpEventIds,
    isLoading: isLoadingSignups || isLoadingEvents,
    signUp: signupMutation.mutate,
    cancelSignup: cancelMutation.mutate,
    isSigningUp: signupMutation.isPending,
    isCanceling: cancelMutation.isPending,
  };
}

// Hook for admin to view event volunteers
export function useEventVolunteers(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: volunteers, isLoading } = useQuery({
    queryKey: ['event-volunteers', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('event_volunteers')
        .select(`
          id,
          event_id,
          user_id,
          notes,
          created_at,
          profile:profiles (
            id,
            email,
            first_name,
            last_name,
            phone
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as EventVolunteerWithProfile[];
    },
    enabled: !!eventId,
  });

  // Remove volunteer mutation (admin only)
  const removeMutation = useMutation({
    mutationFn: async (volunteerId: string) => {
      const { error } = await supabase
        .from('event_volunteers')
        .delete()
        .eq('id', volunteerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-volunteers', eventId] });
      toast.success('Voluntario/a eliminado del evento');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  return {
    volunteers,
    isLoading,
    removeVolunteer: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
  };
}
