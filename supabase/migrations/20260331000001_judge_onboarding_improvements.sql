-- Add external_judge_id (from CSV import) and hub_id (from judge onboarding) to judge_assignments
ALTER TABLE public.judge_assignments
  ADD COLUMN IF NOT EXISTS external_judge_id TEXT,
  ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES public.hubs(id) ON DELETE SET NULL;
