-- ============================================================================
-- Migration: Judging Panels Base Tables
-- Description: Creates the core judging panel tables, trigger functions,
--              indexes, RLS policies. Uses IF NOT EXISTS / CREATE OR REPLACE
--              so it is safe to run on environments where tables were already
--              created via direct SQL.
-- ============================================================================

-- ===========================================
-- 1. judging_event_config
-- ===========================================
CREATE TABLE IF NOT EXISTS public.judging_event_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  total_rooms INT NOT NULL DEFAULT 5,
  teams_per_group INT NOT NULL DEFAULT 6,
  judges_per_group INT NOT NULL DEFAULT 6,
  sessions_per_turn INT NOT NULL DEFAULT 2,
  algorithm_run_at TIMESTAMPTZ,
  algorithm_run_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT judging_event_config_event_id_key UNIQUE (event_id)
);

-- ===========================================
-- 2. judging_panels
-- ===========================================
CREATE TABLE IF NOT EXISTS public.judging_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  panel_code VARCHAR NOT NULL,
  session_number INT NOT NULL,
  room_number INT NOT NULL,
  turn VARCHAR NOT NULL CHECK (turn IN ('morning', 'afternoon')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT judging_panels_event_id_session_number_room_number_key
    UNIQUE (event_id, session_number, room_number)
);

-- ===========================================
-- 3. judging_panel_judges
-- ===========================================
CREATE TABLE IF NOT EXISTS public.judging_panel_judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID NOT NULL REFERENCES public.judging_panels(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assignment_type VARCHAR NOT NULL DEFAULT 'algorithm'
    CHECK (assignment_type IN ('algorithm', 'manual')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES public.profiles(id),
  deactivated_at TIMESTAMPTZ,
  deactivated_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT judging_panel_judges_panel_id_judge_id_key UNIQUE (panel_id, judge_id)
);

-- ===========================================
-- 4. judging_panel_teams
-- ===========================================
CREATE TABLE IF NOT EXISTS public.judging_panel_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID NOT NULL REFERENCES public.judging_panels(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  team_code VARCHAR NOT NULL,
  subsession INT NOT NULL CHECK (subsession IN (1, 2)),
  assignment_type VARCHAR NOT NULL DEFAULT 'algorithm'
    CHECK (assignment_type IN ('algorithm', 'manual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES public.profiles(id),
  moved_from_panel_id UUID REFERENCES public.judging_panels(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT judging_panel_teams_panel_id_team_id_key UNIQUE (panel_id, team_id)
);

-- ===========================================
-- 5. Trigger functions
-- ===========================================

-- Judge can only be active in ONE panel per event
CREATE OR REPLACE FUNCTION public.check_judge_unique_active_per_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
  v_existing INT;
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;
  SELECT event_id INTO v_event_id FROM public.judging_panels WHERE id = NEW.panel_id;
  SELECT COUNT(*) INTO v_existing
    FROM public.judging_panel_judges jpj
    JOIN public.judging_panels jp ON jp.id = jpj.panel_id
    WHERE jpj.judge_id = NEW.judge_id
      AND jp.event_id = v_event_id
      AND jpj.is_active = true
      AND jpj.id IS DISTINCT FROM NEW.id;
  IF v_existing > 0 THEN
    RAISE EXCEPTION 'Judge % is already actively assigned to another panel in this event', NEW.judge_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Team can only be active in ONE panel per event
CREATE OR REPLACE FUNCTION public.check_team_unique_active_per_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
  v_existing INT;
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;
  SELECT event_id INTO v_event_id FROM public.judging_panels WHERE id = NEW.panel_id;
  SELECT COUNT(*) INTO v_existing
    FROM public.judging_panel_teams jpt
    JOIN public.judging_panels jp ON jp.id = jpt.panel_id
    WHERE jpt.team_id = NEW.team_id
      AND jp.event_id = v_event_id
      AND jpt.is_active = true
      AND jpt.id IS DISTINCT FROM NEW.id;
  IF v_existing > 0 THEN
    RAISE EXCEPTION 'Team % is already actively assigned to another panel in this event', NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ===========================================
-- 6. Triggers (drop first to be idempotent)
-- ===========================================
DROP TRIGGER IF EXISTS enforce_judge_unique_active_per_event ON public.judging_panel_judges;
CREATE TRIGGER enforce_judge_unique_active_per_event
  BEFORE INSERT OR UPDATE ON public.judging_panel_judges
  FOR EACH ROW EXECUTE FUNCTION public.check_judge_unique_active_per_event();

DROP TRIGGER IF EXISTS enforce_team_unique_active_per_event ON public.judging_panel_teams;
CREATE TRIGGER enforce_team_unique_active_per_event
  BEFORE INSERT OR UPDATE ON public.judging_panel_teams
  FOR EACH ROW EXECUTE FUNCTION public.check_team_unique_active_per_event();

-- ===========================================
-- 7. Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_judging_panels_event
  ON public.judging_panels(event_id);

CREATE INDEX IF NOT EXISTS idx_panel_judges_panel_active
  ON public.judging_panel_judges(panel_id, is_active);

CREATE INDEX IF NOT EXISTS idx_panel_judges_judge
  ON public.judging_panel_judges(judge_id);

CREATE INDEX IF NOT EXISTS idx_panel_teams_panel
  ON public.judging_panel_teams(panel_id);

CREATE INDEX IF NOT EXISTS idx_panel_teams_team
  ON public.judging_panel_teams(team_id);

-- ===========================================
-- 8. Enable RLS
-- ===========================================
ALTER TABLE public.judging_event_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judging_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judging_panel_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judging_panel_teams ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 9. RLS Policies
-- ===========================================

-- judging_event_config: admin full access
DROP POLICY IF EXISTS judging_event_config_admin_all ON public.judging_event_config;
CREATE POLICY judging_event_config_admin_all ON public.judging_event_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- judging_panels: admin full access + judge select own panels
DROP POLICY IF EXISTS judging_panels_admin_all ON public.judging_panels;
CREATE POLICY judging_panels_admin_all ON public.judging_panels
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS judging_panels_judge_select ON public.judging_panels;
CREATE POLICY judging_panels_judge_select ON public.judging_panels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM judging_panel_judges
      WHERE judging_panel_judges.panel_id = judging_panels.id
        AND judging_panel_judges.judge_id = auth.uid()
        AND judging_panel_judges.is_active = true
    )
  );

-- judging_panel_judges: admin full access + judge select own assignments
DROP POLICY IF EXISTS judging_panel_judges_admin_all ON public.judging_panel_judges;
CREATE POLICY judging_panel_judges_admin_all ON public.judging_panel_judges
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS judging_panel_judges_judge_select ON public.judging_panel_judges;
CREATE POLICY judging_panel_judges_judge_select ON public.judging_panel_judges
  FOR SELECT USING (judge_id = auth.uid());

-- judging_panel_teams: admin full access + judge select teams in their panels
DROP POLICY IF EXISTS judging_panel_teams_admin_all ON public.judging_panel_teams;
CREATE POLICY judging_panel_teams_admin_all ON public.judging_panel_teams
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS judging_panel_teams_judge_select ON public.judging_panel_teams;
CREATE POLICY judging_panel_teams_judge_select ON public.judging_panel_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM judging_panel_judges
      WHERE judging_panel_judges.panel_id = judging_panel_teams.panel_id
        AND judging_panel_judges.judge_id = auth.uid()
        AND judging_panel_judges.is_active = true
    )
  );

NOTIFY pgrst, 'reload schema';
