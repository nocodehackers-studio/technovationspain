-- Drop the redundant restrictive INSERT policy that's causing conflicts
DROP POLICY IF EXISTS "Authenticated users can register to events" ON public.event_registrations;

-- The "Verified users can register" policy already handles the INSERT properly