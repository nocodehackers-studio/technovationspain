-- =====================================================
-- SECURE VIEWS FOR AUTHORIZED_STUDENTS AND AUTHORIZED_USERS
-- Protects sensitive PII (parent emails, phone, school, age)
-- =====================================================

-- 1. Create secure view for authorized_students
-- Only exposes columns needed for verification
CREATE VIEW public.authorized_students_safe
WITH (security_invoker = on) AS
  SELECT 
    id,
    email,
    tg_id,
    matched_profile_id
    -- EXCLUDES: phone, parent_name, parent_email, school_name, age, 
    -- first_name, last_name, city, state, team_name, team_division, etc.
  FROM public.authorized_students;

-- 2. Create secure view for authorized_users
CREATE VIEW public.authorized_users_safe
WITH (security_invoker = on) AS
  SELECT 
    id,
    email,
    tg_id,
    profile_type,
    matched_profile_id
    -- EXCLUDES: phone, parent_name, parent_email, school_name, company_name,
    -- first_name, last_name, city, state, team_name, etc.
  FROM public.authorized_users;

-- 3. Update RLS on authorized_students base table
-- Remove policy that exposes all columns to users
DROP POLICY IF EXISTS "Users can check their own authorization" ON public.authorized_students;

-- Keep admin policy but make it explicit for SELECT
-- The existing "Admins can manage authorized students" covers ALL operations
-- We need to ensure it's the only SELECT policy

-- 4. Update RLS on authorized_users base table
DROP POLICY IF EXISTS "Users can check their own authorization" ON public.authorized_users;

-- 5. Grant SELECT on views to authenticated users
GRANT SELECT ON public.authorized_students_safe TO authenticated;
GRANT SELECT ON public.authorized_users_safe TO authenticated;

-- Note: Views with security_invoker=on inherit RLS from base tables
-- Since base tables now only allow admin SELECT, users can only see
-- rows from the view that match their email (via the base table's admin policy)
-- 
-- However, we need a different approach: the view should allow users to
-- query their own record. We'll use a function to check ownership.

-- 6. Create helper function to check if user can access authorized_students row
CREATE OR REPLACE FUNCTION public.can_access_authorized_student(student_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(auth.uid(), 'admin') 
    OR lower(student_email) = lower((SELECT email FROM profiles WHERE id = auth.uid()))
$$;

-- 7. Create helper function to check if user can access authorized_users row
CREATE OR REPLACE FUNCTION public.can_access_authorized_user(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(auth.uid(), 'admin') 
    OR lower(user_email) = lower((SELECT email FROM profiles WHERE id = auth.uid()))
$$;

-- 8. Add RLS policy to authorized_students for the safe view
-- Users can only SELECT via the view if it's their own email
CREATE POLICY "Users can check own authorization via safe view"
ON public.authorized_students FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR lower(email) = lower((SELECT email FROM profiles WHERE id = auth.uid()))
);

-- 9. Add RLS policy to authorized_users for the safe view
CREATE POLICY "Users can check own authorization via safe view"
ON public.authorized_users FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR lower(email) = lower((SELECT email FROM profiles WHERE id = auth.uid()))
);

-- Note: The key security here is that:
-- 1. Views only expose safe columns (id, email, tg_id, matched_profile_id)
-- 2. Base table RLS ensures users can only see their own row
-- 3. Admin can still access full table directly
-- 4. Triggers with SECURITY DEFINER bypass RLS and continue working