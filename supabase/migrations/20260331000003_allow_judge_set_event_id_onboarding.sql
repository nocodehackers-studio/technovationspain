-- Allow judges to set event_id during onboarding (null → value transition only)
CREATE OR REPLACE FUNCTION restrict_judge_assignment_self_update()
RETURNS TRIGGER AS $$
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
  -- Allow setting event_id during onboarding (null → value), block reassignment
  IF NEW.event_id IS DISTINCT FROM OLD.event_id AND OLD.event_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify event_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
