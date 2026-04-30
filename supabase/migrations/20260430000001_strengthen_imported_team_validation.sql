-- ============================================================================
-- Migration: Strengthen imported-team validation (hardening of 20260429000001)
-- Description:
--   Adversarial review fixes:
--     F1: cubrir UPDATE además de INSERT — sin esto, un INSERT con ticket
--         "benigno" seguido de UPDATE a ticket flagged saltaría la regla.
--         Trigger BEFORE UPDATE OF (ticket_type_id, team_id, event_id).
--     F10: usar EXISTS en lugar de count(*) — short-circuit y semántica clara.
--     F14: short-circuit explícito si NEW.is_companion = true. Hoy no se
--          insertan filas con is_companion=true en event_registrations
--          (los acompañantes viven en public.companions), pero el guard evita
--          regresiones silenciosas si el flujo cambia.
--     F7:  envolver en BEGIN/COMMIT para evitar ventana entre DROP/CREATE.
--     F8:  comentar la dependencia con RLS de event_teams (SECURITY INVOKER).
--          La política existente "Authenticated users can view event_teams"
--          permite SELECT a cualquier auth.uid()<>NULL → cubre el flujo real.
--          Si en el futuro se inserta desde un contexto sin auth (anon), la
--          función debería migrarse a SECURITY DEFINER.
--
-- Magic string 'regional_final' coincide con el CHECK en
-- 20260213000001_enums_and_tables.sql:112 (events.event_type IN
-- ('intermediate','regional_final')). Si se cambia ese enum, actualizar aquí
-- y en src/hooks/useEventRegistration.ts y src/pages/events/EventRegistrationPage.tsx.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_imported_team_on_registration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_requires_imported boolean;
  v_event_type text;
BEGIN
  -- Companion rows live in public.companions, no en event_registrations. Si
  -- alguna vez se inserta una fila con is_companion=true aquí, NO debe
  -- bloquearse: la regla es para el inscrito principal.
  IF NEW.is_companion IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT requires_imported_team
    INTO v_requires_imported
    FROM public.event_ticket_types
   WHERE id = NEW.ticket_type_id;

  IF v_requires_imported IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT event_type
    INTO v_event_type
    FROM public.events
   WHERE id = NEW.event_id;

  IF v_event_type IS DISTINCT FROM 'regional_final' THEN
    RETURN NEW;
  END IF;

  IF NEW.team_id IS NULL THEN
    RAISE EXCEPTION 'Tu equipo no está inscrito en este evento. Contacta con tu Chapter Ambassador.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.event_teams
     WHERE event_id = NEW.event_id
       AND team_id  = NEW.team_id
       AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Tu equipo no está inscrito en este evento. Contacta con tu Chapter Ambassador.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_imported_team_on_registration ON public.event_registrations;
DROP TRIGGER IF EXISTS enforce_imported_team_on_registration_update ON public.event_registrations;

CREATE TRIGGER enforce_imported_team_on_registration
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_imported_team_on_registration();

-- F1: cubrir cambios post-insert que pudieran reintroducir la violación.
CREATE TRIGGER enforce_imported_team_on_registration_update
  BEFORE UPDATE OF ticket_type_id, team_id, event_id ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_imported_team_on_registration();

COMMIT;

NOTIFY pgrst, 'reload schema';
