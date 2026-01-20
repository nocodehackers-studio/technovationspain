-- Add max_companions field to event_ticket_types
-- This allows certain ticket types (e.g., participants) to register companions
ALTER TABLE public.event_ticket_types 
ADD COLUMN max_companions integer NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.event_ticket_types.max_companions IS 'Maximum number of companions allowed for this ticket type. 0 = no companions allowed.';