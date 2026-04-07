-- ============================================================================
-- Cleanup: Remove staging demo seed data
-- Target: bmucwkjfvblnfigsganm.supabase.co (STAGING ONLY)
-- Only removes data created by seed_staging_demo.sql
-- ============================================================================

DO $$
BEGIN
  -- 1. Remove panel assignments for seeded judges/teams
  DELETE FROM public.judging_panel_judges WHERE judge_id IN (
    SELECT id FROM profiles WHERE email LIKE 'hola+juez%@nocodehackers.es');
  DELETE FROM public.judging_panel_teams WHERE team_id IN (
    SELECT id FROM teams WHERE tg_team_id LIKE 'DEMO-%');

  -- 2. Remove event team registrations
  DELETE FROM public.event_teams WHERE team_id IN (
    SELECT id FROM teams WHERE tg_team_id LIKE 'DEMO-%');

  -- 3. Remove judge assignments
  DELETE FROM public.judge_assignments WHERE user_id IN (
    SELECT id FROM profiles WHERE email LIKE 'hola+juez%@nocodehackers.es');

  -- 4. Remove team members
  DELETE FROM public.team_members WHERE team_id IN (
    SELECT id FROM teams WHERE tg_team_id LIKE 'DEMO-%');

  -- 5. Remove user roles
  DELETE FROM public.user_roles WHERE user_id IN (
    SELECT id FROM profiles WHERE email LIKE 'hola+juez%@nocodehackers.es');

  -- 6. Remove profiles
  DELETE FROM public.profiles WHERE email LIKE 'hola+juez%@nocodehackers.es';

  -- 7. Remove auth users
  DELETE FROM auth.users WHERE email LIKE 'hola+juez%@nocodehackers.es';

  -- 8. Remove demo teams
  DELETE FROM public.teams WHERE tg_team_id LIKE 'DEMO-%';

  -- Note: Hubs are NOT deleted (shared with real data)

  RAISE NOTICE 'Staging demo cleanup complete';
END $$;
