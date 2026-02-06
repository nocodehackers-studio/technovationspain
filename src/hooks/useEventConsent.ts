import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cleanAndValidateDNI } from '@/lib/validation-utils';

interface PublicConsentData {
  consent_token: string;
  signer_full_name: string;
  signer_dni: string;
  signer_relationship: string;
  signature: string;
  minor_name?: string;
  minor_age?: number;
}

interface RegistrationConsentData {
  event_registration_id: string;
  signer_full_name: string;
  signer_dni: string;
}

export type ConsentError =
  | 'not_found'
  | 'event_already_passed'
  | 'registration_cancelled'
  | 'already_checked_in'
  | 'validation_error'
  | 'insert_failed'
  | 'internal_error';

const ERROR_MESSAGES: Record<ConsentError, string> = {
  not_found: 'Token no válido. Verifica que el enlace es correcto.',
  event_already_passed: 'El evento ya ha pasado.',
  registration_cancelled: 'Esta entrada ha sido cancelada.',
  already_checked_in: 'Esta entrada ya ha sido utilizada. No se puede modificar el consentimiento.',
  validation_error: 'Error de validación. Revisa los datos introducidos.',
  insert_failed: 'Error al guardar el consentimiento. Inténtalo de nuevo.',
  internal_error: 'Error interno. Inténtalo de nuevo.',
};

export function getConsentErrorMessage(error: string): string {
  return ERROR_MESSAGES[error as ConsentError] || 'Error desconocido. Inténtalo de nuevo.';
}

/**
 * Submit consent from public page (no auth required).
 * Uses the consent_token (UUID) from the URL, NOT registration_number.
 */
export function useSubmitPublicConsent() {
  return useMutation({
    mutationFn: async (data: PublicConsentData) => {
      const response = await supabase.functions.invoke('submit-event-consent', {
        body: data,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error al enviar el consentimiento');
      }

      const result = response.data;
      if (result.error) {
        const message = result.message || getConsentErrorMessage(result.error);
        const err = new Error(message);
        (err as any).code = result.error;
        throw err;
      }

      return result;
    },
  });
}

/**
 * Submit consent from authenticated registration flow (adult self-consent).
 * Inserts directly into event_ticket_consents via Supabase client.
 */
export function useSubmitRegistrationConsent() {
  return useMutation({
    mutationFn: async (data: RegistrationConsentData) => {
      const cleanedDni = cleanAndValidateDNI(data.signer_dni, true);
      if (!cleanedDni) {
        throw new Error('DNI/NIE inválido');
      }

      const { error } = await supabase
        .from('event_ticket_consents')
        .insert({
          event_registration_id: data.event_registration_id,
          signer_full_name: data.signer_full_name,
          signer_dni: cleanedDni,
          signer_relationship: 'self',
          signature: data.signer_full_name, // typed name IS the digital signature
          minor_name: null,
          minor_age: null,
        });

      if (error) {
        console.error('CONSENT_INSERT_FAILED:', error);
        throw error;
      }

      return { success: true };
    },
  });
}
