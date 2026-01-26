-- Convertir columnas de fecha a timestamp with time zone para incluir hora
ALTER TABLE events 
  ALTER COLUMN registration_open_date TYPE timestamp with time zone 
    USING registration_open_date::timestamp with time zone,
  ALTER COLUMN registration_close_date TYPE timestamp with time zone 
    USING registration_close_date::timestamp with time zone;