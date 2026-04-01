-- Add judge_access_enabled flag to events table
-- Controls whether judges assigned to an event can access the platform
ALTER TABLE events ADD COLUMN judge_access_enabled BOOLEAN NOT NULL DEFAULT false;

-- Track when welcome email was sent to avoid duplicates on re-toggle
ALTER TABLE judge_assignments ADD COLUMN welcome_email_sent_at TIMESTAMPTZ DEFAULT NULL;
