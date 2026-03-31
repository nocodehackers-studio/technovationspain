-- Remove hub_id from judge_assignments — redundant with profiles.hub_id
ALTER TABLE public.judge_assignments DROP COLUMN IF EXISTS hub_id;
