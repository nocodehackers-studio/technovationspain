-- Update RLS policy to allow users to insert their own participant role
-- when they don't have any roles yet (for whitelist-verified users during onboarding)
DROP POLICY IF EXISTS "Users can insert own participant role" ON user_roles;

CREATE POLICY "Users can insert own participant role" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'participant'::app_role
  AND (
    -- Allow if user has no roles yet
    NOT EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid())
    -- OR if their profile is verified (from whitelist)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.verification_status = 'verified')
  )
);