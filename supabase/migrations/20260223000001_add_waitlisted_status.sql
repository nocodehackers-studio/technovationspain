-- Add 'waitlisted' to the registration_status CHECK constraint
-- This enables the waitlist feature when event capacity is exceeded

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_registration_status_check;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_registration_status_check
  CHECK (registration_status IN ('confirmed', 'cancelled', 'checked_in', 'waitlisted'));

-- Add chapter field to profiles for Technovation chapter assignment
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chapter TEXT;

-- ============================================================
-- Team status & season fields
-- Required by: Tech-Spec team-status-csv-activation
-- Enables active/inactive filtering and season tracking for CSV imports
-- ============================================================

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS season TEXT;

-- Mark teams without tg_team_id (manually created / legacy) as inactive
UPDATE public.teams SET status = 'inactive' WHERE tg_team_id IS NULL;

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_teams_status ON public.teams(status);
