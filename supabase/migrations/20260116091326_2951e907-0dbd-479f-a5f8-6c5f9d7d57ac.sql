-- Create a function to auto-assign admin role after user creation for specific emails
CREATE OR REPLACE FUNCTION public.assign_admin_role_for_approved_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the email is in the approved admin list
  IF NEW.email = 'alex@nocodehackers.es' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Also mark as verified
    UPDATE public.profiles
    SET verification_status = 'verified', onboarding_completed = true
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires after profile creation
DROP TRIGGER IF EXISTS on_profile_created_assign_admin ON public.profiles;
CREATE TRIGGER on_profile_created_assign_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_admin_role_for_approved_emails();