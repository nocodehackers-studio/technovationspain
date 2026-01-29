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

interface CompanionData {
  first_name: string;
  last_name: string;
  dni: string;
  relationship: string;
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
  companions?: CompanionData[];
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
        .neq('registration_status', 'cancelled') // Exclude cancelled registrations
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
      // 0. Check if user is already registered (excluding cancelled)
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: existingRegistration } = await supabase
          .from('event_registrations')
          .select('id, registration_status')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .neq('registration_status', 'cancelled') // Allow re-registration if cancelled
          .maybeSingle();
        
        if (existingRegistration) {
          throw new Error('Ya estás inscrito en este evento. Puedes ver tu entrada en "Mis entradas".');
        }
      }
      
      // 1. Check capacity (including companions)
      const companionsCount = formData.companions?.length || 0;
      const totalSpotsNeeded = 1 + companionsCount; // Main person + companions
      
      const { data: ticketType, error: ticketError } = await supabase
        .from('event_ticket_types')
        .select('max_capacity, current_count')
        .eq('id', formData.ticket_type_id)
        .single();
      
      if (ticketError || !ticketType) {
        throw new Error('Tipo de entrada no encontrado');
      }
      
      const availableSpots = (ticketType.max_capacity ?? 0) - (ticketType.current_count ?? 0);
      
      if (availableSpots < totalSpotsNeeded) {
        if (companionsCount > 0) {
          throw new Error(`No hay suficientes plazas disponibles. Necesitas ${totalSpotsNeeded} plazas (tú + ${companionsCount} acompañante${companionsCount > 1 ? 's' : ''}) pero solo quedan ${availableSpots}.`);
        } else {
          throw new Error('Lo sentimos, no quedan plazas disponibles para este tipo de entrada');
        }
      }
      
      // 2. Generate codes for main registration
      const qrCode = generateQRCode();
      const registrationNumber = generateRegistrationNumber();
      
      // 3. Create main registration
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
      
// 4. Create companions if any
      if (formData.companions && formData.companions.length > 0) {
        const companionsToInsert = formData.companions.map(companion => ({
          event_registration_id: registration.id,
          first_name: companion.first_name || null,
          last_name: companion.last_name || null,
          dni: companion.dni || null,
          relationship: companion.relationship || null,
          qr_code: generateQRCode(), // Each companion gets their own QR code
        }));
        
        const { error: companionError } = await supabase
          .from('companions')
          .insert(companionsToInsert);
        
        if (companionError) {
          console.error('Error creating companions:', companionError);
          // Don't throw - main registration was successful
        }
      }
      
      // 5. Update counters (including companions in the count)
      const companionsCreated = formData.companions?.length || 0;
      await supabase.rpc('increment_registration_count', {
        p_event_id: eventId,
        p_ticket_type_id: formData.ticket_type_id,
        p_companions_count: companionsCreated,
      });
      
      // 6. Send confirmation email (QR ticket)
      try {
        await supabase.functions.invoke('send-registration-confirmation', {
          body: { registrationId: registration.id },
        });
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't throw - registration was successful, email is secondary
      }

      // 7. Send event consent email
      try {
        const consentResult = await supabase.functions.invoke('send-event-consent', {
          body: { registrationId: registration.id },
        });

        // Check for compliance warning and log prominently
        if (consentResult.data?.compliance_warning) {
          console.warn('COMPLIANCE: Event consent sent to minor user email (missing parent_email)', {
            registrationId: registration.id,
            userId: user?.id
          });
        }
      } catch (consentError) {
        // Log failure prominently for manual follow-up
        console.error('CONSENT_EMAIL_FAILED: Manual intervention required', {
          registrationId: registration.id,
          error: consentError
        });
        // Don't throw - registration was successful, but admin should resend consent
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

export function useRegistrationCompanions(registrationId: string) {
  return useQuery({
    queryKey: ['registration-companions', registrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companions')
        .select('*')
        .eq('event_registration_id', registrationId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!registrationId,
  });
}

export function useCancelRegistration() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (registrationId: string) => {
      // 1. Fetch the registration to get event_id, ticket_type_id, and companions count
      const { data: registration, error: fetchError } = await supabase
        .from('event_registrations')
        .select(`
          id,
          event_id,
          ticket_type_id,
          registration_status,
          companions:companions(id)
        `)
        .eq('id', registrationId)
        .single();
      
      if (fetchError || !registration) {
        throw new Error('No se encontró el registro');
      }
      
      if (registration.registration_status === 'cancelled') {
        throw new Error('Esta entrada ya está cancelada');
      }
      
      // 2. Update status to cancelled
      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({ registration_status: 'cancelled' })
        .eq('id', registrationId);
      
      if (updateError) {
        throw new Error('Error al cancelar la entrada');
      }
      
      // 3. Decrement counters (including companions)
      const companionsCount = (registration.companions as any[])?.length || 0;
      
      await supabase.rpc('decrement_registration_count', {
        p_event_id: registration.event_id,
        p_ticket_type_id: registration.ticket_type_id,
        p_companions_count: companionsCount,
      });
      
      return registration;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['registration'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['existing-registration', data.event_id] });
      queryClient.invalidateQueries({ queryKey: ['event', data.event_id] });
    },
  });
}
