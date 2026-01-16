import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateQRCode, generateRegistrationNumber } from '@/lib/qr-generator';
import { Tables } from '@/integrations/supabase/types';

type Event = Tables<'events'>;
type TicketType = Tables<'event_ticket_types'>;
type EventRegistration = Tables<'event_registrations'>;

interface EventWithDetails extends Event {
  ticket_types: TicketType[];
  agenda: Tables<'event_agenda'>[];
}

interface RegistrationFormData {
  ticket_type_id: string;
  first_name: string;
  last_name: string;
  email: string;
  dni?: string;
  phone?: string;
  team_name?: string;
  team_id_tg?: string;
  tg_email?: string;
  is_companion?: boolean;
  companion_of_registration_id?: string;
  image_consent: boolean;
  data_consent: boolean;
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types:event_ticket_types(*),
          agenda:event_agenda(*)
        `)
        .eq('id', eventId)
        .single();
      
      if (error) throw error;
      return data as EventWithDetails;
    },
    enabled: !!eventId,
  });
}

export function useEventsList() {
  return useQuery({
    queryKey: ['events', 'published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types:event_ticket_types(*)
        `)
        .eq('status', 'published')
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useExistingRegistration(eventId: string) {
  return useQuery({
    queryKey: ['existing-registration', eventId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('event_registrations')
        .select('id, registration_status, registration_number')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      return data;
    },
    enabled: !!eventId,
  });
}

export function useEventRegistration(eventId: string) {
  const queryClient = useQueryClient();
  
  const registerMutation = useMutation({
    mutationFn: async (formData: RegistrationFormData) => {
      // 0. Check if user is already registered
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: existingRegistration } = await supabase
          .from('event_registrations')
          .select('id, registration_status')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (existingRegistration) {
          throw new Error('Ya estás inscrito en este evento. Puedes ver tu entrada en "Mis entradas".');
        }
      }
      
      // 1. Check capacity
      const { data: ticketType, error: ticketError } = await supabase
        .from('event_ticket_types')
        .select('max_capacity, current_count')
        .eq('id', formData.ticket_type_id)
        .single();
      
      if (ticketError || !ticketType) {
        throw new Error('Tipo de entrada no encontrado');
      }
      
      if (ticketType.current_count !== null && 
          ticketType.max_capacity !== null && 
          ticketType.current_count >= ticketType.max_capacity) {
        throw new Error('Lo sentimos, no quedan plazas disponibles para este tipo de entrada');
      }
      
      // 2. Generate codes (unique, no count needed)
      const qrCode = generateQRCode();
      const registrationNumber = generateRegistrationNumber();
      
      // 4. User already fetched above
      
      // 5. Create registration
      const { data: registration, error } = await supabase
        .from('event_registrations')
        .insert({
          event_id: eventId,
          ticket_type_id: formData.ticket_type_id,
          user_id: user?.id || null,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          dni: formData.dni || null,
          phone: formData.phone || null,
          team_name: formData.team_name || null,
          team_id_tg: formData.team_id_tg || null,
          tg_email: formData.tg_email || null,
          is_companion: formData.is_companion || false,
          companion_of_registration_id: formData.companion_of_registration_id || null,
          qr_code: qrCode,
          registration_number: registrationNumber,
          registration_status: 'confirmed',
          image_consent: formData.image_consent,
          data_consent: formData.data_consent,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // 6. Update counters
      await supabase.rpc('increment_registration_count', {
        p_event_id: eventId,
        p_ticket_type_id: formData.ticket_type_id,
      });
      
      // 7. Send confirmation email
      try {
        await supabase.functions.invoke('send-registration-confirmation', {
          body: { registrationId: registration.id },
        });
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't throw - registration was successful, email is secondary
      }
      
      return registration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
  
  return {
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    error: registerMutation.error,
  };
}

export function useMyRegistrations() {
  return useQuery({
    queryKey: ['my-registrations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          *,
          event:events(*),
          ticket_type:event_ticket_types(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useRegistration(registrationId: string) {
  return useQuery({
    queryKey: ['registration', registrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          *,
          event:events(*),
          ticket_type:event_ticket_types(*)
        `)
        .eq('id', registrationId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!registrationId,
  });
}
