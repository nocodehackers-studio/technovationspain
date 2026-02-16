-- ============================================================
-- 002: Functions (consolidated)
-- All 15 functions — final versions only
-- ============================================================

-- 1. has_role (from 20260116083105)
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

-- 2. get_user_role (from 20260116083105)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 3. handle_new_user (from 20260116083119 — with SET search_path = public)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- 4. update_updated_at_column (from 20260116083119 — with SET search_path = public)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. auto_verify_authorized_student_before (from 20260120084557)
-- Note: Dead code — triggers were dropped in 20260128100125, kept for production parity
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_student_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  authorized_record authorized_students%ROWTYPE;
BEGIN
  SELECT * INTO authorized_record
  FROM authorized_students
  WHERE lower(email) = lower(NEW.email)
  AND matched_profile_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    NEW.verification_status := 'verified';
    NEW.first_name := COALESCE(NEW.first_name, authorized_record.first_name);
    NEW.last_name := COALESCE(NEW.last_name, authorized_record.last_name);
    NEW.tg_id := authorized_record.tg_id;
    NEW.tg_email := authorized_record.email;
    NEW.phone := COALESCE(NEW.phone, authorized_record.phone);
  END IF;

  RETURN NEW;
END;
$$;

-- 6. auto_verify_authorized_student_after (from 20260120084557)
-- Note: Dead code — triggers were dropped in 20260128100125, kept for production parity
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_student_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.verification_status = 'verified' AND NEW.tg_id IS NOT NULL THEN
    UPDATE authorized_students
    SET matched_profile_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
    AND matched_profile_id IS NULL;

    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'participant')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. is_team_member (from 20260120095619)
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

-- 8. get_user_team_ids (from 20260120095619)
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = _user_id
$$;

-- 9a. increment_registration_count (simple 2-arg version)
CREATE OR REPLACE FUNCTION public.increment_registration_count(
  p_event_id UUID,
  p_ticket_type_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.event_ticket_types
  SET current_count = current_count + 1
  WHERE id = p_ticket_type_id;

  UPDATE public.events
  SET current_registrations = current_registrations + 1
  WHERE id = p_event_id;
END;
$$;

-- 9b. increment_registration_count (from 20260126122901 — with companions param)
CREATE OR REPLACE FUNCTION public.increment_registration_count(
  p_event_id UUID,
  p_ticket_type_id UUID,
  p_companions_count INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_increment INTEGER;
BEGIN
  v_total_increment := 1 + COALESCE(p_companions_count, 0);

  UPDATE public.event_ticket_types
  SET current_count = current_count + v_total_increment
  WHERE id = p_ticket_type_id;

  UPDATE public.events
  SET current_registrations = current_registrations + v_total_increment
  WHERE id = p_event_id;
END;
$$;

-- 10a. decrement_registration_count (simple 2-arg version)
CREATE OR REPLACE FUNCTION public.decrement_registration_count(
  p_event_id UUID,
  p_ticket_type_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.event_ticket_types
  SET current_count = GREATEST(0, current_count - 1)
  WHERE id = p_ticket_type_id;

  UPDATE public.events
  SET current_registrations = GREATEST(0, current_registrations - 1)
  WHERE id = p_event_id;
END;
$$;

-- 10b. decrement_registration_count (from 20260126122901 — with companions param)
CREATE OR REPLACE FUNCTION public.decrement_registration_count(
  p_event_id UUID,
  p_ticket_type_id UUID,
  p_companions_count INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_decrement INTEGER;
BEGIN
  v_total_decrement := 1 + COALESCE(p_companions_count, 0);

  UPDATE public.event_ticket_types
  SET current_count = GREATEST(0, current_count - v_total_decrement)
  WHERE id = p_ticket_type_id;

  UPDATE public.events
  SET current_registrations = GREATEST(0, current_registrations - v_total_decrement)
  WHERE id = p_event_id;
END;
$$;

-- 11. auto_verify_authorized_user_before (from 20260128100125)
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_user_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authorized_record authorized_users%ROWTYPE;
BEGIN
  SELECT * INTO authorized_record
  FROM authorized_users
  WHERE lower(email) = lower(NEW.email)
  AND matched_profile_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    NEW.verification_status := 'verified';
    NEW.first_name := COALESCE(NEW.first_name, authorized_record.first_name);
    NEW.last_name := COALESCE(NEW.last_name, authorized_record.last_name);
    NEW.tg_id := authorized_record.tg_id;
    NEW.tg_email := authorized_record.email;
    NEW.phone := COALESCE(NEW.phone, authorized_record.phone);
  END IF;

  RETURN NEW;
END;
$$;

-- 12. auto_verify_authorized_user_after (from 20260128100125 — single-team)
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_user_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  authorized_record authorized_users%ROWTYPE;
  role_to_assign app_role;
  found_team_id uuid;
  member_type_to_assign text;
BEGIN
  -- Only execute if profile was verified and has tg_id (indicates from whitelist)
  IF NEW.verification_status = 'verified' AND NEW.tg_id IS NOT NULL THEN
    -- Get the authorized user record to determine role
    SELECT * INTO authorized_record
    FROM authorized_users
    WHERE lower(email) = lower(NEW.email)
    AND matched_profile_id IS NULL
    LIMIT 1;

    IF FOUND THEN
      -- Mark the authorized_users record as matched
      UPDATE authorized_users
      SET matched_profile_id = NEW.id
      WHERE id = authorized_record.id;

      -- Determine role based on profile_type
      CASE authorized_record.profile_type
        WHEN 'student' THEN role_to_assign := 'participant';
        WHEN 'mentor' THEN role_to_assign := 'mentor';
        WHEN 'chapter_ambassador' THEN role_to_assign := 'mentor';
        WHEN 'judge' THEN role_to_assign := 'judge';
        ELSE role_to_assign := 'participant';
      END CASE;

      -- Assign the appropriate role
      INSERT INTO user_roles (user_id, role)
      VALUES (NEW.id, role_to_assign)
      ON CONFLICT (user_id, role) DO NOTHING;

      -- NEW: Auto-link to team if team_name is set
      IF authorized_record.team_name IS NOT NULL AND authorized_record.team_name <> '' THEN
        -- Find the team by name (case-insensitive)
        SELECT id INTO found_team_id
        FROM teams
        WHERE lower(name) = lower(authorized_record.team_name)
        LIMIT 1;

        IF found_team_id IS NOT NULL THEN
          -- Determine member_type based on profile_type
          IF authorized_record.profile_type = 'student' THEN
            member_type_to_assign := 'participant';
          ELSE
            member_type_to_assign := 'mentor';
          END IF;

          -- Insert into team_members (ignore if already exists)
          INSERT INTO team_members (team_id, user_id, member_type)
          VALUES (found_team_id, NEW.id, member_type_to_assign)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 13. can_access_authorized_student (from 20260128172237)
-- Note: Dead code — not referenced in any policy, kept for production parity
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

-- 14. can_access_authorized_user (from 20260128172237)
-- Note: Dead code — not referenced in any policy, kept for production parity
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

-- 15. check_email_exists (from 20260204202159)
CREATE OR REPLACE FUNCTION public.check_email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE lower(email) = lower(check_email)
  )
$$;
