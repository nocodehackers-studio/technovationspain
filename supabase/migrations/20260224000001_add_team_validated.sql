-- Add validated boolean to teams table
-- Used to manually mark teams as ready for workshop assignment algorithm
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS validated BOOLEAN NOT NULL DEFAULT false;
