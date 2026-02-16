-- ============================================================
-- 003: Triggers (consolidated)
-- All 11 triggers — net final state (includes 2 orphaned student-based for production parity)
-- ============================================================

-- 1. on_auth_user_created — create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. update_profiles_updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. update_teams_updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. update_authorized_students_updated_at
CREATE TRIGGER update_authorized_students_updated_at
  BEFORE UPDATE ON public.authorized_students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. auto_verify_before_profile_insert — student-based auto-verify (BEFORE INSERT)
-- Note: Orphaned trigger — function exists but logic superseded by user-based triggers.
-- Kept for production parity (never explicitly dropped in original migrations).
CREATE TRIGGER auto_verify_before_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_verify_authorized_student_before();

-- 6. on_profile_created_before — auto-verify authorized users (BEFORE INSERT)
CREATE TRIGGER on_profile_created_before
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_verify_authorized_user_before();

-- 7. auto_verify_after_profile_insert — student-based auto-verify (AFTER INSERT)
-- Note: Orphaned trigger — function exists but logic superseded by user-based triggers.
-- Kept for production parity (never explicitly dropped in original migrations).
CREATE TRIGGER auto_verify_after_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_verify_authorized_student_after();

-- 8. on_profile_created_after — assign role + link team (AFTER INSERT)
CREATE TRIGGER on_profile_created_after
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_verify_authorized_user_after();

-- 7. update_authorized_users_updated_at
CREATE TRIGGER update_authorized_users_updated_at
  BEFORE UPDATE ON public.authorized_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. update_development_tickets_updated_at
CREATE TRIGGER update_development_tickets_updated_at
  BEFORE UPDATE ON public.development_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. update_event_email_templates_updated_at
CREATE TRIGGER update_event_email_templates_updated_at
  BEFORE UPDATE ON public.event_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
