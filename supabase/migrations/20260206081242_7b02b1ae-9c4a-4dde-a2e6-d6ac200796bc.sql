-- Create event_ticket_consents table for storing consent records
CREATE TABLE public.event_ticket_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id UUID NOT NULL UNIQUE REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  signer_full_name TEXT NOT NULL,
  signer_dni TEXT NOT NULL,
  signer_relationship TEXT NOT NULL,
  signature TEXT NOT NULL,
  minor_name TEXT,
  minor_age INTEGER,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_ticket_consents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert consent for their own registrations
CREATE POLICY "Users can insert consent for own registrations"
ON public.event_ticket_consents
FOR INSERT
WITH CHECK (
  event_registration_id IN (
    SELECT id FROM public.event_registrations WHERE user_id = auth.uid()
  )
);

-- Policy: Users can view their own consents
CREATE POLICY "Users can view own consents"
ON public.event_ticket_consents
FOR SELECT
USING (
  event_registration_id IN (
    SELECT id FROM public.event_registrations WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Policy: Admins can manage all consents
CREATE POLICY "Admins can manage consents"
ON public.event_ticket_consents
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster lookups
CREATE INDEX idx_event_ticket_consents_registration ON public.event_ticket_consents(event_registration_id);