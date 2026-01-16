-- Fix RLS policy for user_roles: Allow users to insert their own role during signup
-- But only allow 'participant' role for self-registration (other roles must be assigned by admin)

CREATE POLICY "Users can insert own participant role" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'participant'::app_role
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

-- Allow admins to assign any role to users
-- (Already covered by "Admins can manage all roles" policy)