-- =====================================================
-- 1. CREATE NEW authorized_users TABLE
-- =====================================================
CREATE TABLE public.authorized_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tg_id text,
  profile_type text NOT NULL CHECK (profile_type IN ('student', 'mentor', 'judge', 'chapter_ambassador')),
  first_name text,
  last_name text,
  phone text,
  company_name text,
  school_name text,
  team_name text,
  team_division text CHECK (team_division IS NULL OR lower(team_division) IN ('beginner', 'junior', 'senior')),
  parent_name text,
  parent_email text,
  city text,
  state text,
  age integer,
  parental_consent text,
  media_consent text,
  signed_up_at date,
  matched_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT authorized_users_email_unique UNIQUE (email)
);

-- Create index for faster lookups
CREATE INDEX idx_authorized_users_email ON public.authorized_users(lower(email));
CREATE INDEX idx_authorized_users_profile_type ON public.authorized_users(profile_type);
CREATE INDEX idx_authorized_users_matched_profile ON public.authorized_users(matched_profile_id);

-- =====================================================
-- 2. MIGRATE EXISTING DATA FROM authorized_students
-- =====================================================
INSERT INTO public.authorized_users (
  email, tg_id, profile_type, first_name, last_name, phone,
  school_name, team_name, team_division, parent_name, parent_email,
  city, state, age, parental_consent, media_consent, signed_up_at,
  matched_profile_id, imported_at, created_at, updated_at
)
SELECT 
  email, tg_id, 'student', first_name, last_name, phone,
  school_name, team_name, 
  CASE 
    WHEN lower(team_division) = 'beginner' THEN 'Beginner'
    WHEN lower(team_division) = 'junior' THEN 'Junior'
    WHEN lower(team_division) = 'senior' THEN 'Senior'
    ELSE team_division
  END,
  parent_name, parent_email,
  city, state, age, parental_consent, media_consent, signed_up_at,
  matched_profile_id, imported_at, created_at, updated_at
FROM public.authorized_students;

-- =====================================================
-- 3. ENABLE RLS ON authorized_users
-- =====================================================
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

-- Admins can manage all authorized users
CREATE POLICY "Admins can manage authorized users"
ON public.authorized_users
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Users can check their own authorization (by email match)
CREATE POLICY "Users can check their own authorization"
ON public.authorized_users
FOR SELECT
USING (
  lower(email) = lower((SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()))
);

-- =====================================================
-- 4. UPDATE AUTO-VERIFICATION TRIGGERS FOR NEW TABLE
-- =====================================================

-- Drop old triggers first
DROP TRIGGER IF EXISTS on_profile_created_before ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_after ON public.profiles;

-- Update BEFORE trigger to use authorized_users
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_user_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authorized_record authorized_users%ROWTYPE;
BEGIN
  -- Search if email is in the whitelist
  SELECT * INTO authorized_record
  FROM authorized_users
  WHERE lower(email) = lower(NEW.email)
  AND matched_profile_id IS NULL
  LIMIT 1;
  
  IF FOUND THEN
    -- Only modify the NEW record, don't update other tables
    NEW.verification_status := 'verified';
    NEW.first_name := COALESCE(NEW.first_name, authorized_record.first_name);
    NEW.last_name := COALESCE(NEW.last_name, authorized_record.last_name);
    NEW.tg_id := authorized_record.tg_id;
    NEW.tg_email := authorized_record.email;
    NEW.phone := COALESCE(NEW.phone, authorized_record.phone);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update AFTER trigger to use authorized_users and assign correct role
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_user_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authorized_record authorized_users%ROWTYPE;
  role_to_assign app_role;
BEGIN
  -- Only execute if profile was verified and has tg_id (indicates from whitelist)
  IF NEW.verification_status = 'verified' AND NEW.tg_id IS NOT NULL THEN
    -- Get the authorized user record to determine role
    SELECT * INTO authorized_record
    FROM authorized_users
    WHERE lower(email) = lower(NEW.email)
    AND matched_profile_id IS NULL
    LIMIT 1;
    
    IF FOUND THEN
      -- Mark the authorized_users record as matched
      UPDATE authorized_users
      SET matched_profile_id = NEW.id
      WHERE id = authorized_record.id;
      
      -- Determine role based on profile_type
      CASE authorized_record.profile_type
        WHEN 'student' THEN role_to_assign := 'participant';
        WHEN 'mentor' THEN role_to_assign := 'mentor';
        WHEN 'chapter_ambassador' THEN role_to_assign := 'mentor';
        WHEN 'judge' THEN role_to_assign := 'judge';
        ELSE role_to_assign := 'participant';
      END CASE;
      
      -- Assign the appropriate role
      INSERT INTO user_roles (user_id, role)
      VALUES (NEW.id, role_to_assign)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers on profiles
CREATE TRIGGER on_profile_created_before
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_verify_authorized_user_before();

CREATE TRIGGER on_profile_created_after
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_verify_authorized_user_after();

-- =====================================================
-- 5. CREATE UPDATE TRIGGER FOR updated_at
-- =====================================================
CREATE TRIGGER update_authorized_users_updated_at
  BEFORE UPDATE ON public.authorized_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();