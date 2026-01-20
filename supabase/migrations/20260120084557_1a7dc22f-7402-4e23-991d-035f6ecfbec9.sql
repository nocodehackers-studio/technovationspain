-- Eliminar trigger y función antiguos
DROP TRIGGER IF EXISTS auto_verify_on_profile_change ON profiles;
DROP FUNCTION IF EXISTS auto_verify_authorized_student();

-- Función BEFORE: solo modifica NEW (no hace updates a otras tablas)
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_student_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  authorized_record authorized_students%ROWTYPE;
BEGIN
  -- Buscar si el email está en la whitelist
  SELECT * INTO authorized_record
  FROM authorized_students
  WHERE lower(email) = lower(NEW.email)
  AND matched_profile_id IS NULL
  LIMIT 1;
  
  IF FOUND THEN
    -- Solo modificar el NEW record, no hacer updates a otras tablas
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

-- Función AFTER: actualiza tablas relacionadas (el perfil ya existe en este punto)
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_student_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Solo ejecutar si el perfil fue verificado y tiene tg_id (indica que viene de whitelist)
  IF NEW.verification_status = 'verified' AND NEW.tg_id IS NOT NULL THEN
    -- Marcar el registro de authorized_students como matcheado
    UPDATE authorized_students
    SET matched_profile_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
    AND matched_profile_id IS NULL;
    
    -- Asignar rol de participant si no tiene roles
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'participant')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger BEFORE INSERT
CREATE TRIGGER auto_verify_before_profile_insert
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_verify_authorized_student_before();

-- Crear trigger AFTER INSERT
CREATE TRIGGER auto_verify_after_profile_insert
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_verify_authorized_student_after();