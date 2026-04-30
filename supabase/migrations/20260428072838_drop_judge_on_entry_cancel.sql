-- Drop judge from event when their registration is cancelled.
--
-- Adds public.drop_judge_on_entry_cancel(uuid): when a judge cancels their
-- event registration, deactivate their judge_assignment for that event and
-- retire them from any judging_panel_judges rows in that event's panels.
--
-- Also redefines restrict_judge_assignment_self_update to combine:
--   * existing auto-activation (judge becomes active when onboarding completes
--     with an event selected)
--   * a session-scoped bypass switch (app.bypass_judge_assignment_restriction)
--     used by drop_judge_on_entry_cancel to update is_active without admin role.

CREATE OR REPLACE FUNCTION public.restrict_judge_assignment_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _auto_activated boolean := false;
BEGIN
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_judge_assignment_restriction', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.onboarding_completed = true
     AND OLD.onboarding_completed IS DISTINCT FROM true
     AND NEW.event_id IS NOT NULL
     AND OLD.is_active = false
  THEN
    NEW.is_active := true;
    _auto_activated := true;
  END IF;

  IF NEW.event_id IS NOT NULL
     AND OLD.event_id IS NULL
     AND NEW.onboarding_completed = true
     AND OLD.is_active = false
  THEN
    NEW.is_active := true;
    _auto_activated := true;
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT _auto_activated THEN
    RAISE EXCEPTION 'Cannot modify is_active';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id';
  END IF;

  IF NEW.event_id IS DISTINCT FROM OLD.event_id AND OLD.event_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify event_id';
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.drop_judge_on_entry_cancel(p_registration_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_event_id   uuid;
  v_status     text;
  v_caller     uuid := auth.uid();
  v_is_judge   boolean;
  v_is_admin   boolean;
  v_now        timestamptz := now();
  v_reason     text := 'Baja automática por cancelación de entrada';
BEGIN
  SELECT user_id, event_id, registration_status
    INTO v_user_id, v_event_id, v_status
  FROM public.event_registrations
  WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  IF v_status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'Registration is not cancelled';
  END IF;

  SELECT is_judge INTO v_is_judge
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT COALESCE(v_is_judge, false) THEN
    RAISE EXCEPTION 'Registration owner is not a judge';
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::public.app_role);

  IF v_caller IS DISTINCT FROM v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM set_config('app.bypass_judge_assignment_restriction', 'on', true);

  UPDATE public.judge_assignments
     SET is_active = false
   WHERE user_id  = v_user_id
     AND event_id = v_event_id;

  UPDATE public.judging_panel_judges
     SET is_active             = false,
         deactivated_at        = v_now,
         deactivated_reason    = v_reason,
         manual_change_comment = v_reason,
         manual_change_by      = v_caller,
         manual_change_at      = v_now
   WHERE judge_id = v_user_id
     AND panel_id IN (
       SELECT id FROM public.judging_panels WHERE event_id = v_event_id
     );
END;
$$;

GRANT EXECUTE ON FUNCTION public.drop_judge_on_entry_cancel(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
