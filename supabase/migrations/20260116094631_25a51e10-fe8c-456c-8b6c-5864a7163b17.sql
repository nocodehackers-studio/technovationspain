-- =============================================
-- 1. Modificar tabla events existente
-- =============================================
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS location_name TEXT,
ADD COLUMN IF NOT EXISTS location_address TEXT,
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS location_coordinates JSONB,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed'));

-- =============================================
-- 2. Crear tabla event_ticket_types
-- =============================================
CREATE TABLE IF NOT EXISTS public.event_ticket_types (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. Modificar tabla event_registrations existente
-- =============================================
ALTER TABLE public.event_registrations 
ADD COLUMN IF NOT EXISTS ticket_type_id UUID REFERENCES public.event_ticket_types(id),
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS dni TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS team_name TEXT,
ADD COLUMN IF NOT EXISTS team_id_tg TEXT,
ADD COLUMN IF NOT EXISTS tg_email TEXT,
ADD COLUMN IF NOT EXISTS is_companion BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS companion_of_registration_id UUID REFERENCES public.event_registrations(id),
ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS image_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_consent BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS registration_number TEXT UNIQUE;

-- =============================================
-- 4. Crear tabla event_agenda
-- =============================================
CREATE TABLE IF NOT EXISTS public.event_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#f3f4f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5. Crear índices
-- =============================================
CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event_id ON public.event_ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_ticket_type_id ON public.event_registrations(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_registration_number ON public.event_registrations(registration_number);
CREATE INDEX IF NOT EXISTS idx_event_registrations_tg_email ON public.event_registrations(tg_email);
CREATE INDEX IF NOT EXISTS idx_event_agenda_event_id ON public.event_agenda(event_id);

-- =============================================
-- 6. RLS para event_ticket_types
-- =============================================
ALTER TABLE public.event_ticket_types ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver tipos de entrada de eventos publicados
CREATE POLICY "Anyone can view ticket types for published events" ON public.event_ticket_types
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_ticket_types.event_id 
      AND events.status = 'published'
    )
    OR has_role(auth.uid(), 'admin')
  );

-- Admins pueden gestionar tipos de entrada
CREATE POLICY "Admins can manage ticket types" ON public.event_ticket_types
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- 7. RLS para event_agenda
-- =============================================
ALTER TABLE public.event_agenda ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver agenda de eventos publicados
CREATE POLICY "Anyone can view agenda for published events" ON public.event_agenda
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_agenda.event_id 
      AND events.status = 'published'
    )
    OR has_role(auth.uid(), 'admin')
  );

-- Admins pueden gestionar agenda
CREATE POLICY "Admins can manage agenda" ON public.event_agenda
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- 8. Actualizar RLS de events para eventos públicos
-- =============================================
CREATE POLICY "Anyone can view published events" ON public.events
  FOR SELECT USING (status = 'published');

-- =============================================
-- 9. Política adicional para registros - usuarios autenticados pueden crear
-- =============================================
CREATE POLICY "Authenticated users can register to events" ON public.event_registrations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 10. Función para incrementar contador de registros
-- =============================================
CREATE OR REPLACE FUNCTION public.increment_registration_count(
  p_event_id UUID,
  p_ticket_type_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Incrementar contador del tipo de entrada
  UPDATE public.event_ticket_types 
  SET current_count = current_count + 1 
  WHERE id = p_ticket_type_id;
  
  -- Incrementar contador del evento
  UPDATE public.events 
  SET current_registrations = current_registrations + 1 
  WHERE id = p_event_id;
END;
$$;

-- =============================================
-- 11. Función para decrementar contador (cancelaciones)
-- =============================================
CREATE OR REPLACE FUNCTION public.decrement_registration_count(
  p_event_id UUID,
  p_ticket_type_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_ticket_types 
  SET current_count = GREATEST(0, current_count - 1) 
  WHERE id = p_ticket_type_id;
  
  UPDATE public.events 
  SET current_registrations = GREATEST(0, current_registrations - 1) 
  WHERE id = p_event_id;
END;
$$;