-- Drop existing restrictive policy and create new one allowing mentor and judge self-registration
DROP POLICY IF EXISTS "Users can insert own participant role" ON public.user_roles;

CREATE POLICY "Users can insert own allowed role" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND role IN ('participant'::app_role, 'mentor'::app_role, 'judge'::app_role)
  AND (
    NOT EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.verification_status = 'verified'::verification_status)
  )
);