-- ============================================================
-- 007: Platform Defaults (consolidated)
-- System configuration defaults required for application operation
-- ============================================================

INSERT INTO public.platform_settings (key, value)
VALUES ('judge_registration_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
