-- ============================================================
-- 005: Views and Grants (consolidated)
-- 2 secure views + 4 permission grants
-- ============================================================

-- 1. authorized_students_safe (from 20260128172237)
CREATE VIEW public.authorized_students_safe
WITH (security_invoker = on) AS
  SELECT
    id,
    email,
    tg_id,
    matched_profile_id
  FROM public.authorized_students;

-- 2. authorized_users_safe (from 20260128172237)
CREATE VIEW public.authorized_users_safe
WITH (security_invoker = on) AS
  SELECT
    id,
    email,
    tg_id,
    profile_type,
    matched_profile_id
  FROM public.authorized_users;

-- Grants on views
GRANT SELECT ON public.authorized_students_safe TO authenticated;
GRANT SELECT ON public.authorized_users_safe TO authenticated;

-- Grants on functions
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated;
