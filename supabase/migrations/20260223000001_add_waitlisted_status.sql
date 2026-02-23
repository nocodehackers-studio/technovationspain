-- Add 'waitlisted' to the registration_status CHECK constraint
-- This enables the waitlist feature when event capacity is exceeded

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_registration_status_check;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_registration_status_check
  CHECK (registration_status IN ('confirmed', 'cancelled', 'checked_in', 'waitlisted'));

-- Add chapter field to profiles for Technovation chapter assignment
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chapter TEXT;
