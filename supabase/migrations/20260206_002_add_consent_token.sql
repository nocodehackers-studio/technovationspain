-- Add consent_token for secure public consent URLs (prevents ticket enumeration)
ALTER TABLE public.event_registrations
  ADD COLUMN consent_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Unique index for fast lookup by consent_token
CREATE UNIQUE INDEX idx_event_registrations_consent_token
  ON public.event_registrations(consent_token);
