-- Add policy for admins to manage companions
CREATE POLICY "Admins can manage all companions"
ON public.companions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));