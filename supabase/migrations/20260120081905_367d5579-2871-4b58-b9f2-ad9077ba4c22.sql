-- Tabla para almacenar estudiantes autorizados del CSV de Technovation
-- Cuando un usuario se registre con un email de esta tabla, será verificado automáticamente

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
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  matched_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_authorized_students_email ON public.authorized_students(email);
CREATE INDEX idx_authorized_students_tg_id ON public.authorized_students(tg_id);
CREATE INDEX idx_authorized_students_matched ON public.authorized_students(matched_profile_id);

-- Habilitar RLS
ALTER TABLE public.authorized_students ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden gestionar la whitelist
CREATE POLICY "Admins can manage authorized students"
ON public.authorized_students
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Cualquier usuario autenticado puede verificar si su email está autorizado (para auto-verificación)
CREATE POLICY "Users can check their own authorization"
ON public.authorized_students
FOR SELECT
USING (lower(email) = lower((SELECT email FROM profiles WHERE id = auth.uid())));

-- Trigger para actualizar updated_at
CREATE TRIGGER update_authorized_students_updated_at
BEFORE UPDATE ON public.authorized_students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para auto-verificar usuarios cuando se registran
-- Se ejecuta cuando se crea un nuevo perfil
CREATE OR REPLACE FUNCTION public.auto_verify_authorized_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- Actualizar el perfil con los datos de la whitelist
    NEW.verification_status := 'verified';
    NEW.first_name := COALESCE(NEW.first_name, authorized_record.first_name);
    NEW.last_name := COALESCE(NEW.last_name, authorized_record.last_name);
    NEW.tg_id := authorized_record.tg_id;
    NEW.tg_email := authorized_record.email;
    NEW.phone := COALESCE(NEW.phone, authorized_record.phone);
    
    -- Marcar el registro como matcheado
    UPDATE authorized_students
    SET matched_profile_id = NEW.id
    WHERE id = authorized_record.id;
    
    -- Asignar rol de participant si no tiene roles
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'participant')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que se ejecuta cuando se crea/actualiza un perfil
CREATE TRIGGER auto_verify_on_profile_change
BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_verify_authorized_student();