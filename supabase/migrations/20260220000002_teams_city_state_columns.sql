-- Migration: Add city/state to teams + relax category CHECK
-- Required by: Tech-Spec 3/3 (Import System)
-- Teams CSV includes city/state fields and raw division values

-- 1. Add city and state columns to teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS state TEXT;

-- 2. Relax category CHECK constraint
-- Current: only allows 'beginner', 'junior', 'senior'
-- Import stores raw CSV division values (e.g., "Senior Division")
-- Remapping to normalized values is deferred to future work
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_category_check;
