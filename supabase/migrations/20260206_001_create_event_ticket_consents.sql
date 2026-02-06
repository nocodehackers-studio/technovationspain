-- Create event_ticket_consents table for tracking consent per ticket
CREATE TABLE public.event_ticket_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE RESTRICT,
  signer_full_name TEXT NOT NULL,
  signer_dni TEXT NOT NULL,
  signer_relationship TEXT NOT NULL CHECK (signer_relationship IN ('self', 'madre', 'padre', 'tutor')),
  minor_name TEXT,           -- NULL for self-consent (adults)
  minor_age INTEGER,         -- NULL for self-consent (adults)
  signature TEXT NOT NULL,    -- typed full name as digital signature (compliance audit trail)
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,           -- captured by edge function for public submissions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_ticket_consents ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert consent for their own registrations (adult self-consent during registration)
CREATE POLICY "Users can insert consent for own registrations"
  ON public.event_ticket_consents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_registrations er
      WHERE er.id = event_registration_id AND er.user_id = auth.uid()
    )
  );

-- Authenticated users can view consent for their own registrations
CREATE POLICY "Users can view own consent"
  ON public.event_ticket_consents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_registrations er
      WHERE er.id = event_registration_id AND er.user_id = auth.uid()
    )
  );

-- Admin can view all consents
CREATE POLICY "Admin can view all consents"
  ON public.event_ticket_consents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Anon can insert consent only when event_registration_id matches a real registration
-- (defense-in-depth for the public submit-event-consent edge function)
CREATE POLICY "Anon can insert consent for valid registrations"
  ON public.event_ticket_consents FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_registrations er
      WHERE er.id = event_registration_id
    )
  );

-- Unique constraint + index: one consent per registration (latest wins via ON CONFLICT in code)
CREATE UNIQUE INDEX idx_event_ticket_consents_unique_registration
  ON public.event_ticket_consents(event_registration_id);
