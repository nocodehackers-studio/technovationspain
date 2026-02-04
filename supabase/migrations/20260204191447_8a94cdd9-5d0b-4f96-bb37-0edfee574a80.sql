-- Add field to control when mentors can submit workshop preferences
ALTER TABLE public.events 
ADD COLUMN workshop_preferences_open BOOLEAN NOT NULL DEFAULT false;