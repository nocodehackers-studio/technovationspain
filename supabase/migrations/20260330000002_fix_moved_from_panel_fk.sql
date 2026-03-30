-- Fix: moved_from_panel_id must allow cascade delete when clearing assignments
ALTER TABLE public.judging_panel_teams
  DROP CONSTRAINT judging_panel_teams_moved_from_panel_id_fkey,
  ADD CONSTRAINT judging_panel_teams_moved_from_panel_id_fkey
    FOREIGN KEY (moved_from_panel_id) REFERENCES public.judging_panels(id) ON DELETE SET NULL;
