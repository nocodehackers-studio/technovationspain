-- 1. Add companion_fields_config to event_ticket_types
ALTER TABLE event_ticket_types 
ADD COLUMN companion_fields_config JSONB DEFAULT '["first_name", "last_name", "relationship"]';

-- 2. Add dni column to companions
ALTER TABLE companions ADD COLUMN dni TEXT;

-- 3. Make first_name and last_name nullable in companions
ALTER TABLE companions 
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL;