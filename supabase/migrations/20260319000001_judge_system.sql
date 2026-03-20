-- ============================================================
-- Judge Role System: schema, RLS, function updates, data migration
-- ============================================================

-- 1. Add 'collaborator' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'collaborator';

-- 2. Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_judge BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS judge_how_discovered_program TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS judge_previous_participation TEXT;

-- 3. Create judge_assignments table
CREATE TABLE IF NOT EXISTS public.judge_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  schedule_preference TEXT CHECK (schedule_preference IN ('morning', 'afternoon', 'no_preference')),
  conflict_team_ids UUID[],
  conflict_other_text TEXT,
  comments TEXT CHECK (char_length(comments) <= 2000),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- 4. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_judge_assignments_event_active ON judge_assignments(event_id, is_active);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_user_active ON judge_assignments(user_id, is_active);

-- 5. updated_at trigger (follows existing moddatetime pattern)
CREATE TRIGGER update_judge_assignments_updated_at
  BEFORE UPDATE ON public.judge_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Enable RLS
ALTER TABLE judge_assignments ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for judge_assignments
CREATE POLICY "Judges can view own assignments"
  ON public.judge_assignments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Judges can update own assignments"
  ON public.judge_assignments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restrict judge self-update to onboarding fields only via a trigger
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
  -- Prevent modification of is_active and other structural fields
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

CREATE POLICY "Admins can manage all judge assignments"
  ON public.judge_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- 8. Update RLS policy to include 'collaborator' in allowed self-insert roles
DROP POLICY IF EXISTS "Users can insert own allowed role" ON public.user_roles;
CREATE POLICY "Users can insert own allowed role" ON public.user_roles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND role IN ('participant'::app_role, 'mentor'::app_role, 'judge'::app_role, 'volunteer'::app_role, 'collaborator'::app_role)
    AND (
      NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid())
    )
  );

-- 9. Update auto_verify_authorized_user_after to handle judge profile_type with new pattern
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
        WHEN 'judge' THEN role_to_assign := 'collaborator';
        ELSE role_to_assign := 'participant';
      END CASE;

      -- Assign the appropriate role
      INSERT INTO user_roles (user_id, role)
      VALUES (NEW.id, role_to_assign)
      ON CONFLICT (user_id, role) DO NOTHING;

      -- Set is_judge flag for judge profile_type
      IF authorized_record.profile_type = 'judge' THEN
        UPDATE profiles SET is_judge = true WHERE id = NEW.id;
      END IF;

      -- Auto-link to team if team_name is set
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

-- 10. Migrate existing role = 'judge' users to new pattern
UPDATE profiles SET is_judge = true
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'judge');

UPDATE user_roles SET role = 'collaborator' WHERE role = 'judge';
