-- Drop unused judge profile fields from profiles table
-- These fields were part of judge onboarding but are no longer collected.

ALTER TABLE profiles DROP COLUMN IF EXISTS judge_how_discovered_program;
ALTER TABLE profiles DROP COLUMN IF EXISTS judge_previous_participation;
