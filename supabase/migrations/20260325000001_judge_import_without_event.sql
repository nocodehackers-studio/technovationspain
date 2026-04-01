-- ============================================================
-- Decouple Judge Import from Event Assignment
-- Allow judges to be imported and onboarded without an event
-- ============================================================

-- 1. Make event_id nullable on judge_assignments
ALTER TABLE public.judge_assignments ALTER COLUMN event_id DROP NOT NULL;

-- 2. Update schedule_preference CHECK to include 'online_only'
ALTER TABLE public.judge_assignments DROP CONSTRAINT IF EXISTS judge_assignments_schedule_preference_check;
ALTER TABLE public.judge_assignments ADD CONSTRAINT judge_assignments_schedule_preference_check
  CHECK (schedule_preference IN ('morning', 'afternoon', 'no_preference', 'online_only'));

-- 3. Partial unique index: one null-event row per user
CREATE UNIQUE INDEX idx_judge_assignments_user_no_event
  ON public.judge_assignments(user_id) WHERE event_id IS NULL;

-- 4. RLS INSERT policy: judges can insert their own null-event onboarding row
CREATE POLICY "Judges can insert own null-event onboarding row"
  ON public.judge_assignments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND event_id IS NULL
    AND is_active = false
  );

-- 5. Update trigger to also prevent judges from setting event_id on NULL rows
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

-- 6. Add deprecation comment on conflict_team_ids column
COMMENT ON COLUMN public.judge_assignments.conflict_team_ids IS
  'DEPRECATED: New onboarding flow uses conflict_other_text only. Column retained for legacy data.';
