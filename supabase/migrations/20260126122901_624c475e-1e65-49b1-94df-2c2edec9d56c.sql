-- Actualizar función increment_registration_count para recibir número de acompañantes
CREATE OR REPLACE FUNCTION public.increment_registration_count(
  p_event_id UUID,
  p_ticket_type_id UUID,
  p_companions_count INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_increment INTEGER;
BEGIN
  -- Total a incrementar = 1 (registro principal) + acompañantes
  v_total_increment := 1 + COALESCE(p_companions_count, 0);
  
  -- Incrementar contador del tipo de entrada
  UPDATE public.event_ticket_types 
  SET current_count = current_count + v_total_increment 
  WHERE id = p_ticket_type_id;
  
  -- Incrementar contador del evento
  UPDATE public.events 
  SET current_registrations = current_registrations + v_total_increment 
  WHERE id = p_event_id;
END;
$$;

-- Actualizar función decrement_registration_count para recibir número de acompañantes
CREATE OR REPLACE FUNCTION public.decrement_registration_count(
  p_event_id UUID,
  p_ticket_type_id UUID,
  p_companions_count INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_decrement INTEGER;
BEGIN
  -- Total a decrementar = 1 (registro principal) + acompañantes
  v_total_decrement := 1 + COALESCE(p_companions_count, 0);
  
  UPDATE public.event_ticket_types 
  SET current_count = GREATEST(0, current_count - v_total_decrement) 
  WHERE id = p_ticket_type_id;
  
  UPDATE public.events 
  SET current_registrations = GREATEST(0, current_registrations - v_total_decrement) 
  WHERE id = p_event_id;
END;
$$;