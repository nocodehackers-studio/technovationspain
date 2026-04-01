-- ============================================================
-- Migration: Remove 'judge' from app_role enum + add for_judges to event_ticket_types
-- Spec: tech-spec-remove-judge-role
--
-- PRE-REQUISITE: Migration 20260319000002 already migrated judge users to
-- collaborator + is_judge flag. This migration removes the now-unused enum value.
--
-- NOTE: Removing a value from a PG enum requires the rename-create-swap-drop
-- pattern. Renaming the type causes ALL functions and policies that reference
-- it to bind to the OLD type name (by OID). We must drop and recreate every
-- dependent object before we can drop the old type.
-- ============================================================

-- ============================================================
-- 1a. Safety: Remove any remaining judge entries from user_roles
-- (should be 0 rows since 20260319000002 already migrated them)
-- ============================================================
DELETE FROM public.user_roles WHERE role = 'judge'::app_role;

-- ============================================================
-- 1b. Clean existing 'judge' from allowed_roles TEXT[] arrays in event_ticket_types
-- ============================================================
UPDATE public.event_ticket_types
SET allowed_roles = array_remove(allowed_roles, 'judge')
WHERE allowed_roles @> ARRAY['judge'];

-- ============================================================
-- 1c. Add for_judges column to event_ticket_types
-- ============================================================
ALTER TABLE public.event_ticket_types ADD COLUMN IF NOT EXISTS for_judges BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 1d. Clean authorized_users stale data (must run BEFORE CHECK constraint update)
-- NOTE: authorized_users may not exist on staging branches
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'authorized_users') THEN
    UPDATE public.authorized_users SET profile_type = 'mentor' WHERE profile_type = 'judge';
  END IF;
END $$;

-- ============================================================
-- 1e. Drop ALL RLS policies that depend on has_role() / app_role
-- The enum rename will cause these to bind to app_role_old.
-- We must drop them BEFORE the rename so we can recreate them
-- with the new type after.
-- ============================================================

-- user_roles
DROP POLICY IF EXISTS "Users can insert own allowed role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- hubs
DROP POLICY IF EXISTS "Verified users can view hubs" ON public.hubs;
DROP POLICY IF EXISTS "Admins can manage hubs" ON public.hubs;

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- teams
DROP POLICY IF EXISTS "Team members can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;

-- team_members
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage team members" ON public.team_members;

-- events
DROP POLICY IF EXISTS "Verified users can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;

-- workshops
DROP POLICY IF EXISTS "Verified users can view workshops" ON public.workshops;
DROP POLICY IF EXISTS "Admins can manage workshops" ON public.workshops;

-- event_registrations
DROP POLICY IF EXISTS "Users can view own registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Users can update own registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Volunteers can update registrations for check-in" ON public.event_registrations;
DROP POLICY IF EXISTS "Admins can insert registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Admins can delete registrations" ON public.event_registrations;

-- companions
DROP POLICY IF EXISTS "Users can view companions of own registrations" ON public.companions;
DROP POLICY IF EXISTS "Admins can manage all companions" ON public.companions;

-- workshop_registrations
DROP POLICY IF EXISTS "Team members can view workshop registrations" ON public.workshop_registrations;
DROP POLICY IF EXISTS "Admins can manage workshop registrations" ON public.workshop_registrations;

-- csv_imports
DROP POLICY IF EXISTS "Admins can manage imports" ON public.csv_imports;

-- audit_logs
DROP POLICY IF EXISTS "Admins can view logs" ON public.audit_logs;

-- event_ticket_types
DROP POLICY IF EXISTS "Anyone can view ticket types for published events" ON public.event_ticket_types;
DROP POLICY IF EXISTS "Admins can manage ticket types" ON public.event_ticket_types;

-- event_agenda
DROP POLICY IF EXISTS "Anyone can view agenda for published events" ON public.event_agenda;
DROP POLICY IF EXISTS "Admins can manage agenda" ON public.event_agenda;

-- table_custom_columns
DROP POLICY IF EXISTS "Admins can manage custom columns" ON public.table_custom_columns;

-- event_email_templates
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.event_email_templates;

-- event_email_sends
DROP POLICY IF EXISTS "Admins can manage email sends" ON public.event_email_sends;

-- event_volunteers
DROP POLICY IF EXISTS "Volunteers can view own signups" ON public.event_volunteers;
DROP POLICY IF EXISTS "Volunteers can sign up" ON public.event_volunteers;
DROP POLICY IF EXISTS "Admins manage volunteer signups" ON public.event_volunteers;

-- development_tickets
DROP POLICY IF EXISTS "Admins can manage development tickets" ON public.development_tickets;

-- workshop_time_slots
DROP POLICY IF EXISTS "Admins can manage time slots" ON public.workshop_time_slots;
DROP POLICY IF EXISTS "Verified users can view time slots" ON public.workshop_time_slots;

-- workshop_preferences
DROP POLICY IF EXISTS "Mentors can view team preferences" ON public.workshop_preferences;
DROP POLICY IF EXISTS "Admins can manage all preferences" ON public.workshop_preferences;

-- workshop_assignments
DROP POLICY IF EXISTS "Admins can manage assignments" ON public.workshop_assignments;
DROP POLICY IF EXISTS "Team members can view assignments" ON public.workshop_assignments;

-- event_ticket_consents
DROP POLICY IF EXISTS "Admins can manage consents" ON public.event_ticket_consents;
DROP POLICY IF EXISTS "Users can view own consents" ON public.event_ticket_consents;

-- parental_consents
DROP POLICY IF EXISTS "Users can view own consents" ON public.parental_consents;

-- platform_settings
DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can insert platform settings" ON public.platform_settings;

-- storage.objects (Assets bucket)
DROP POLICY IF EXISTS "Admins can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete event images" ON storage.objects;

-- storage.objects (csv-imports bucket)
DROP POLICY IF EXISTS "Admins can upload CSV imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read CSV imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update CSV imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete CSV imports" ON storage.objects;

-- judge_assignments (from 20260319000002)
DROP POLICY IF EXISTS "Judges can view own assignments" ON public.judge_assignments;
DROP POLICY IF EXISTS "Judges can update own assignments" ON public.judge_assignments;
DROP POLICY IF EXISTS "Admins can manage all judge assignments" ON public.judge_assignments;

-- ============================================================
-- 1f. Drop functions that reference app_role type
-- ============================================================
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- ============================================================
-- 1g. Drop trigger function that references has_role (which uses app_role)
-- ============================================================
DROP TRIGGER IF EXISTS restrict_judge_assignment_update ON public.judge_assignments;
DROP FUNCTION IF EXISTS public.restrict_judge_assignment_self_update();

-- ============================================================
-- 1h. Enum swap: remove 'judge' from app_role
-- Now safe — no dependent objects remain
-- ============================================================
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('participant', 'mentor', 'chapter_ambassador', 'admin', 'collaborator');

ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;

DROP TYPE public.app_role_old;

-- ============================================================
-- 1i. Recreate functions with new app_role type
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- ============================================================
-- 1j. Recreate trigger function restrict_judge_assignment_self_update
-- ============================================================
CREATE OR REPLACE FUNCTION public.restrict_judge_assignment_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admins can update anything (bypass restriction)
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admins (judges) can only update onboarding-related fields
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Cannot modify is_active';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id';
  END IF;
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    RAISE EXCEPTION 'Cannot modify event_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER restrict_judge_assignment_update
  BEFORE UPDATE ON public.judge_assignments
  FOR EACH ROW EXECUTE FUNCTION public.restrict_judge_assignment_self_update();

-- ============================================================
-- 1k. Recreate ALL RLS policies
-- ============================================================

-- ---- user_roles ----
-- CHANGED: removed 'judge'::app_role from allowed list
CREATE POLICY "Users can insert own allowed role" ON public.user_roles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND role IN ('participant'::app_role, 'mentor'::app_role, 'collaborator'::app_role)
    AND (
      NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- hubs ----
CREATE POLICY "Verified users can view hubs" ON public.hubs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage hubs" ON public.hubs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- profiles ----
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- teams ----
CREATE POLICY "Team members can view their teams" ON public.teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage teams" ON public.teams
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- team_members ----
CREATE POLICY "Users can view team members of their teams" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT get_user_team_ids(auth.uid()))
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage team members" ON public.team_members
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- events ----
CREATE POLICY "Verified users can view events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- workshops ----
CREATE POLICY "Verified users can view workshops" ON public.workshops
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage workshops" ON public.workshops
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- event_registrations ----
CREATE POLICY "Users can view own registrations" ON public.event_registrations
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own registrations" ON public.event_registrations
  FOR UPDATE USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Volunteers can update registrations for check-in" ON public.event_registrations
  FOR UPDATE USING ((SELECT is_volunteer FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert registrations" ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete registrations" ON public.event_registrations
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- companions ----
CREATE POLICY "Users can view companions of own registrations" ON public.companions
  FOR SELECT USING (
    event_registration_id IN (
      SELECT id FROM event_registrations WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage all companions" ON public.companions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- workshop_registrations ----
CREATE POLICY "Team members can view workshop registrations" ON public.workshop_registrations
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR (SELECT is_volunteer FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage workshop registrations" ON public.workshop_registrations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- csv_imports ----
CREATE POLICY "Admins can manage imports" ON public.csv_imports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ---- audit_logs ----
CREATE POLICY "Admins can view logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ---- event_ticket_types ----
CREATE POLICY "Anyone can view ticket types for published events" ON public.event_ticket_types
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_ticket_types.event_id
      AND events.status = 'published'
    )
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage ticket types" ON public.event_ticket_types
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ---- event_agenda ----
CREATE POLICY "Anyone can view agenda for published events" ON public.event_agenda
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_agenda.event_id
      AND events.status = 'published'
    )
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage agenda" ON public.event_agenda
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ---- table_custom_columns ----
CREATE POLICY "Admins can manage custom columns" ON public.table_custom_columns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- event_email_templates ----
CREATE POLICY "Admins can manage email templates" ON public.event_email_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- event_email_sends ----
CREATE POLICY "Admins can manage email sends" ON public.event_email_sends
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- event_volunteers ----
CREATE POLICY "Volunteers can view own signups" ON public.event_volunteers
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Volunteers can sign up" ON public.event_volunteers
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (SELECT is_volunteer FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins manage volunteer signups" ON public.event_volunteers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- development_tickets ----
CREATE POLICY "Admins can manage development tickets" ON public.development_tickets
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ---- workshop_time_slots ----
CREATE POLICY "Admins can manage time slots" ON public.workshop_time_slots
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Verified users can view time slots" ON public.workshop_time_slots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ---- workshop_preferences ----
CREATE POLICY "Mentors can view team preferences" ON public.workshop_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = workshop_preferences.team_id
      AND user_id = auth.uid()
      AND member_type = 'mentor'
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can manage all preferences" ON public.workshop_preferences
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- workshop_assignments ----
CREATE POLICY "Admins can manage assignments" ON public.workshop_assignments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team members can view assignments" ON public.workshop_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = workshop_assignments.team_id
      AND user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ---- event_ticket_consents ----
CREATE POLICY "Admins can manage consents" ON public.event_ticket_consents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own consents" ON public.event_ticket_consents
  FOR SELECT USING (
    event_registration_id IN (
      SELECT id FROM public.event_registrations
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ---- parental_consents ----
CREATE POLICY "Users can view own consents" ON public.parental_consents
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ---- platform_settings ----
CREATE POLICY "Admins can update platform settings" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert platform settings" ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---- storage.objects (Assets bucket) ----
CREATE POLICY "Admins can upload event images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update event images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'Assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete event images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'Assets' AND has_role(auth.uid(), 'admin'::app_role));

-- ---- storage.objects (csv-imports bucket) ----
CREATE POLICY "Admins can upload CSV imports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'csv-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read CSV imports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'csv-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update CSV imports" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'csv-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete CSV imports" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'csv-imports' AND public.has_role(auth.uid(), 'admin'));

-- ---- judge_assignments (from 20260319000002) ----
CREATE POLICY "Judges can view own assignments"
  ON public.judge_assignments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Judges can update own assignments"
  ON public.judge_assignments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all judge assignments"
  ON public.judge_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- 1l. Update authorized_users CHECK constraint
-- NOTE: authorized_users may not exist on staging branches
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'authorized_users') THEN
    ALTER TABLE public.authorized_users DROP CONSTRAINT IF EXISTS authorized_users_profile_type_check;
    ALTER TABLE public.authorized_users ADD CONSTRAINT authorized_users_profile_type_check
      CHECK (profile_type IN ('student', 'mentor', 'chapter_ambassador'));
  END IF;
END $$;
