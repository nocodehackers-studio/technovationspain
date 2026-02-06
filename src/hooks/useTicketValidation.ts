import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export type ValidationError = 'not_found' | 'already_checked_in' | 'wrong_date' | 'cancelled' | 'waitlisted' | 'consent_not_given';

export interface ValidationRegistration {
  id: string;
  display_name: string;
  ticket_type: string;
  event_name: string;
  team_name?: string;
  is_companion?: boolean;
}

export interface TicketValidationResult {
  valid: boolean;
  error?: ValidationError;
  registration?: ValidationRegistration;
}

const SUPABASE_URL = "https://orvkqnbshkxzyhqpjsdw.supabase.co";

/**
 * Hook to validate a ticket via the secure Edge Function.
 * This approach ensures volunteers cannot access sensitive PII (DNI, email, phone).
 * The Edge Function validates the QR code server-side and returns only minimal display data.
 */
export function useTicketValidation(code: string | undefined) {
  return useQuery<TicketValidationResult>({
    queryKey: ['ticket-validation', code],
    queryFn: async () => {
      if (!code) {
        return { valid: false, error: 'not_found' as const };
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('validate-ticket', {
        body: { qr_code: code }
      });

      if (response.error) {
        console.error('Edge function error:', response.error);
        throw new Error(response.error.message || 'Validation failed');
      }

      return response.data as TicketValidationResult;
    },
    enabled: !!code,
    retry: false,
    staleTime: 0, // Always refetch on new code
  });
}

// Re-export for backwards compatibility if needed
export type { ValidationError as TicketValidationError };
