-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net extension for HTTP requests from pg_cron (usually enabled by default)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule process-scheduled-emails to run every 30 minutes
-- Note: The CRON_SECRET and SUPABASE_URL must be configured via:
--   Supabase Dashboard > Project Settings > Database > Custom Postgres Config
--   Add: app.settings.supabase_url = 'https://orvkqnbshkxzyhqpjsdw.supabase.co'
--   Add: app.settings.cron_secret = '<your-cron-secret-value>'
-- F7: Unschedule first if exists to make migration idempotent
DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-emails');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist yet, ignore
  NULL;
END;
$$;

SELECT cron.schedule(
  'process-scheduled-emails',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-scheduled-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
