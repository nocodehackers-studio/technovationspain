-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('participant', 'mentor', 'judge', 'volunteer', 'admin');

-- Create verification status enum
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected', 'manual_review');

-- Create user_roles table (security best practice - roles in separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Hubs table (created first as it's referenced by profiles)
CREATE TABLE public.hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization TEXT,
  location TEXT,
  coordinator_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;

-- Profiles table (replaces users table in the spec)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  tg_email TEXT,
  tg_id TEXT UNIQUE,
  verification_status verification_status DEFAULT 'pending',
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  date_of_birth DATE,
  postal_code TEXT,
  hub_id UUID REFERENCES public.hubs(id),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add coordinator reference to hubs after profiles is created
ALTER TABLE public.hubs ADD CONSTRAINT hubs_coordinator_fkey 
  FOREIGN KEY (coordinator_id) REFERENCES public.profiles(id);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tg_team_id TEXT UNIQUE,
  category TEXT CHECK (category IN ('beginner', 'junior', 'senior')),
  hub_id UUID REFERENCES public.hubs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_type TEXT CHECK (member_type IN ('participant', 'mentor')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('intermediate', 'regional_final')),
  date DATE NOT NULL,
  location TEXT,
  max_capacity INTEGER,
  current_registrations INTEGER DEFAULT 0,
  registration_open_date DATE,
  registration_close_date DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Workshops table
CREATE TABLE public.workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('beginner', 'junior', 'senior', 'general')),
  time_slot TEXT,
  max_capacity INTEGER NOT NULL,
  current_registrations INTEGER DEFAULT 0,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;

-- Event registrations table
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  registration_status TEXT DEFAULT 'confirmed' CHECK (registration_status IN ('confirmed', 'cancelled', 'checked_in')),
  qr_code TEXT UNIQUE NOT NULL,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Companions table
CREATE TABLE public.companions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id UUID REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.companions ENABLE ROW LEVEL SECURITY;

-- Workshop registrations table
CREATE TABLE public.workshop_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  preference_order INTEGER,
  assigned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workshop_id, team_id)
);

ALTER TABLE public.workshop_registrations ENABLE ROW LEVEL SECURITY;

-- Parental consents table
CREATE TABLE public.parental_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_email TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  consent_type TEXT CHECK (consent_type IN ('participation', 'image_rights', 'data_processing')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  consent_token TEXT UNIQUE,
  consent_date TIMESTAMPTZ,
  revocation_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, consent_type)
);

ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

-- CSV imports table
CREATE TABLE public.csv_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES public.profiles(id),
  file_name TEXT NOT NULL,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_new INTEGER DEFAULT 0,
  errors JSONB,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  changes JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Hubs policies
CREATE POLICY "Verified users can view hubs" ON public.hubs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage hubs" ON public.hubs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Teams policies
CREATE POLICY "Team members can view their teams" ON public.teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'volunteer')
  );

CREATE POLICY "Admins can manage teams" ON public.teams
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Team members policies
CREATE POLICY "Users can view team members of their teams" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'volunteer')
  );

CREATE POLICY "Admins can manage team members" ON public.team_members
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Events policies
CREATE POLICY "Verified users can view events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Workshops policies
CREATE POLICY "Verified users can view workshops" ON public.workshops
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage workshops" ON public.workshops
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Event registrations policies
CREATE POLICY "Users can view own registrations" ON public.event_registrations
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'volunteer')
  );

CREATE POLICY "Verified users can register" ON public.event_registrations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND verification_status = 'verified')
  );

CREATE POLICY "Users can update own registrations" ON public.event_registrations
  FOR UPDATE USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Volunteers can update registrations for check-in" ON public.event_registrations
  FOR UPDATE USING (public.has_role(auth.uid(), 'volunteer'));

-- Companions policies
CREATE POLICY "Users can view companions of own registrations" ON public.companions
  FOR SELECT USING (
    event_registration_id IN (SELECT id FROM public.event_registrations WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'volunteer')
  );

CREATE POLICY "Users can manage companions of own registrations" ON public.companions
  FOR ALL USING (
    event_registration_id IN (SELECT id FROM public.event_registrations WHERE user_id = auth.uid())
  );

-- Workshop registrations policies
CREATE POLICY "Team members can view workshop registrations" ON public.workshop_registrations
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'volunteer')
  );

CREATE POLICY "Mentors can register their teams for workshops" ON public.workshop_registrations
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND member_type = 'mentor'
    )
  );

CREATE POLICY "Admins can manage workshop registrations" ON public.workshop_registrations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Parental consents policies
CREATE POLICY "Users can view own consents" ON public.parental_consents
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own consents" ON public.parental_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public can update consents by token" ON public.parental_consents
  FOR UPDATE USING (consent_token IS NOT NULL);

-- CSV imports policies
CREATE POLICY "Admins can manage imports" ON public.csv_imports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Audit logs policies
CREATE POLICY "Admins can view logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();