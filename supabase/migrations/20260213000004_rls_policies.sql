-- ============================================================
-- 004: RLS Policies (consolidated)
-- Enable RLS on all 27 tables + all ~67 final policies
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_table_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ticket_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- user_roles (3 policies)
-- ============================================================

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- FINAL from 20260128170307 — includes volunteer role
CREATE POLICY "Users can insert own allowed role" ON public.user_roles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND role IN ('participant'::app_role, 'mentor'::app_role, 'judge'::app_role, 'volunteer'::app_role)
    AND (
      NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND verification_status = 'verified'::verification_status
      )
    )
  );

-- ============================================================
-- hubs (2 policies)
-- ============================================================

CREATE POLICY "Verified users can view hubs" ON public.hubs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage hubs" ON public.hubs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- profiles (5 policies)
-- ============================================================

-- FINAL from 20260120103749 — includes auth.uid() IS NOT NULL check
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- From 20260204195802
CREATE POLICY "Mentors can view team participants profiles" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT tm_participant.user_id
      FROM team_members tm_participant
      WHERE tm_participant.member_type = 'participant'
      AND tm_participant.team_id IN (
        SELECT tm_mentor.team_id
        FROM team_members tm_mentor
        WHERE tm_mentor.user_id = auth.uid()
        AND tm_mentor.member_type = 'mentor'
      )
    )
  );

-- ============================================================
-- teams (2 policies)
-- ============================================================

-- FINAL from 20260128171413 — removed volunteer access
CREATE POLICY "Team members can view their teams" ON public.teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage teams" ON public.teams
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- team_members (2 policies)
-- ============================================================

-- FINAL from 20260128171413 — uses get_user_team_ids, removed volunteer access
CREATE POLICY "Users can view team members of their teams" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT get_user_team_ids(auth.uid()))
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage team members" ON public.team_members
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- events (3 policies)
-- ============================================================

CREATE POLICY "Verified users can view events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- From 20260116094631
CREATE POLICY "Anyone can view published events" ON public.events
  FOR SELECT USING (status = 'published');

-- ============================================================
-- workshops (2 policies)
-- ============================================================

CREATE POLICY "Verified users can view workshops" ON public.workshops
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage workshops" ON public.workshops
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- event_registrations (6 policies)
-- ============================================================

-- FINAL from 20260128171413 — removed volunteer access
CREATE POLICY "Users can view own registrations" ON public.event_registrations
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Verified users can register" ON public.event_registrations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
  );

CREATE POLICY "Users can update own registrations" ON public.event_registrations
  FOR UPDATE USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- From 20260204193008
CREATE POLICY "Mentors can view team participant registrations" ON public.event_registrations
  FOR SELECT USING (
    user_id IN (
      SELECT tm_participant.user_id
      FROM team_members tm_participant
      WHERE tm_participant.member_type = 'participant'
      AND tm_participant.team_id IN (
        SELECT tm_mentor.team_id
        FROM team_members tm_mentor
        WHERE tm_mentor.user_id = auth.uid()
        AND tm_mentor.member_type = 'mentor'
      )
    )
  );

-- From 20260204173056
CREATE POLICY "Admins can insert registrations" ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete registrations" ON public.event_registrations
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Volunteers can update registrations for check-in" ON public.event_registrations
  FOR UPDATE USING (public.has_role(auth.uid(), 'volunteer'::app_role));

-- ============================================================
-- companions (3 policies)
-- ============================================================

-- FINAL from 20260128171413 — removed volunteer access
CREATE POLICY "Users can view companions of own registrations" ON public.companions
  FOR SELECT USING (
    event_registration_id IN (
      SELECT id FROM event_registrations WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can manage companions of own registrations" ON public.companions
  FOR ALL USING (
    event_registration_id IN (SELECT id FROM public.event_registrations WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all companions" ON public.companions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- workshop_registrations (3 policies)
-- ============================================================

CREATE POLICY "Team members can view workshop registrations" ON public.workshop_registrations
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'volunteer')
  );

CREATE POLICY "Mentors can register their teams for workshops" ON public.workshop_registrations
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND member_type = 'mentor'
    )
  );

CREATE POLICY "Admins can manage workshop registrations" ON public.workshop_registrations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- csv_imports (1 policy)
-- ============================================================

CREATE POLICY "Admins can manage imports" ON public.csv_imports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- audit_logs (2 policies)
-- ============================================================

CREATE POLICY "Admins can view logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- FINAL from 20260116083119
CREATE POLICY "Authenticated users can insert own logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL));

-- ============================================================
-- event_ticket_types (2 policies)
-- ============================================================

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

-- ============================================================
-- event_agenda (2 policies)
-- ============================================================

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

-- ============================================================
-- authorized_students (2 policies)
-- ============================================================

CREATE POLICY "Admins can manage authorized students" ON public.authorized_students
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- From 20260128172237
CREATE POLICY "Users can check own authorization via safe view" ON public.authorized_students
  FOR SELECT USING (
    has_role(auth.uid(), 'admin')
    OR lower(email) = lower((SELECT email FROM profiles WHERE id = auth.uid()))
  );

-- ============================================================
-- authorized_users (2 policies)
-- ============================================================

CREATE POLICY "Admins can manage authorized users" ON public.authorized_users
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- From 20260128172237
CREATE POLICY "Users can check own authorization via safe view" ON public.authorized_users
  FOR SELECT USING (
    has_role(auth.uid(), 'admin')
    OR lower(email) = lower((SELECT email FROM profiles WHERE id = auth.uid()))
  );

-- ============================================================
-- table_custom_columns (1 policy)
-- ============================================================

CREATE POLICY "Admins can manage custom columns" ON public.table_custom_columns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- admin_table_preferences (1 policy)
-- ============================================================

CREATE POLICY "Users can manage own table preferences" ON public.admin_table_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- event_email_templates (1 policy)
-- ============================================================

CREATE POLICY "Admins can manage email templates" ON public.event_email_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- event_email_sends (1 policy)
-- ============================================================

CREATE POLICY "Admins can manage email sends" ON public.event_email_sends
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- event_volunteers (4 policies)
-- ============================================================

CREATE POLICY "Volunteers can view own signups" ON public.event_volunteers
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Volunteers can sign up" ON public.event_volunteers
  FOR INSERT WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'volunteer'::app_role));

CREATE POLICY "Volunteers can cancel own signup" ON public.event_volunteers
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins manage volunteer signups" ON public.event_volunteers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- development_tickets (1 policy)
-- ============================================================

CREATE POLICY "Admins can manage development tickets" ON public.development_tickets
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- workshop_time_slots (2 policies)
-- ============================================================

CREATE POLICY "Admins can manage time slots" ON public.workshop_time_slots
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Verified users can view time slots" ON public.workshop_time_slots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- workshop_preferences (3 policies)
-- ============================================================

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

CREATE POLICY "Mentors can insert preferences" ON public.workshop_preferences
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = workshop_preferences.team_id
      AND user_id = auth.uid()
      AND member_type = 'mentor'
    )
  );

CREATE POLICY "Admins can manage all preferences" ON public.workshop_preferences
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- workshop_assignments (2 policies)
-- ============================================================

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

-- ============================================================
-- event_ticket_consents (3 policies)
-- ============================================================

CREATE POLICY "Admins can manage consents"
  ON public.event_ticket_consents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert consent for own registrations"
  ON public.event_ticket_consents FOR INSERT
  WITH CHECK (
    event_registration_id IN (
      SELECT id FROM public.event_registrations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own consents"
  ON public.event_ticket_consents FOR SELECT
  USING (
    event_registration_id IN (
      SELECT id FROM public.event_registrations
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- parental_consents (3 policies)
-- ============================================================

CREATE POLICY "Public can update consents by token" ON public.parental_consents
  FOR UPDATE USING (consent_token IS NOT NULL);

CREATE POLICY "Users can insert own consents" ON public.parental_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own consents" ON public.parental_consents
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- platform_settings (4 policies)
-- ============================================================

CREATE POLICY "Anyone can read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anonymous can read platform settings" ON public.platform_settings
  FOR SELECT TO anon USING (true);

CREATE POLICY "Admins can update platform settings" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert platform settings" ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
