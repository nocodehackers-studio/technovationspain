-- ============================================================================
-- Migration: Add requires_imported_team to event_ticket_types
-- Description: New flag to restrict participant tickets to users whose team
--              is imported in the event via CSV. Only enforced on regional_final events.
-- ============================================================================

ALTER TABLE public.event_ticket_types
  ADD COLUMN IF NOT EXISTS requires_imported_team boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
