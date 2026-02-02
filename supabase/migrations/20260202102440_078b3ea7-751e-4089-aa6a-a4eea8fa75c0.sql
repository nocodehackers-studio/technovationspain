-- Remove organization column and add notes column to hubs
ALTER TABLE public.hubs DROP COLUMN IF EXISTS organization;
ALTER TABLE public.hubs ADD COLUMN notes TEXT;