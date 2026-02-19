-- Migration: Volunteer Role Cleanup + tg_email Removal
-- Spec: Tech-Spec 2/3 (Auth Flow)
-- PRE-REQUISITE: Run tg_email sync SQL on production before deploying (see Spec 1 Notes)

-- 1a. Remove volunteer entries from user_roles
-- (Data already migrated to profiles.is_volunteer in Spec 1 migration)
DELETE FROM public.user_roles WHERE role = 'volunteer'::app_role;

-- 1b. Drop any RLS policies whose conditions reference 'volunteer'
-- (they would break after the enum swap)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE qual::text LIKE '%volunteer%'
       OR with_check::text LIKE '%volunteer%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'Dropped policy % on %.%', pol.policyname, pol.schemaname, pol.tablename;
  END LOOP;
END $$;

-- 1c. Remove 'volunteer' from app_role enum
-- PostgreSQL doesn't support DROP VALUE from enum directly
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('participant', 'mentor', 'judge', 'chapter_ambassador', 'admin');

-- Update all columns using the enum
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;

DROP TYPE public.app_role_old;

-- 1d. Add UNIQUE constraint on user_roles (enforce single role per user)
-- Clean any remaining duplicates first (keep oldest)
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.user_id = b.user_id
  AND a.id > b.id;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- 1e. Drop check_email_exists RPC function
DROP FUNCTION IF EXISTS public.check_email_exists(text);

-- 1f. Drop tg_email columns and related objects
ALTER TABLE public.profiles DROP COLUMN IF EXISTS tg_email;
ALTER TABLE public.event_registrations DROP COLUMN IF EXISTS tg_email;
DROP INDEX IF EXISTS idx_event_registrations_tg_email;

-- Clean tg_email from event ticket type required_fields arrays
UPDATE public.event_ticket_types
SET required_fields = array_remove(required_fields, 'tg_email')
WHERE required_fields @> ARRAY['tg_email'];
