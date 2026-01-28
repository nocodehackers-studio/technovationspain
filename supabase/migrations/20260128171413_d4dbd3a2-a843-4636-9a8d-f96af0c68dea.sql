-- =============================================
-- SECURITY FIX: Restringir acceso de voluntarios a datos sensibles
-- =============================================

-- 1. Eliminar políticas que dan acceso a voluntarios a event_registrations
DROP POLICY IF EXISTS "Users can view own registrations" ON public.event_registrations;

-- Nueva política: solo propietarios o admins (NO voluntarios)
CREATE POLICY "Users can view own registrations"
ON public.event_registrations FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 2. Eliminar acceso de voluntarios a companions
DROP POLICY IF EXISTS "Users can view companions of own registrations" ON public.companions;

-- Nueva política: solo propietarios de la inscripción o admins
CREATE POLICY "Users can view companions of own registrations"
ON public.companions FOR SELECT
USING (
  event_registration_id IN (
    SELECT id FROM event_registrations WHERE user_id = auth.uid()
  ) 
  OR has_role(auth.uid(), 'admin')
);

-- 3. Eliminar acceso de voluntarios a team_members
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;

CREATE POLICY "Users can view team members of their teams"
ON public.team_members FOR SELECT
USING (
  team_id IN (SELECT get_user_team_ids(auth.uid()))
  OR has_role(auth.uid(), 'admin')
);

-- 4. Eliminar acceso de voluntarios a teams
DROP POLICY IF EXISTS "Team members can view their teams" ON public.teams;

CREATE POLICY "Team members can view their teams"
ON public.teams FOR SELECT
USING (
  id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
);