-- ============================================================================
-- Migration: Event Teams Check-in Fields
-- Description: Add checked_in_at and checked_in_by to event_teams for
--              manual team check-in at regional_final events.
-- ============================================================================

ALTER TABLE public.event_teams
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.event_teams
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
