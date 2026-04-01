-- ============================================================================
-- Migration: Session Assignment Logic — Operational Controls
-- Description: Add display_order, manual change tracking fields, and is_active
--              to support reordering, audit trail, and team/judge deactivation.
-- Prerequisite: Tables judging_panel_teams, judging_panel_judges, event_teams
--               must exist before running this migration.
-- ============================================================================

-- 1. event_teams: add is_active flag for event-level team deactivation
ALTER TABLE public.event_teams
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. judging_panel_teams: display_order + manual change audit fields
ALTER TABLE public.judging_panel_teams
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.judging_panel_teams
  ADD COLUMN IF NOT EXISTS manual_change_comment TEXT;

ALTER TABLE public.judging_panel_teams
  ADD COLUMN IF NOT EXISTS manual_change_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.judging_panel_teams
  ADD COLUMN IF NOT EXISTS manual_change_at TIMESTAMPTZ;

-- 3. judging_panel_judges: manual change audit fields
ALTER TABLE public.judging_panel_judges
  ADD COLUMN IF NOT EXISTS manual_change_comment TEXT;

ALTER TABLE public.judging_panel_judges
  ADD COLUMN IF NOT EXISTS manual_change_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.judging_panel_judges
  ADD COLUMN IF NOT EXISTS manual_change_at TIMESTAMPTZ;

-- 4. Index for ordering teams within a panel
CREATE INDEX IF NOT EXISTS idx_judging_panel_teams_display_order
  ON public.judging_panel_teams(panel_id, display_order);

NOTIFY pgrst, 'reload schema';
