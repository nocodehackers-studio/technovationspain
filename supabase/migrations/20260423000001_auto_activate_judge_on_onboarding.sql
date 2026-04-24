-- Auto-activate judge assignment when onboarding completes with an event selected.
--
-- We update the existing restriction trigger to handle auto-activation inline.
-- This avoids trigger-ordering issues where a separate auto-activate trigger
-- would conflict with the restriction trigger blocking is_active changes.

CREATE OR REPLACE FUNCTION public.restrict_judge_assignment_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _auto_activated boolean := false;
BEGIN
  -- Admins can update anything (bypass restriction)
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Auto-activate: when onboarding completes with an event, set is_active = true.
  -- This runs before the restriction check so the judge doesn't need permission.
  IF NEW.onboarding_completed = true
     AND OLD.onboarding_completed IS DISTINCT FROM true
     AND NEW.event_id IS NOT NULL
     AND OLD.is_active = false
  THEN
    NEW.is_active := true;
    _auto_activated := true;
  END IF;

  -- Auto-activate: event_id set on an already-onboarded row
  IF NEW.event_id IS NOT NULL
     AND OLD.event_id IS NULL
     AND NEW.onboarding_completed = true
     AND OLD.is_active = false
  THEN
    NEW.is_active := true;
    _auto_activated := true;
  END IF;

  -- Block manual is_active changes (only auto-activation allowed)
  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT _auto_activated THEN
    RAISE EXCEPTION 'Cannot modify is_active';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id';
  END IF;

  -- Allow setting event_id during onboarding (null → value), block reassignment
  IF NEW.event_id IS DISTINCT FROM OLD.event_id AND OLD.event_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify event_id';
  END IF;

  RETURN NEW;
END;
$$;
