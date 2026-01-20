-- Fix 1: Remove hardcoded admin email backdoor
DROP TRIGGER IF EXISTS on_profile_created_assign_admin ON public.profiles;
DROP FUNCTION IF EXISTS public.assign_admin_role_for_approved_emails();

-- Fix 2: Add explicit authentication requirement for profiles table
-- Modify the SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND (
      auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role)
    )
  );