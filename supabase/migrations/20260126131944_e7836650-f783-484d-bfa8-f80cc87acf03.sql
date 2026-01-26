-- Eliminar la constraint que impide re-inscripción tras cancelar
ALTER TABLE public.event_registrations 
DROP CONSTRAINT IF EXISTS event_registrations_event_id_user_id_key;

-- Crear índice parcial para optimizar búsquedas de registros activos
CREATE INDEX IF NOT EXISTS idx_event_registrations_active 
ON public.event_registrations (event_id, user_id) 
WHERE registration_status != 'cancelled';