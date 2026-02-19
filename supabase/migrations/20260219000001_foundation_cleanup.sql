-- ============================================================
-- Foundation Cleanup Migration (Spec 1/3)
-- Adds new columns, migrates data, creates storage bucket,
-- drops all legacy whitelist infrastructure
-- ============================================================

-- ============================================================
-- 1a. Add columns to profiles
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_volunteer BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

-- ============================================================
-- 1b. Add columns to csv_imports and fix status CHECK constraint
-- ============================================================

ALTER TABLE public.csv_imports ADD COLUMN IF NOT EXISTS import_type TEXT;
ALTER TABLE public.csv_imports ADD COLUMN IF NOT EXISTS storage_paths JSONB;
ALTER TABLE public.csv_imports ADD COLUMN IF NOT EXISTS admin_email TEXT;
ALTER TABLE public.csv_imports ADD COLUMN IF NOT EXISTS records_activated INTEGER DEFAULT 0;

-- Existing CHECK only allows ('processing', 'completed', 'failed').
-- Spec 3 needs 'pending' status. Update constraint now.
ALTER TABLE public.csv_imports DROP CONSTRAINT IF EXISTS csv_imports_status_check;
ALTER TABLE public.csv_imports ADD CONSTRAINT csv_imports_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- ============================================================
-- 1c. Migrate data from authorized_users → profiles
-- ============================================================

UPDATE public.profiles p
SET city = au.city, state = au.state, school_name = au.school_name,
    company_name = au.company_name, parent_name = au.parent_name,
    profile_type = au.profile_type
FROM public.authorized_users au
WHERE au.matched_profile_id = p.id
  AND au.matched_profile_id IS NOT NULL;

-- ============================================================
-- 1d. Populate is_volunteer from existing user_roles
-- ============================================================

UPDATE public.profiles p
SET is_volunteer = true
FROM public.user_roles ur
WHERE ur.user_id = p.id AND ur.role = 'volunteer'::app_role;

-- ============================================================
-- 1e. Create private Storage bucket csv-imports
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('csv-imports', 'csv-imports', false)
ON CONFLICT (id) DO NOTHING;

-- Admin-only INSERT
CREATE POLICY "Admins can upload CSV imports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'csv-imports' AND public.has_role(auth.uid(), 'admin'));

-- Admin-only SELECT
CREATE POLICY "Admins can read CSV imports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'csv-imports' AND public.has_role(auth.uid(), 'admin'));

-- Admin-only UPDATE
CREATE POLICY "Admins can update CSV imports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'csv-imports' AND public.has_role(auth.uid(), 'admin'));

-- Admin-only DELETE
CREATE POLICY "Admins can delete CSV imports"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'csv-imports' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 1f. Drop triggers on profiles (auto-verify)
-- ============================================================

DROP TRIGGER IF EXISTS auto_verify_before_profile_insert ON public.profiles;
DROP TRIGGER IF EXISTS auto_verify_after_profile_insert ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_before ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_after ON public.profiles;

-- ============================================================
-- 1g. Drop triggers on legacy tables
-- ============================================================

DROP TRIGGER IF EXISTS update_authorized_students_updated_at ON public.authorized_students;
DROP TRIGGER IF EXISTS update_authorized_users_updated_at ON public.authorized_users;

-- ============================================================
-- 1h. Drop functions
-- ============================================================

DROP FUNCTION IF EXISTS public.auto_verify_authorized_student_before();
DROP FUNCTION IF EXISTS public.auto_verify_authorized_student_after();
DROP FUNCTION IF EXISTS public.auto_verify_authorized_user_before();
DROP FUNCTION IF EXISTS public.auto_verify_authorized_user_after();
DROP FUNCTION IF EXISTS public.can_access_authorized_student(text);
DROP FUNCTION IF EXISTS public.can_access_authorized_user(text);

-- ============================================================
-- 1i. Drop views (grants automatically revoked)
-- ============================================================

DROP VIEW IF EXISTS public.authorized_students_safe;
DROP VIEW IF EXISTS public.authorized_users_safe;

-- ============================================================
-- 1j. Drop RLS policies
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage authorized students" ON public.authorized_students;
DROP POLICY IF EXISTS "Users can check own authorization via safe view" ON public.authorized_students;
DROP POLICY IF EXISTS "Admins can manage authorized users" ON public.authorized_users;
DROP POLICY IF EXISTS "Users can check own authorization via safe view" ON public.authorized_users;

-- ============================================================
-- 1k. Drop tables
-- ============================================================

DROP TABLE IF EXISTS public.authorized_students;
DROP TABLE IF EXISTS public.authorized_users;
