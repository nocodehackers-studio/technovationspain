-- Add total_records column so the frontend can show import progress
ALTER TABLE public.csv_imports
  ADD COLUMN IF NOT EXISTS total_records INTEGER DEFAULT 0;
