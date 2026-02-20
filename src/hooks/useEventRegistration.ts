import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateQRCode, generateRegistrationNumber } from '@/lib/qr-generator';
import { Tables } from '@/integrations/supabase/types';
import { isMinor as checkIsMinor } from '@/lib/age-utils';

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
  team_id?: string;
  team_id_tg?: string;
  tg_email?: string;
  is_companion?: boolean;
  companion_of_registration_id?: string;
  image_consent: boolean;
  data_consent: boolean;
  companions?: CompanionData[];
  signer_full_name?: string;        // Set by ConsentModal for adults
  signer_dni?: string;              // Set by ConsentModal for adults
  date_of_birth?: string | null;    // Always passed from profile.date_of_birth
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useEventRegistration(eventId: string) {
  const queryClient = useQueryClient();
  
  const registerMutation = useMutation({
    mutationFn: async (formData: RegistrationFormData) => {
      const isMinorUser = checkIsMinor(formData.date_of_birth);

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

      // Check parent_email for minors
      if (isMinorUser && user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('parent_email')
          .eq('id', user.id)
          .single();

        if (!profileData?.parent_email) {
          throw new Error('Para inscribir a un menor es necesario tener el email del padre/madre/tutor en tu perfil. Ve a tu perfil y añádelo.');
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
      const isWaitlist = availableSpots < totalSpotsNeeded;
      
      // 2. Generate codes for main registration
      const qrCode = generateQRCode();
      const registrationNumber = generateRegistrationNumber();
      
      // 3. Resolve team_id: from formData, team_members, or name match
      let resolvedTeamId: string | null = formData.team_id || null;
      let resolvedTeamName: string | null = formData.team_name || null;

      if (!resolvedTeamId && user) {
        // Check if user belongs to a team via team_members (filter by participant to avoid
        // conflicts when a user is both mentor and participant in different teams)
        const { data: membership } = await supabase
          .from('team_members')
          .select('team_id, team:teams(id, name)')
          .eq('user_id', user.id)
          .eq('member_type', 'participant')
          .limit(1)
          .maybeSingle();

        if (membership?.team_id) {
          resolvedTeamId = membership.team_id;
          const team = membership.team as { id: string; name: string } | null;
          if (team?.name) resolvedTeamName = team.name;
        }
      }

      // If still no team_id but user typed a team name, try to match
      if (!resolvedTeamId && resolvedTeamName) {
        const { data: matchedTeam } = await supabase
          .from('teams')
          .select('id')
          .ilike('name', resolvedTeamName)
          .maybeSingle();

        if (matchedTeam?.id) resolvedTeamId = matchedTeam.id;
      }

      // 4. Create main registration
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
          team_id: resolvedTeamId,
          team_name: resolvedTeamName,
          team_id_tg: formData.team_id_tg || null,
          tg_email: formData.tg_email || null,
          is_companion: formData.is_companion || false,
          companion_of_registration_id: formData.companion_of_registration_id || null,
          qr_code: qrCode,
          registration_number: registrationNumber,
          registration_status: isWaitlist ? 'waitlisted' : 'confirmed',
          image_consent: formData.image_consent,
          data_consent: formData.data_consent,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // 4. Create companions if any (only for confirmed registrations)
      if (!isWaitlist && formData.companions && formData.companions.length > 0) {
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
      
      // 5. Update counters only for confirmed registrations (waitlist doesn't consume capacity)
      if (!isWaitlist) {
        const companionsCreated = formData.companions?.length || 0;
        await supabase.rpc('increment_registration_count', {
          p_event_id: eventId,
          p_ticket_type_id: formData.ticket_type_id,
          p_companions_count: companionsCreated,
        });
      }
      
      // 6. Consent tracking (scoped outside blocks so it's always accessible)
      let consentFailed = false;

      // 7. Send confirmation email (QR ticket) only for confirmed registrations
      if (!isWaitlist) {
        try {
          await supabase.functions.invoke('send-registration-confirmation', {
            body: { registrationId: registration.id },
          });
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Don't throw - registration was successful, email is secondary
        }

        // 8. Consent handling (conditional on age)
        if (!isMinorUser && formData.signer_full_name) {
          // Adult path: use edge function (bypasses RLS) to record consent
          try {
            const response = await supabase.functions.invoke('submit-event-consent', {
              body: {
                consent_token: registration.consent_token,
                signer_full_name: formData.signer_full_name,
                signer_dni: formData.signer_dni || '',
                signer_relationship: 'self',
                signature: formData.signer_full_name,
              },
            });
            // Check transport-level error (HTTP 4xx/5xx)
            if (response.error) throw response.error;
            // Check application-level error (HTTP 200 with error in body)
            if (response.data?.error) {
              throw new Error(response.data.message || response.data.error);
            }
          } catch (consentErr) {
            console.error('CONSENT_INSERT_FAILED: Adult consent failed after registration', {
              registrationId: registration.id,
              error: consentErr,
            });
            consentFailed = true;
            // Don't throw — registration succeeded. Fallback via consent_token.
          }
        } else if (isMinorUser) {
          // Minor path: send consent email to parent_email
          try {
            await supabase.functions.invoke('send-event-consent', {
              body: { registrationId: registration.id },
            });
          } catch (consentError) {
            console.error('CONSENT_EMAIL_FAILED: Manual intervention required', {
              registrationId: registration.id,
              error: consentError,
            });
            // Don't throw - registration was successful, but admin should resend consent
          }
        }
      }

      return { ...registration, consent_failed: consentFailed };
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
          ticket_type:event_ticket_types(*),
          consent:event_ticket_consents(id)
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
      
      const wasWaitlisted = registration.registration_status === 'waitlisted';
      
      // 2. Update status to cancelled
      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({ registration_status: 'cancelled' })
        .eq('id', registrationId);
      
      if (updateError) {
        throw new Error('Error al cancelar la entrada');
      }
      
      // 3. Decrement counters only if was confirmed (waitlisted didn't consume capacity)
      if (!wasWaitlisted) {
        const companionsCount = (registration.companions as any[])?.length || 0;
        
        await supabase.rpc('decrement_registration_count', {
          p_event_id: registration.event_id,
          p_ticket_type_id: registration.ticket_type_id,
          p_companions_count: companionsCount,
        });
      }

      // 4. Send cancellation email (fire and forget)
      supabase.functions.invoke("send-cancellation-email", {
        body: { registrationId },
      }).catch((err) => console.error("Cancellation email error:", err));

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
