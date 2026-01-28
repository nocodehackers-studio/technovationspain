-- Create event_volunteers table for volunteer signups
CREATE TABLE public.event_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_volunteers ENABLE ROW LEVEL SECURITY;

-- Volunteers can view own signups and admins can view all
CREATE POLICY "Volunteers can view own signups"
ON public.event_volunteers FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Volunteers can sign up to events
CREATE POLICY "Volunteers can sign up"
ON public.event_volunteers FOR INSERT
WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'volunteer'::app_role));

-- Volunteers can cancel own signup
CREATE POLICY "Volunteers can cancel own signup"
ON public.event_volunteers FOR DELETE
USING (user_id = auth.uid());

-- Admins can manage all
CREATE POLICY "Admins manage volunteer signups"
ON public.event_volunteers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update user_roles RLS to allow volunteer self-assignment
DROP POLICY IF EXISTS "Users can insert own allowed role" ON public.user_roles;

CREATE POLICY "Users can insert own allowed role"
ON public.user_roles FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND role IN ('participant'::app_role, 'mentor'::app_role, 'judge'::app_role, 'volunteer'::app_role)
  AND (
    NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND verification_status = 'verified'::verification_status
    )
  )
);