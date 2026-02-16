-- ============================================================
-- 001: Extensions, Enums, and Tables (consolidated)
-- Net final schema state from 58 original migrations
-- ============================================================

-- Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE public.app_role AS ENUM (
  'participant', 'mentor', 'judge', 'volunteer', 'chapter_ambassador', 'admin'
);

CREATE TYPE public.verification_status AS ENUM (
  'pending', 'verified', 'rejected', 'manual_review'
);

CREATE TYPE public.ticket_priority AS ENUM (
  'nice_to_have', 'mandatory'
);

CREATE TYPE public.ticket_status AS ENUM (
  'pending', 'in_progress', 'completed'
);

-- ============================================================
-- TABLES (dependency order)
-- ============================================================

-- 1. user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- 2. hubs (coordinator_id FK added after profiles)
CREATE TABLE public.hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  coordinator_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. profiles
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
  custom_fields JSONB DEFAULT '{}',
  parent_email VARCHAR(255),
  dni TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT parent_email_format CHECK (
    parent_email IS NULL OR parent_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  CONSTRAINT valid_phone CHECK (
    phone IS NULL OR phone = '' OR (length(phone) <= 20 AND phone ~ '^[+0-9\s\-()]+$')
  )
);

COMMENT ON COLUMN public.profiles.parent_email IS 'Email of parent/guardian for users who were under 14 at registration. Used for consent email routing.';
COMMENT ON COLUMN public.profiles.dni IS 'DNI o NIE del usuario. Formato: 8 dígitos + letra (DNI) o X/Y/Z + 7 dígitos + letra (NIE)';

-- Add coordinator FK now that profiles exists
ALTER TABLE public.hubs ADD CONSTRAINT hubs_coordinator_fkey
  FOREIGN KEY (coordinator_id) REFERENCES public.profiles(id);

-- 4. teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tg_team_id TEXT UNIQUE,
  category TEXT CHECK (category IN ('beginner', 'junior', 'senior')),
  hub_id UUID REFERENCES public.hubs(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. team_members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_type TEXT CHECK (member_type IN ('participant', 'mentor')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- 6. events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('intermediate', 'regional_final')),
  date DATE NOT NULL,
  location TEXT,
  max_capacity INTEGER,
  current_registrations INTEGER DEFAULT 0,
  registration_open_date TIMESTAMPTZ,
  registration_close_date TIMESTAMPTZ,
  description TEXT,
  start_time TIME,
  end_time TIME,
  location_name TEXT,
  location_address TEXT,
  location_city TEXT,
  location_coordinates JSONB,
  image_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  workshop_preferences_open BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. workshops
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
  company VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN public.workshops.max_capacity IS 'Aforo máximo por turno horario';

-- 8. event_ticket_types
CREATE TABLE public.event_ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_capacity INTEGER NOT NULL,
  current_count INTEGER DEFAULT 0,
  requires_team BOOLEAN DEFAULT false,
  requires_verification BOOLEAN DEFAULT true,
  allowed_roles TEXT[],
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  max_companions INTEGER NOT NULL DEFAULT 0,
  companion_fields_config JSONB DEFAULT '["first_name", "last_name", "relationship"]',
  required_fields TEXT[] DEFAULT ARRAY['first_name', 'last_name', 'email']::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN public.event_ticket_types.max_companions IS 'Maximum number of companions allowed for this ticket type. 0 = no companions allowed.';
COMMENT ON COLUMN public.event_ticket_types.required_fields IS 'Campos obligatorios para el titular: dni, phone, team_name, tg_email';

-- 9. event_registrations
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ticket_type_id UUID REFERENCES public.event_ticket_types(id),
  registration_status TEXT DEFAULT 'confirmed' CHECK (registration_status IN ('confirmed', 'cancelled', 'checked_in')),
  qr_code TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  dni TEXT,
  phone TEXT,
  team_name TEXT,
  team_id_tg TEXT,
  tg_email TEXT,
  is_companion BOOLEAN DEFAULT false,
  companion_of_registration_id UUID REFERENCES public.event_registrations(id),
  checked_in_by UUID REFERENCES public.profiles(id),
  image_consent BOOLEAN DEFAULT false,
  data_consent BOOLEAN DEFAULT true,
  registration_number TEXT UNIQUE,
  participant_count INTEGER DEFAULT 1,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  consent_token UUID DEFAULT gen_random_uuid() NOT NULL
);

COMMENT ON COLUMN public.event_registrations.participant_count IS 'Número de participantes del equipo que asistirán al evento';

-- 10. companions
CREATE TABLE public.companions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id UUID REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  relationship TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  dni TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. workshop_registrations
CREATE TABLE public.workshop_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  preference_order INTEGER,
  assigned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workshop_id, team_id)
);

-- 12. csv_imports
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

-- 13. audit_logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  changes JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 14. authorized_students
CREATE TABLE public.authorized_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  tg_id TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  parent_name TEXT,
  parent_email TEXT,
  team_name TEXT,
  team_division TEXT,
  school_name TEXT,
  city TEXT,
  state TEXT,
  age INTEGER,
  parental_consent TEXT,
  media_consent TEXT,
  signed_up_at DATE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- 15. authorized_users
CREATE TABLE public.authorized_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  tg_id TEXT,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('student', 'mentor', 'judge', 'chapter_ambassador')),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company_name TEXT,
  school_name TEXT,
  team_name TEXT,
  team_division TEXT CHECK (team_division IS NULL OR lower(team_division) IN ('beginner', 'junior', 'senior')),
  parent_name TEXT,
  parent_email TEXT,
  city TEXT,
  state TEXT,
  age INTEGER,
  parental_consent TEXT,
  media_consent TEXT,
  signed_up_at DATE,
  matched_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT authorized_users_email_unique UNIQUE (email)
);

-- 16. event_agenda
CREATE TABLE public.event_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#f3f4f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. table_custom_columns
CREATE TABLE public.table_custom_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  column_key TEXT NOT NULL,
  column_label TEXT NOT NULL,
  column_type TEXT DEFAULT 'text',
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(table_name, column_key)
);

-- 18. admin_table_preferences
CREATE TABLE public.admin_table_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  table_name TEXT NOT NULL,
  hidden_columns TEXT[] DEFAULT '{}',
  column_order TEXT[] DEFAULT '{}',
  saved_filters JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, table_name)
);

-- 19. event_email_templates
CREATE TABLE public.event_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('confirmation', 'reminder')),
  subject TEXT NOT NULL DEFAULT '',
  body_content TEXT NOT NULL DEFAULT '',
  reply_to_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, template_type)
);

-- 20. event_email_sends
CREATE TABLE public.event_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  template_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_content TEXT,
  recipients_count INTEGER DEFAULT 0,
  target_audience TEXT DEFAULT 'all_confirmed' CHECK (target_audience IN ('all_confirmed', 'ticket_type', 'custom')),
  target_ticket_type_id UUID REFERENCES public.event_ticket_types(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 21. event_volunteers
CREATE TABLE public.event_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 22. development_tickets
CREATE TABLE public.development_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority ticket_priority NOT NULL DEFAULT 'nice_to_have',
  status ticket_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 23. workshop_time_slots
CREATE TABLE public.workshop_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, slot_number)
);

-- 24. workshop_preferences
CREATE TABLE public.workshop_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  preference_order INTEGER NOT NULL CHECK (preference_order >= 1),
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, event_id, workshop_id),
  UNIQUE(team_id, event_id, preference_order)
);

-- 25. workshop_assignments
CREATE TABLE public.workshop_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES public.workshop_time_slots(id),
  assignment_slot CHAR(1) NOT NULL CHECK (assignment_slot IN ('A', 'B')),
  preference_matched INTEGER,
  assignment_type VARCHAR(20) DEFAULT 'algorithm',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID,
  UNIQUE(team_id, event_id, assignment_slot),
  UNIQUE(team_id, event_id, workshop_id)
);

-- 26. event_ticket_consents
CREATE TABLE public.event_ticket_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  signer_full_name TEXT NOT NULL,
  signer_dni TEXT NOT NULL,
  signer_relationship TEXT NOT NULL,
  minor_name TEXT,
  minor_age INTEGER,
  signature TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. parental_consents
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

-- 28. platform_settings
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'false'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_parent_email ON public.profiles(parent_email) WHERE parent_email IS NOT NULL;

-- event_ticket_types
CREATE INDEX idx_event_ticket_types_event_id ON public.event_ticket_types(event_id);

-- event_registrations
CREATE INDEX idx_event_registrations_ticket_type_id ON public.event_registrations(ticket_type_id);
CREATE INDEX idx_event_registrations_registration_number ON public.event_registrations(registration_number);
CREATE INDEX idx_event_registrations_tg_email ON public.event_registrations(tg_email);
CREATE UNIQUE INDEX idx_event_registrations_consent_token ON public.event_registrations(consent_token);
CREATE INDEX idx_event_registrations_active ON public.event_registrations(event_id, user_id)
  WHERE registration_status != 'cancelled';
-- event_agenda
CREATE INDEX idx_event_agenda_event_id ON public.event_agenda(event_id);

-- authorized_students
CREATE INDEX idx_authorized_students_email ON public.authorized_students(email);
CREATE INDEX idx_authorized_students_tg_id ON public.authorized_students(tg_id);
CREATE INDEX idx_authorized_students_matched ON public.authorized_students(matched_profile_id);

-- authorized_users
CREATE INDEX idx_authorized_users_email ON public.authorized_users(lower(email));
CREATE INDEX idx_authorized_users_profile_type ON public.authorized_users(profile_type);
CREATE INDEX idx_authorized_users_matched_profile ON public.authorized_users(matched_profile_id);

-- table_custom_columns
CREATE INDEX idx_custom_columns_table_name ON public.table_custom_columns(table_name);

-- admin_table_preferences
CREATE INDEX idx_table_preferences_user_table ON public.admin_table_preferences(user_id, table_name);

-- event_email_templates
CREATE INDEX idx_event_email_templates_event_id ON public.event_email_templates(event_id);

-- event_email_sends
CREATE INDEX idx_event_email_sends_event_id ON public.event_email_sends(event_id);
CREATE INDEX idx_event_email_sends_status ON public.event_email_sends(status);
CREATE INDEX idx_event_email_sends_scheduled_for ON public.event_email_sends(scheduled_for)
  WHERE status = 'scheduled';

-- workshop_time_slots
CREATE INDEX idx_wts_event ON public.workshop_time_slots(event_id);

-- workshop_preferences
CREATE INDEX idx_wp_team ON public.workshop_preferences(team_id);
CREATE INDEX idx_wp_event ON public.workshop_preferences(event_id);
CREATE INDEX idx_wp_workshop ON public.workshop_preferences(workshop_id);

-- workshop_assignments
CREATE INDEX idx_wa_team ON public.workshop_assignments(team_id);
CREATE INDEX idx_wa_workshop ON public.workshop_assignments(workshop_id);
CREATE INDEX idx_wa_slot ON public.workshop_assignments(time_slot_id);
CREATE INDEX idx_wa_event ON public.workshop_assignments(event_id);

-- event_ticket_consents
ALTER TABLE ONLY public.event_ticket_consents
  ADD CONSTRAINT event_ticket_consents_event_registration_id_key UNIQUE (event_registration_id);
CREATE INDEX idx_event_ticket_consents_registration
  ON public.event_ticket_consents(event_registration_id);
