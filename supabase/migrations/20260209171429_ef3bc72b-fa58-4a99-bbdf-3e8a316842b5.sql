
-- Fix phone constraint: allow empty strings too
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_phone;
ALTER TABLE public.profiles ADD CONSTRAINT valid_phone
  CHECK (phone IS NULL OR phone = '' OR (length(phone) <= 20 AND phone ~ '^[+0-9\s\-()]+$'));
