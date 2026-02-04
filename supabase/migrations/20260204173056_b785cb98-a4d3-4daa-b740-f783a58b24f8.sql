-- Allow admins to create and delete event registrations (needed for DEMO data creation)

CREATE POLICY "Admins can insert registrations"
ON public.event_registrations
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete registrations"
ON public.event_registrations
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));