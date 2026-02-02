ALTER TABLE event_ticket_types 
ADD COLUMN required_fields text[] DEFAULT ARRAY['first_name', 'last_name', 'email']::text[];

COMMENT ON COLUMN event_ticket_types.required_fields IS 
  'Campos obligatorios para el titular: dni, phone, team_name, tg_email';