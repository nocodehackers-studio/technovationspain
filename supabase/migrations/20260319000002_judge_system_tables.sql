-- ============================================================
-- Judge Role System (Part 2): tables, RLS, functions, data migration
-- ============================================================

-- 1. Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_judge BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS judge_how_discovered_program TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS judge_previous_participation TEXT;

-- 2. Create judge_assignments table
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

-- 3. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_judge_assignments_event_active ON judge_assignments(event_id, is_active);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_user_active ON judge_assignments(user_id, is_active);

-- 4. updated_at trigger (follows existing pattern)
CREATE TRIGGER update_judge_assignments_updated_at
  BEFORE UPDATE ON public.judge_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE judge_assignments ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for judge_assignments
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

-- 7. Update RLS policy to include 'collaborator' in allowed self-insert roles
DROP POLICY IF EXISTS "Users can insert own allowed role" ON public.user_roles;
CREATE POLICY "Users can insert own allowed role" ON public.user_roles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND role IN ('participant'::app_role, 'mentor'::app_role, 'judge'::app_role, 'collaborator'::app_role)
    AND (
      NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid())
    )
  );

-- 8. auto_verify_authorized_user_after: skipped — authorized_users table
-- does not exist on staging. The function will be created when that table
-- is deployed. The CASE mapping for 'judge' → 'collaborator' + is_judge
-- flag is documented in the tech spec for future implementation.

-- 9. Migrate existing role = 'judge' users to new pattern
UPDATE profiles SET is_judge = true
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'judge');

UPDATE user_roles SET role = 'collaborator' WHERE role = 'judge';
