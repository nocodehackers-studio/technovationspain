
-- Platform settings key-value table
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'false'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings
CREATE POLICY "Anyone can read platform settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- Allow anonymous to read too (for public registration page)
CREATE POLICY "Anonymous can read platform settings"
ON public.platform_settings FOR SELECT
TO anon
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert
CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed: judge registration disabled by default
INSERT INTO public.platform_settings (key, value) VALUES ('judge_registration_enabled', 'false'::jsonb);
