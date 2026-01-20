import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toZonedTime } from 'date-fns-tz';
import { isSameDay } from 'date-fns';

const TIMEZONE = 'Europe/Madrid';

// Types
export interface EventRegistrationWithEvent {
  id: string;
  qr_code: string;
  first_name: string | null;
  last_name: string | null;
  team_name: string | null;
  checked_in_at: string | null;
  registration_status: string | null;
  event: {
    id: string;
    name: string;
    date: string;
  } | null;
  ticket_type: {
    name: string;
  } | null;
}

export type ValidationError = 'not_found' | 'already_checked_in' | 'wrong_date' | 'cancelled';

export interface TicketValidationResult {
  isValid: boolean;
  registration: EventRegistrationWithEvent | null;
  error: ValidationError | null;
}

// Helper: Get today's date in Madrid timezone
function getTodayInMadrid(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

// Helper: Parse event date string as Madrid timezone date
// event.date from DB is a DATE string like "2026-01-20" (no timezone info)
// We need to interpret it as a date in Madrid, not local device timezone
function parseEventDateInMadrid(dateString: string): Date {
  // Create date at midnight in Madrid by treating the date string as Madrid local
  // Then convert to the same zoned representation for comparison
  const [year, month, day] = dateString.split('-').map(Number);
  // Create a UTC date at midnight, then convert to Madrid zone
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Use noon to avoid DST edge cases
  return toZonedTime(utcDate, TIMEZONE);
}

// Validation function
export function validateTicket(registration: EventRegistrationWithEvent | null): TicketValidationResult {
  // 1. Not found
  if (!registration) {
    return { isValid: false, registration: null, error: 'not_found' };
  }

  // 2. Cancelled
  if (registration.registration_status === 'cancelled') {
    return { isValid: false, registration, error: 'cancelled' };
  }

  // 3. Already checked in (either by timestamp or status)
  if (registration.checked_in_at !== null || registration.registration_status === 'checked_in') {
    return { isValid: false, registration, error: 'already_checked_in' };
  }

  // 4. Wrong date (event date !== today in Madrid timezone)
  if (registration.event?.date) {
    const todayMadrid = getTodayInMadrid();
    const eventDateMadrid = parseEventDateInMadrid(registration.event.date);

    if (!isSameDay(todayMadrid, eventDateMadrid)) {
      return { isValid: false, registration, error: 'wrong_date' };
    }
  }

  // 5. Valid
  return { isValid: true, registration, error: null };
}

// Hook: Lookup ticket by QR code
export function useTicketLookup(code: string | undefined) {
  return useQuery({
    queryKey: ['ticket-lookup', code],
    queryFn: async () => {
      if (!code) return null;

      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          id,
          qr_code,
          first_name,
          last_name,
          team_name,
          checked_in_at,
          registration_status,
          event:events(id, name, date),
          ticket_type:event_ticket_types(name)
        `)
        .eq('qr_code', code)
        .maybeSingle();

      if (error) throw error;
      return data as EventRegistrationWithEvent | null;
    },
    enabled: !!code,
  });
}

// Hook: Check-in mutation
export function useCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async ({ registrationId }: { registrationId: string }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('event_registrations')
        .update({
          checked_in_at: new Date().toISOString(),
          checked_in_by: user.id,
          registration_status: 'checked_in',
        })
        .eq('id', registrationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { registrationId }) => {
      // Invalidate the ticket lookup query to reflect the update
      queryClient.invalidateQueries({ queryKey: ['ticket-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['registration', registrationId] });
    },
  });

  return {
    checkIn: mutation.mutateAsync,
    isChecking: mutation.isPending,
    checkInError: mutation.error,
  };
}
