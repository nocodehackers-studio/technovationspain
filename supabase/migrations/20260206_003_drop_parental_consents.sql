-- Drop legacy parental_consents table (replaced by event_ticket_consents)
DROP POLICY IF EXISTS "Users can view own consents" ON public.parental_consents;
DROP POLICY IF EXISTS "Users can insert own consents" ON public.parental_consents;
DROP POLICY IF EXISTS "Public can update consents by token" ON public.parental_consents;
DROP TABLE IF EXISTS public.parental_consents;
