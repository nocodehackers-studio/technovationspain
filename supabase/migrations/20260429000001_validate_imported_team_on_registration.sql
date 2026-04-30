-- ============================================================================
-- Migration: Validate imported team on event registration (regional_final)
-- Description:
--   BEFORE INSERT trigger sobre public.event_registrations que aplica la
--   regla de invariante de negocio:
--     "Para tickets con requires_imported_team=true en eventos cuyo
--      event_type='regional_final', el team_id de la inscripción debe estar
--      activo en public.event_teams para ese evento."
--
--   La regla se aplica SIEMPRE (sin bypass por rol/admin/service_role): si
--   se necesita inscribir un team que no esté importado, primero debe
--   añadirse a event_teams.
--
--   Mensaje en español, idéntico al que se muestra en UI y mutation:
--     "Tu equipo no está inscrito en este evento. Contacta con tu
--      Chapter Ambassador."
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_imported_team_on_registration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_requires_imported boolean;
  v_event_type text;
  v_match_count integer;
BEGIN
  -- 1. Cargar el flag del ticket; si NULL/false, la regla no aplica.
  SELECT requires_imported_team
    INTO v_requires_imported
    FROM public.event_ticket_types
   WHERE id = NEW.ticket_type_id;

  IF v_requires_imported IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- 2. Cargar el event_type; si no es regional_final, la regla no aplica.
  SELECT event_type
    INTO v_event_type
    FROM public.events
   WHERE id = NEW.event_id;

  IF v_event_type IS DISTINCT FROM 'regional_final' THEN
    RETURN NEW;
  END IF;

  -- 3. La regla aplica: team_id NULL bloquea.
  IF NEW.team_id IS NULL THEN
    RAISE EXCEPTION 'Tu equipo no está inscrito en este evento. Contacta con tu Chapter Ambassador.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Verificar que el team esté activo en event_teams para este evento.
  SELECT count(*)
    INTO v_match_count
    FROM public.event_teams
   WHERE event_id = NEW.event_id
     AND team_id  = NEW.team_id
     AND is_active = true;

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'Tu equipo no está inscrito en este evento. Contacta con tu Chapter Ambassador.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_imported_team_on_registration ON public.event_registrations;

CREATE TRIGGER enforce_imported_team_on_registration
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_imported_team_on_registration();

NOTIFY pgrst, 'reload schema';
