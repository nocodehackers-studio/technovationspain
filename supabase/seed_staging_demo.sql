-- ============================================================================
-- Seed: Staging demo — 35 hubs, 118 judges, 120 teams
-- Target: bmucwkjfvblnfigsganm.supabase.co (STAGING ONLY)
-- NOTE: auth.users trigger auto-creates profiles, so we INSERT auth.users
--       then UPDATE profiles with judge data.
-- Event: 66562cd4-b72e-48e8-8df7-f5aab09df4b5 (Final Regional - Mañana)
-- ============================================================================

-- ============================================
-- PART 1: CLEANUP
-- ============================================

DELETE FROM public.judging_panel_judges;
DELETE FROM public.judging_panel_teams;
DELETE FROM public.judging_panels;
DELETE FROM public.judging_event_config;
DELETE FROM public.workshop_assignments;
DELETE FROM public.workshop_preferences;
DELETE FROM public.workshop_registrations;
DELETE FROM public.event_teams;
DELETE FROM public.event_registrations;
DELETE FROM public.event_email_sends;
DELETE FROM public.event_volunteers;
DELETE FROM public.judge_assignments;
DELETE FROM public.team_members;
DELETE FROM public.parental_consents;
DELETE FROM public.audit_logs;
DELETE FROM public.csv_imports;
DELETE FROM public.teams;
DELETE FROM public.user_roles WHERE role != 'admin';
UPDATE public.hubs SET coordinator_id = NULL;
DELETE FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.hubs;

-- ============================================
-- PART 2: CREATE 35 HUBS
-- ============================================

INSERT INTO public.hubs (name) VALUES ('AECOM'), ('ALCALA'), ('ALCOBENDAS'), ('ALCORCON'), ('ALDEAFUENTE'), ('AMERICAN TOWER'), ('ARAGON'), ('BABEL'), ('BBVA'), ('BRAINS'), ('BRUNETE'), ('DELL'), ('GALICIA'), ('IIE'), ('IKEA'), ('INDITEX'), ('KYNDRIL'), ('LA NAVE'), ('LAS ROZAS'), ('LOGOS'), ('MAJADAHONDA'), ('MICROSOFT'), ('MOEVE'), ('NTT'), ('ORANGE'), ('P2C'), ('REPSOL'), ('SANTANDER'), ('SECURITAS'), ('SIEMENS'), ('UC3M'), ('USERA'), ('VERISURE'), ('UPM'), ('BAJA');

-- ============================================
-- PART 3: CREATE 118 JUDGES
-- auth.users INSERT triggers profile creation,
-- then UPDATE profiles with actual judge data
-- ============================================

DO $$
DECLARE
  v_hub_ids UUID[];
  v_hub_id UUID;
  v_user_id UUID;
BEGIN
  SELECT ARRAY(SELECT id FROM public.hubs ORDER BY name) INTO v_hub_ids;

  -- Judge 1: Anabel Mediavilla
  v_user_id := '11111111-2222-3333-4444-000000000001'::uuid;
  v_hub_id := v_hub_ids[2];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez2@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Anabel', last_name = 'Mediavilla', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Tres Cantos', state = 'Madrid, Comunidad de', company_name = 'Sra.', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '637535209', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '6427', NOW(), NOW());

  -- Judge 2: PATRICIA HEREDIA
  v_user_id := '11111111-2222-3333-4444-000000000002'::uuid;
  v_hub_id := v_hub_ids[3];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez5@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'PATRICIA', last_name = 'HEREDIA', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Huesca', state = 'Aragón', company_name = 'MINIVINCI', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '5812', NOW(), NOW());

  -- Judge 3: Vanesa Cabral Freije
  v_user_id := '11111111-2222-3333-4444-000000000003'::uuid;
  v_hub_id := v_hub_ids[4];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez7@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Vanesa', last_name = 'Cabral Freije', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Villanueva del Pardillo', state = 'Community of Madrid', company_name = 'Practia Consulting', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '3400', NOW(), NOW());

  -- Judge 4: María Cristina Meléndez
  v_user_id := '11111111-2222-3333-4444-000000000004'::uuid;
  v_hub_id := v_hub_ids[5];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez9@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'María Cristina', last_name = 'Meléndez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Alcobendas', state = 'Madrid, Comunidad de', company_name = 'Colegio de Fomento Aldeafuente', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '4611', NOW(), NOW());

  -- Judge 5: Marta Llopis
  v_user_id := '11111111-2222-3333-4444-000000000005'::uuid;
  v_hub_id := v_hub_ids[6];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez10@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Marta', last_name = 'Llopis', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'School: ICAI. Company: Norte Ventures', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '6937', NOW(), NOW());

  -- Judge 6: Francisco Gomez Molinero
  v_user_id := '11111111-2222-3333-4444-000000000006'::uuid;
  v_hub_id := v_hub_ids[7];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez11@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Francisco', last_name = 'Gomez Molinero', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Las Rozas', state = 'Madrid, Comunidad de', company_name = 'Indepedent Consultant', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34609141749', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '4545', NOW(), NOW());

  -- Judge 7: Ana Alpera
  v_user_id := '11111111-2222-3333-4444-000000000007'::uuid;
  v_hub_id := v_hub_ids[8];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez12@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ana', last_name = 'Alpera', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Comunidad de Madrid', company_name = 'Amazon', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '5200', NOW(), NOW());

  -- Judge 8: Daura Carballo
  v_user_id := '11111111-2222-3333-4444-000000000008'::uuid;
  v_hub_id := v_hub_ids[9];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez14@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Daura', last_name = 'Carballo', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Comunidad de Madrid', company_name = 'Comunidad de Madrid', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '686156621', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '6788', NOW(), NOW());

  -- Judge 9: José Ponce
  v_user_id := '11111111-2222-3333-4444-000000000009'::uuid;
  v_hub_id := v_hub_ids[10];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez17@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'José', last_name = 'Ponce', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Independent consultant', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '6238', NOW(), NOW());

  -- Judge 10: Rocío Velasco Olalla
  v_user_id := '11111111-2222-3333-4444-000000000010'::uuid;
  v_hub_id := v_hub_ids[11];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez20@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Rocío', last_name = 'Velasco Olalla', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Community of Madrid', company_name = 'Los Tilos', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '6352', NOW(), NOW());

  -- Judge 11: Natalia SERRANO OLABARRIA
  v_user_id := '11111111-2222-3333-4444-000000000011'::uuid;
  v_hub_id := v_hub_ids[12];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez21@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Natalia', last_name = 'SERRANO OLABARRIA', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Móstoles', state = 'Madrid, Comunidad de', company_name = 'Ahlstrom', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '6815', NOW(), NOW());

  -- Judge 12: Marta Hernández
  v_user_id := '11111111-2222-3333-4444-000000000012'::uuid;
  v_hub_id := v_hub_ids[13];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez22@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Marta', last_name = 'Hernández', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Community of Madrid', company_name = 'CAF Signalling', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '7028', NOW(), NOW());

  -- Judge 13: Maria del Carmen Vasquez Lamazares
  v_user_id := '11111111-2222-3333-4444-000000000013'::uuid;
  v_hub_id := v_hub_ids[14];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez23@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Maria del Carmen', last_name = 'Vasquez Lamazares', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Microsoft', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '7114', NOW(), NOW());

  -- Judge 14: Blanca Grilló
  v_user_id := '11111111-2222-3333-4444-000000000014'::uuid;
  v_hub_id := v_hub_ids[15];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez24@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Blanca', last_name = 'Grilló', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Zaragoza', state = 'Aragón', company_name = 'BSH', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '7791', NOW(), NOW());

  -- Judge 15: Elias Badenes Alés
  v_user_id := '11111111-2222-3333-4444-000000000015'::uuid;
  v_hub_id := v_hub_ids[16];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez25@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Elias', last_name = 'Badenes Alés', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Jot Internet Media', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '8993', NOW(), NOW());

  -- Judge 16: Víctor Manuel Gómez
  v_user_id := '11111111-2222-3333-4444-000000000016'::uuid;
  v_hub_id := v_hub_ids[17];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez27@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Víctor Manuel', last_name = 'Gómez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Repsol, S.A.', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '12398', NOW(), NOW());

  -- Judge 17: Belen Carrion
  v_user_id := '11111111-2222-3333-4444-000000000017'::uuid;
  v_hub_id := v_hub_ids[18];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez29@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Belen', last_name = 'Carrion', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Neo9', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '19363', NOW(), NOW());

  -- Judge 18: Nera Gonzalez
  v_user_id := '11111111-2222-3333-4444-000000000018'::uuid;
  v_hub_id := v_hub_ids[19];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez36@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Nera', last_name = 'Gonzalez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Prosegur', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '630587714', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '13882', NOW(), NOW());

  -- Judge 19: Marta Moraza
  v_user_id := '11111111-2222-3333-4444-000000000019'::uuid;
  v_hub_id := v_hub_ids[20];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez38@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Marta', last_name = 'Moraza', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Vitoria-Gasteiz', state = 'País Vasco / Euskal Herria', company_name = 'European Patent Office', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '13546', NOW(), NOW());

  -- Judge 20: Yolanda Becerro Navarrete
  v_user_id := '11111111-2222-3333-4444-000000000020'::uuid;
  v_hub_id := v_hub_ids[21];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez39@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Yolanda', last_name = 'Becerro Navarrete', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Kyndryl', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '22421', NOW(), NOW());

  -- Judge 21: Cristina Rivas
  v_user_id := '11111111-2222-3333-4444-000000000021'::uuid;
  v_hub_id := v_hub_ids[22];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez40@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Cristina', last_name = 'Rivas', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Galicia', state = 'Galicia', company_name = 'Huawei', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '14961', NOW(), NOW());

  -- Judge 22: Eva Fernandez
  v_user_id := '11111111-2222-3333-4444-000000000022'::uuid;
  v_hub_id := v_hub_ids[23];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez41@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Eva', last_name = 'Fernandez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Prosegur', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '18807', NOW(), NOW());

  -- Judge 23: Carolina García-Martos
  v_user_id := '11111111-2222-3333-4444-000000000023'::uuid;
  v_hub_id := v_hub_ids[24];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez47@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Carolina', last_name = 'García-Martos', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Universidad Politécnica de Madrid (UPM)', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '17566', NOW(), NOW());

  -- Judge 24: Alba Hernández
  v_user_id := '11111111-2222-3333-4444-000000000024'::uuid;
  v_hub_id := v_hub_ids[25];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez48@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Alba', last_name = 'Hernández', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Accenture', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '20304', NOW(), NOW());

  -- Judge 25: montserrat gerbi cuesta
  v_user_id := '11111111-2222-3333-4444-000000000025'::uuid;
  v_hub_id := v_hub_ids[26];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez51@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'montserrat', last_name = 'gerbi cuesta', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'BBVA', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27706', NOW(), NOW());

  -- Judge 26: Ana Gómez
  v_user_id := '11111111-2222-3333-4444-000000000026'::uuid;
  v_hub_id := v_hub_ids[27];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez52@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ana', last_name = 'Gómez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'BBVA', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '21747', NOW(), NOW());

  -- Judge 27: Maria Garcia de la Peña
  v_user_id := '11111111-2222-3333-4444-000000000027'::uuid;
  v_hub_id := v_hub_ids[28];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez53@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Maria', last_name = 'Garcia de la Peña', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Securitas Direct', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '22400', NOW(), NOW());

  -- Judge 28: Luis Amérigo López
  v_user_id := '11111111-2222-3333-4444-000000000028'::uuid;
  v_hub_id := v_hub_ids[29];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez54@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Luis', last_name = 'Amérigo López', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Las Rozas de Madrid', state = 'Community of Madrid', company_name = 'Telemadrid', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28110', NOW(), NOW());

  -- Judge 29: Guillermo Rey Paniagua
  v_user_id := '11111111-2222-3333-4444-000000000029'::uuid;
  v_hub_id := v_hub_ids[30];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez55@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Guillermo', last_name = 'Rey Paniagua', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Getafe', state = 'Madrid, Comunidad de', company_name = 'Universidad Carlos III de Madrid', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '19310', NOW(), NOW());

  -- Judge 30: Carmen Lopez Herranz
  v_user_id := '11111111-2222-3333-4444-000000000030'::uuid;
  v_hub_id := v_hub_ids[31];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez57@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Carmen', last_name = 'Lopez Herranz', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'BBVA', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26089', NOW(), NOW());

  -- Judge 31: Luis Pardo
  v_user_id := '11111111-2222-3333-4444-000000000031'::uuid;
  v_hub_id := v_hub_ids[32];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez58@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Luis', last_name = 'Pardo', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Tres Cantos', state = 'Madrid, Comunidad de', company_name = 'CEIP ANTONIO OSUNA', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26041', NOW(), NOW());

  -- Judge 32: Nera Gonzalez Romero
  v_user_id := '11111111-2222-3333-4444-000000000032'::uuid;
  v_hub_id := v_hub_ids[33];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez61@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Nera', last_name = 'Gonzalez Romero', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Prosegur', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '18139', NOW(), NOW());

  -- Judge 33: Sydonne Leonor Swaby Martinez
  v_user_id := '11111111-2222-3333-4444-000000000033'::uuid;
  v_hub_id := v_hub_ids[34];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez62@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Sydonne Leonor', last_name = 'Swaby Martinez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'UC3M', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '698868810', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '18241', NOW(), NOW());

  -- Judge 34: Belén Hermosilla
  v_user_id := '11111111-2222-3333-4444-000000000034'::uuid;
  v_hub_id := v_hub_ids[35];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez63@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Belén', last_name = 'Hermosilla', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Eurovision Services', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '18534', NOW(), NOW());

  -- Judge 35: Iomar Ruiz Verrire
  v_user_id := '11111111-2222-3333-4444-000000000035'::uuid;
  v_hub_id := v_hub_ids[1];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez64@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Iomar', last_name = 'Ruiz Verrire', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Andersen', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '18793', NOW(), NOW());

  -- Judge 36: Maria Jose Vergara
  v_user_id := '11111111-2222-3333-4444-000000000036'::uuid;
  v_hub_id := v_hub_ids[2];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez65@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Maria Jose', last_name = 'Vergara', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Las Rozas de Madrid', state = 'Madrid, Comunidad de', company_name = 'Accenture', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '18817', NOW(), NOW());

  -- Judge 37: Carolina Cano Fontán
  v_user_id := '11111111-2222-3333-4444-000000000037'::uuid;
  v_hub_id := v_hub_ids[3];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez66@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Carolina', last_name = 'Cano Fontán', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'El Álamo', state = 'Madrid, Comunidad de', company_name = 'Idealista', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '627025647', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '19035', NOW(), NOW());

  -- Judge 38: Raquel Martínez Jimenez
  v_user_id := '11111111-2222-3333-4444-000000000038'::uuid;
  v_hub_id := v_hub_ids[4];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez68@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Raquel', last_name = 'Martínez Jimenez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Bbva', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '19059', NOW(), NOW());

  -- Judge 39: Ana San Juan Andollo
  v_user_id := '11111111-2222-3333-4444-000000000039'::uuid;
  v_hub_id := v_hub_ids[5];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez69@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ana', last_name = 'San Juan Andollo', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Santander', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '19225', NOW(), NOW());

  -- Judge 40: Amaya Alberdi Garriga
  v_user_id := '11111111-2222-3333-4444-000000000040'::uuid;
  v_hub_id := v_hub_ids[6];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez70@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Amaya', last_name = 'Alberdi Garriga', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Santander España', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '19233', NOW(), NOW());

  -- Judge 41: Alex Velázquez
  v_user_id := '11111111-2222-3333-4444-000000000041'::uuid;
  v_hub_id := v_hub_ids[7];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez72@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Alex', last_name = 'Velázquez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Algeciras', state = 'Andalucía', company_name = 'Ebotics Education', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '19472', NOW(), NOW());

  -- Judge 42: Cristina García-Miró
  v_user_id := '11111111-2222-3333-4444-000000000042'::uuid;
  v_hub_id := v_hub_ids[8];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez77@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Cristina', last_name = 'García-Miró', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Quijorna', state = 'Madrid, Comunidad de', company_name = 'Participación a título personal', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '20241', NOW(), NOW());

  -- Judge 43: Alexandra de Santos Colmenares
  v_user_id := '11111111-2222-3333-4444-000000000043'::uuid;
  v_hub_id := v_hub_ids[9];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez78@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Alexandra', last_name = 'de Santos Colmenares', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Repsol', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '24278', NOW(), NOW());

  -- Judge 44: Marta Balbás
  v_user_id := '11111111-2222-3333-4444-000000000044'::uuid;
  v_hub_id := v_hub_ids[10];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez79@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Marta', last_name = 'Balbás', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Repsol SA', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '25856', NOW(), NOW());

  -- Judge 45: Andrea Guisasola
  v_user_id := '11111111-2222-3333-4444-000000000045'::uuid;
  v_hub_id := v_hub_ids[11];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez82@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Andrea', last_name = 'Guisasola', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Airbus Defence & Space', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '21912', NOW(), NOW());

  -- Judge 46: José Luis Usero Vílchez
  v_user_id := '11111111-2222-3333-4444-000000000046'::uuid;
  v_hub_id := v_hub_ids[12];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez83@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'José Luis', last_name = 'Usero Vílchez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Estepona', state = 'Andalucía', company_name = 'IES MONTERROSO', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34620156772', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28074', NOW(), NOW());

  -- Judge 47: Zachary Taylor Menendez
  v_user_id := '11111111-2222-3333-4444-000000000047'::uuid;
  v_hub_id := v_hub_ids[13];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez84@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Zachary', last_name = 'Taylor Menendez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Boadilla del Monte', state = 'Madrid, Comunidad de', company_name = 'Securitas Direct', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '21431', NOW(), NOW());

  -- Judge 48: CRISTINA PAULOS NOVOA
  v_user_id := '11111111-2222-3333-4444-000000000048'::uuid;
  v_hub_id := v_hub_ids[14];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez85@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'CRISTINA', last_name = 'PAULOS NOVOA', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Pontevedra', state = NULL, company_name = 'CEIP O Piñeiriño', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '22772', NOW(), NOW());

  -- Judge 49: Maite López Barreiro
  v_user_id := '11111111-2222-3333-4444-000000000049'::uuid;
  v_hub_id := v_hub_ids[15];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez86@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Maite', last_name = 'López Barreiro', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Las Rozas de Madrid', state = 'Madrid, Comunidad de', company_name = 'Colegio Logos International School', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '22710', NOW(), NOW());

  -- Judge 50: Sergio Raúl Montes León
  v_user_id := '11111111-2222-3333-4444-000000000050'::uuid;
  v_hub_id := v_hub_ids[16];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez88@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Sergio Raúl', last_name = 'Montes León', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Universidad Rey Juan Carlos', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '22379', NOW(), NOW());

  -- Judge 51: Daniel Prado Garcia
  v_user_id := '11111111-2222-3333-4444-000000000051'::uuid;
  v_hub_id := v_hub_ids[17];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez89@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Daniel', last_name = 'Prado Garcia', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'A Coruña', state = NULL, company_name = 'INDITEX', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27231', NOW(), NOW());

  -- Judge 52: ANA BELEN GARBIN DURAN
  v_user_id := '11111111-2222-3333-4444-000000000052'::uuid;
  v_hub_id := v_hub_ids[18];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez91@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'ANA BELEN', last_name = 'GARBIN DURAN', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'A Coruña', state = NULL, company_name = 'INDITEX', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '24277', NOW(), NOW());

  -- Judge 53: Lucia Delgado
  v_user_id := '11111111-2222-3333-4444-000000000053'::uuid;
  v_hub_id := v_hub_ids[19];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez92@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Lucia', last_name = 'Delgado', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Pozuelo de Alarcón', state = 'Madrid, Comunidad de', company_name = 'Verisure', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '21112', NOW(), NOW());

  -- Judge 54: Nuria Caballero Pascual
  v_user_id := '11111111-2222-3333-4444-000000000054'::uuid;
  v_hub_id := v_hub_ids[20];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez93@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Nuria', last_name = 'Caballero Pascual', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Collado Mediano', state = 'Madrid, Comunidad de', company_name = 'Capitole Consulting', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '21673', NOW(), NOW());

  -- Judge 55: Ximena de Diego López
  v_user_id := '11111111-2222-3333-4444-000000000055'::uuid;
  v_hub_id := v_hub_ids[21];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez94@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ximena', last_name = 'de Diego López', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Rivas-Vaciamadrid', state = 'Madrid, Comunidad de', company_name = 'Airbus', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+35635477872', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '21954', NOW(), NOW());

  -- Judge 56: Joao Goncalves
  v_user_id := '11111111-2222-3333-4444-000000000056'::uuid;
  v_hub_id := v_hub_ids[22];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez95@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Joao', last_name = 'Goncalves', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Kyndryl', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34636627504', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '22366', NOW(), NOW());

  -- Judge 57: ANA MARTIN TOMERO
  v_user_id := '11111111-2222-3333-4444-000000000057'::uuid;
  v_hub_id := v_hub_ids[23];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez96@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'ANA', last_name = 'MARTIN TOMERO', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Ferrovial Spain Ferrovial Corporación', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '22380', NOW(), NOW());

  -- Judge 58: ANA BELEN GALAN
  v_user_id := '11111111-2222-3333-4444-000000000058'::uuid;
  v_hub_id := v_hub_ids[24];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez97@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'ANA BELEN', last_name = 'GALAN', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'BBVA', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '22557', NOW(), NOW());

  -- Judge 59: jose antonio TOLEDO ARELLANO
  v_user_id := '11111111-2222-3333-4444-000000000059'::uuid;
  v_hub_id := v_hub_ids[25];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez99@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'jose antonio', last_name = 'TOLEDO ARELLANO', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'MUFG BANK EUROPE NV SPAIN BRANCH', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '686009973', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28356', NOW(), NOW());

  -- Judge 60: Eva Carrasco Gonzalez
  v_user_id := '11111111-2222-3333-4444-000000000060'::uuid;
  v_hub_id := v_hub_ids[26];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez100@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Eva', last_name = 'Carrasco Gonzalez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Capgemini', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '616127549', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '18213', NOW(), NOW());

  -- Judge 61: Maria J Godoy
  v_user_id := '11111111-2222-3333-4444-000000000061'::uuid;
  v_hub_id := v_hub_ids[27];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez101@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Maria J', last_name = 'Godoy', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Tres Cantos', state = 'Madrid, Comunidad de', company_name = 'Allfunds', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28322', NOW(), NOW());

  -- Judge 62: Pilar Larrosa
  v_user_id := '11111111-2222-3333-4444-000000000062'::uuid;
  v_hub_id := v_hub_ids[28];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez102@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Pilar', last_name = 'Larrosa', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Sabiñánigo', state = 'Aragón', company_name = 'IES San Alberto Magno', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '676938752', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28312', NOW(), NOW());

  -- Judge 63: Roberto Seco
  v_user_id := '11111111-2222-3333-4444-000000000063'::uuid;
  v_hub_id := v_hub_ids[29];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez103@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Roberto', last_name = 'Seco', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Alcala de Henares', state = 'Madrid, Comunidad de', company_name = 'Universidad de Alcalá', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '640721423', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27465', NOW(), NOW());

  -- Judge 64: Cristina Costas
  v_user_id := '11111111-2222-3333-4444-000000000064'::uuid;
  v_hub_id := v_hub_ids[30];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez104@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Cristina', last_name = 'Costas', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Deloitte', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '691899564', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26803', NOW(), NOW());

  -- Judge 65: David Cortés Navarro
  v_user_id := '11111111-2222-3333-4444-000000000065'::uuid;
  v_hub_id := v_hub_ids[31];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez105@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'David', last_name = 'Cortés Navarro', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Instituto Madrileño de Investigación y Desarrollo Rural, Agrario y Alimentario (IMIDRA)', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '617648977', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28308', NOW(), NOW());

  -- Judge 66: Marjorie Rodriguez
  v_user_id := '11111111-2222-3333-4444-000000000066'::uuid;
  v_hub_id := v_hub_ids[32];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez106@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Marjorie', last_name = 'Rodriguez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Las Palmas de Gran Canaria', state = 'Canarias', company_name = 'McGraw Hill International', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '691563383', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28359', NOW(), NOW());

  -- Judge 67: Rubén Luque Pardos
  v_user_id := '11111111-2222-3333-4444-000000000067'::uuid;
  v_hub_id := v_hub_ids[33];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez107@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Rubén', last_name = 'Luque Pardos', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Santander', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '685919186', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27404', NOW(), NOW());

  -- Judge 68: Ramon Pajaro
  v_user_id := '11111111-2222-3333-4444-000000000068'::uuid;
  v_hub_id := v_hub_ids[34];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez108@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ramon', last_name = 'Pajaro', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Santander', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '678286130', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27029', NOW(), NOW());

  -- Judge 69: Beatriz Lopez del Moral Garcia Jimenez
  v_user_id := '11111111-2222-3333-4444-000000000069'::uuid;
  v_hub_id := v_hub_ids[35];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez109@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Beatriz', last_name = 'Lopez del Moral Garcia Jimenez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Donostia-San Sebastian', state = 'País Vasco / Euskal Herria', company_name = 'Prodware', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28319', NOW(), NOW());

  -- Judge 70: Jaime Alejandro Contreras Castellanos
  v_user_id := '11111111-2222-3333-4444-000000000070'::uuid;
  v_hub_id := v_hub_ids[1];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez110@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Jaime Alejandro', last_name = 'Contreras Castellanos', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Meco', state = 'Madrid, Comunidad de', company_name = 'SANTANDER', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '697978797', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26599', NOW(), NOW());

  -- Judge 71: Ana Labory Pesquer
  v_user_id := '11111111-2222-3333-4444-000000000071'::uuid;
  v_hub_id := v_hub_ids[2];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez113@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ana', last_name = 'Labory Pesquer', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Los Tilos', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '618058103', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28300', NOW(), NOW());

  -- Judge 72: Gabriela Imbert
  v_user_id := '11111111-2222-3333-4444-000000000072'::uuid;
  v_hub_id := v_hub_ids[3];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez115@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Gabriela', last_name = 'Imbert', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'A Coruña', state = NULL, company_name = 'INDITEX', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '23287', NOW(), NOW());

  -- Judge 73: Gabriela Ibarra
  v_user_id := '11111111-2222-3333-4444-000000000073'::uuid;
  v_hub_id := v_hub_ids[4];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez116@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Gabriela', last_name = 'Ibarra', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'N/A', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26748', NOW(), NOW());

  -- Judge 74: Jaime Lopez
  v_user_id := '11111111-2222-3333-4444-000000000074'::uuid;
  v_hub_id := v_hub_ids[5];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez118@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Jaime', last_name = 'Lopez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Ernst & Young', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '25061', NOW(), NOW());

  -- Judge 75: Estefanía Martínez Giménez
  v_user_id := '11111111-2222-3333-4444-000000000075'::uuid;
  v_hub_id := v_hub_ids[6];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez119@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Estefanía', last_name = 'Martínez Giménez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Gft consulting', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '639032755', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '25249', NOW(), NOW());

  -- Judge 76: Juan Rios Garcia
  v_user_id := '11111111-2222-3333-4444-000000000076'::uuid;
  v_hub_id := v_hub_ids[7];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez120@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Juan', last_name = 'Rios Garcia', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Verisure', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '25283', NOW(), NOW());

  -- Judge 77: Teresa Guedes Coelho
  v_user_id := '11111111-2222-3333-4444-000000000077'::uuid;
  v_hub_id := v_hub_ids[8];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez122@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Teresa', last_name = 'Guedes Coelho', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Accumin', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '667589397', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '25443', NOW(), NOW());

  -- Judge 78: Sonia Vega
  v_user_id := '11111111-2222-3333-4444-000000000078'::uuid;
  v_hub_id := v_hub_ids[9];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez123@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Sonia', last_name = 'Vega', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Valladolid', state = 'Castilla y León', company_name = 'Altia Consultores', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '671480948', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '25512', NOW(), NOW());

  -- Judge 79: Maria Carracedo
  v_user_id := '11111111-2222-3333-4444-000000000079'::uuid;
  v_hub_id := v_hub_ids[10];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez126@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Maria', last_name = 'Carracedo', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Moeve', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '686012015', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '25686', NOW(), NOW());

  -- Judge 80: Juan Carlos Corral Rodríguez
  v_user_id := '11111111-2222-3333-4444-000000000080'::uuid;
  v_hub_id := v_hub_ids[11];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez129@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Juan Carlos', last_name = 'Corral Rodríguez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Mapfre', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34619423052', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '25829', NOW(), NOW());

  -- Judge 81: Pablo Collado
  v_user_id := '11111111-2222-3333-4444-000000000081'::uuid;
  v_hub_id := v_hub_ids[12];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez131@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Pablo', last_name = 'Collado', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Iberdrola', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '34628707198', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26066', NOW(), NOW());

  -- Judge 82: Rodrigo Perez Fernandez
  v_user_id := '11111111-2222-3333-4444-000000000082'::uuid;
  v_hub_id := v_hub_ids[13];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez132@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Rodrigo', last_name = 'Perez Fernandez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Siemens', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '666423062', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26067', NOW(), NOW());

  -- Judge 83: Illari Alvarez-Gil
  v_user_id := '11111111-2222-3333-4444-000000000083'::uuid;
  v_hub_id := v_hub_ids[14];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez133@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Illari', last_name = 'Alvarez-Gil', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Zaragoza', state = 'Aragón', company_name = 'The Big Tech Experience', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34607234611', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26087', NOW(), NOW());

  -- Judge 84: Susana Millán
  v_user_id := '11111111-2222-3333-4444-000000000084'::uuid;
  v_hub_id := v_hub_ids[15];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez135@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Susana', last_name = 'Millán', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Fuenlabrada', state = 'Madrid, Comunidad de', company_name = 'WSP Spain', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26118', NOW(), NOW());

  -- Judge 85: Rut Palmero
  v_user_id := '11111111-2222-3333-4444-000000000085'::uuid;
  v_hub_id := v_hub_ids[16];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez136@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Rut', last_name = 'Palmero', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Valladolid', state = 'Castilla y León', company_name = 'UNIR', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26140', NOW(), NOW());

  -- Judge 86: Carmen Reina
  v_user_id := '11111111-2222-3333-4444-000000000086'::uuid;
  v_hub_id := v_hub_ids[17];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez138@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Carmen', last_name = 'Reina', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'DataQuantum', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '656902070', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26259', NOW(), NOW());

  -- Judge 87: Stephanie De faria
  v_user_id := '11111111-2222-3333-4444-000000000087'::uuid;
  v_hub_id := v_hub_ids[18];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez140@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Stephanie', last_name = 'De faria', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Generix group', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '645163265', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26298', NOW(), NOW());

  -- Judge 88: Heloisa Sorato
  v_user_id := '11111111-2222-3333-4444-000000000088'::uuid;
  v_hub_id := v_hub_ids[19];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez142@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Heloisa', last_name = 'Sorato', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Microsoft', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34686376579', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26342', NOW(), NOW());

  -- Judge 89: Livia GUZMAN
  v_user_id := '11111111-2222-3333-4444-000000000089'::uuid;
  v_hub_id := v_hub_ids[20];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez143@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Livia', last_name = 'GUZMAN', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Santander', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '667257857', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26428', NOW(), NOW());

  -- Judge 90: Cristina Jiménez
  v_user_id := '11111111-2222-3333-4444-000000000090'::uuid;
  v_hub_id := v_hub_ids[21];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez144@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Cristina', last_name = 'Jiménez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Ineco', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '680112204', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26449', NOW(), NOW());

  -- Judge 91: Patricia Acosta Soler
  v_user_id := '11111111-2222-3333-4444-000000000091'::uuid;
  v_hub_id := v_hub_ids[22];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez145@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Patricia', last_name = 'Acosta Soler', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'MasOrange', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '656162599', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26467', NOW(), NOW());

  -- Judge 92: Alicia Alcaide
  v_user_id := '11111111-2222-3333-4444-000000000092'::uuid;
  v_hub_id := v_hub_ids[23];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez146@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Alicia', last_name = 'Alcaide', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'San Sebastián de los Reyes', state = 'Madrid, Comunidad de', company_name = 'IKEA', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26525', NOW(), NOW());

  -- Judge 93: Noelia Díaz
  v_user_id := '11111111-2222-3333-4444-000000000093'::uuid;
  v_hub_id := v_hub_ids[24];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez147@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Noelia', last_name = 'Díaz', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Siemens', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26531', NOW(), NOW());

  -- Judge 94: Beatriz Hierro Alonso
  v_user_id := '11111111-2222-3333-4444-000000000094'::uuid;
  v_hub_id := v_hub_ids[25];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez148@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Beatriz', last_name = 'Hierro Alonso', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Eraneos', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '676200992', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26566', NOW(), NOW());

  -- Judge 95: Silvia Meléndez González
  v_user_id := '11111111-2222-3333-4444-000000000095'::uuid;
  v_hub_id := v_hub_ids[26];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez149@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Silvia', last_name = 'Meléndez González', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Inspiralia', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '635247273', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26620', NOW(), NOW());

  -- Judge 96: Claudia Suárez Garcia
  v_user_id := '11111111-2222-3333-4444-000000000096'::uuid;
  v_hub_id := v_hub_ids[27];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez150@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Claudia', last_name = 'Suárez Garcia', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Citibox', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '628546322', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26689', NOW(), NOW());

  -- Judge 97: Eduardo Oliva
  v_user_id := '11111111-2222-3333-4444-000000000097'::uuid;
  v_hub_id := v_hub_ids[28];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez151@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Eduardo', last_name = 'Oliva', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Universidad Politécnica de Madrid', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34 636802119', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26754', NOW(), NOW());

  -- Judge 98: Marta Mallavibarrena
  v_user_id := '11111111-2222-3333-4444-000000000098'::uuid;
  v_hub_id := v_hub_ids[29];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez152@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Marta', last_name = 'Mallavibarrena', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Alcala de Henares', state = 'Madrid, Comunidad de', company_name = 'Thales S21Sec', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '26791', NOW(), NOW());

  -- Judge 99: Sheila Ibañez Fontarosa
  v_user_id := '11111111-2222-3333-4444-000000000099'::uuid;
  v_hub_id := v_hub_ids[30];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez154@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Sheila', last_name = 'Ibañez Fontarosa', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Villaviciosa de Odón', state = 'Madrid, Comunidad de', company_name = 'Telefonica', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '610515158', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27106', NOW(), NOW());

  -- Judge 100: Ruth Carrasco Gallego
  v_user_id := '11111111-2222-3333-4444-000000000100'::uuid;
  v_hub_id := v_hub_ids[31];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez155@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ruth', last_name = 'Carrasco Gallego', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Universidad politécnica de Madrid', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27139', NOW(), NOW());

  -- Judge 101: Steffany Castillo
  v_user_id := '11111111-2222-3333-4444-000000000101'::uuid;
  v_hub_id := v_hub_ids[32];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez156@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Steffany', last_name = 'Castillo', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Inetum', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34600051912', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27173', NOW(), NOW());

  -- Judge 102: Elena Lopez de Arana
  v_user_id := '11111111-2222-3333-4444-000000000102'::uuid;
  v_hub_id := v_hub_ids[33];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez157@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Elena', last_name = 'Lopez de Arana', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Universidad Autónoma de Madrid', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '688635437', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27230', NOW(), NOW());

  -- Judge 103: Beatriz Martínez Aranda
  v_user_id := '11111111-2222-3333-4444-000000000103'::uuid;
  v_hub_id := v_hub_ids[34];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez159@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Beatriz', last_name = 'Martínez Aranda', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Cigna', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '645048225', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27281', NOW(), NOW());

  -- Judge 104: Tamara Martinez
  v_user_id := '11111111-2222-3333-4444-000000000104'::uuid;
  v_hub_id := v_hub_ids[35];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez163@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Tamara', last_name = 'Martinez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Sylentis', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '27701', NOW(), NOW());

  -- Judge 105: Carlos Pazos
  v_user_id := '11111111-2222-3333-4444-000000000105'::uuid;
  v_hub_id := v_hub_ids[1];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez164@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Carlos', last_name = 'Pazos', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Siemens', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34 680 60 52 62', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28396', NOW(), NOW());

  -- Judge 106: enrique silva bravo
  v_user_id := '11111111-2222-3333-4444-000000000106'::uuid;
  v_hub_id := v_hub_ids[2];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez165@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'enrique', last_name = 'silva bravo', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Majadahonda', state = 'Madrid, Comunidad de', company_name = 'Silva y Leon Consultoria', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34609001821', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28548', NOW(), NOW());

  -- Judge 107: José Ignacio Luna Diez
  v_user_id := '11111111-2222-3333-4444-000000000107'::uuid;
  v_hub_id := v_hub_ids[3];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez166@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'José Ignacio', last_name = 'Luna Diez', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Pull&Bear', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '690110324', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28485', NOW(), NOW());

  -- Judge 108: Giuliana Lazar
  v_user_id := '11111111-2222-3333-4444-000000000108'::uuid;
  v_hub_id := v_hub_ids[4];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez167@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Giuliana', last_name = 'Lazar', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Vícar', state = 'Andalucía', company_name = 'Giuliana Lazar (Volunteer)', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '34642927142', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28439', NOW(), NOW());

  -- Judge 109: Juan Manuel Garcia Amayas
  v_user_id := '11111111-2222-3333-4444-000000000109'::uuid;
  v_hub_id := v_hub_ids[5];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez169@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Juan Manuel', last_name = 'Garcia Amayas', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Aecom', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '653868662', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28586', NOW(), NOW());

  -- Judge 110: Raquel Seal
  v_user_id := '11111111-2222-3333-4444-000000000110'::uuid;
  v_hub_id := v_hub_ids[6];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez170@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Raquel', last_name = 'Seal', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Las Rozas de Madrid', state = 'Madrid, Comunidad de', company_name = 'POPEX partners', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '609453024', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28613', NOW(), NOW());

  -- Judge 111: Ana Muñiz Escribano
  v_user_id := '11111111-2222-3333-4444-000000000111'::uuid;
  v_hub_id := v_hub_ids[7];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez171@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ana', last_name = 'Muñiz Escribano', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'ICAI', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '+34722845863', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28642', NOW(), NOW());

  -- Judge 112: Eloisa Sendra Romero
  v_user_id := '11111111-2222-3333-4444-000000000112'::uuid;
  v_hub_id := v_hub_ids[8];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez172@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Eloisa', last_name = 'Sendra Romero', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'IBM', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '651301351', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28671', NOW(), NOW());

  -- Judge 113: Martín Portugal
  v_user_id := '11111111-2222-3333-4444-000000000113'::uuid;
  v_hub_id := v_hub_ids[9];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez173@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Martín', last_name = 'Portugal', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'IBM', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28672', NOW(), NOW());

  -- Judge 114: Ana María Pérez García
  v_user_id := '11111111-2222-3333-4444-000000000114'::uuid;
  v_hub_id := v_hub_ids[10];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez174@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Ana María', last_name = 'Pérez García', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'CGI', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28673', NOW(), NOW());

  -- Judge 115: Carmen García-de-Veas Poblador
  v_user_id := '11111111-2222-3333-4444-000000000115'::uuid;
  v_hub_id := v_hub_ids[11];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez175@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Carmen', last_name = 'García-de-Veas Poblador', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Freelance', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '655443704', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28677', NOW(), NOW());

  -- Judge 116: Sandra Perez Diaz
  v_user_id := '11111111-2222-3333-4444-000000000116'::uuid;
  v_hub_id := v_hub_ids[12];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez176@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Sandra', last_name = 'Perez Diaz', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Huelva', state = 'Andalucía', company_name = 'Moeve', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28689', NOW(), NOW());

  -- Judge 117: Raquel Lanza
  v_user_id := '11111111-2222-3333-4444-000000000117'::uuid;
  v_hub_id := v_hub_ids[13];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez177@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Raquel', last_name = 'Lanza', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'Microsoft', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = '699940365', updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28692', NOW(), NOW());

  -- Judge 118: Vanesa Cabral
  v_user_id := '11111111-2222-3333-4444-000000000118'::uuid;
  v_hub_id := v_hub_ids[14];
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'hola+juez178@nocodehackers.es', crypt('TestJudge2026!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'Vanesa', last_name = 'Cabral', is_judge = true, is_active = true, hub_id = v_hub_id, city = 'Madrid', state = 'Madrid, Comunidad de', company_name = 'xx', profile_type = 'judge', verification_status = 'verified', onboarding_completed = true, phone = NULL, updated_at = NOW() WHERE id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'collaborator') ON CONFLICT DO NOTHING;
  INSERT INTO public.judge_assignments (user_id, event_id, is_active, onboarding_completed, external_judge_id, created_at, updated_at) VALUES (v_user_id, '66562cd4-b72e-48e8-8df7-f5aab09df4b5', true, true, '28693', NOW(), NOW());

  RAISE NOTICE 'Created 118 judges';
END $$;

-- ============================================
-- PART 4: CREATE 120 TEAMS
-- ============================================

DO $$
DECLARE
  v_hub_ids UUID[];
  v_hub_id UUID;
  v_team_id UUID;
BEGIN
  SELECT ARRAY(SELECT id FROM public.hubs ORDER BY name) INTO v_hub_ids;

  v_team_id := '55555555-6666-7777-8888-000000000001'::uuid;
  v_hub_id := v_hub_ids[2];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Tech Estrellas', 'DEMO-0001', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000002'::uuid;
  v_hub_id := v_hub_ids[3];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cyber Estrellas', 'DEMO-0002', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000003'::uuid;
  v_hub_id := v_hub_ids[4];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Digital Estrellas', 'DEMO-0003', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000004'::uuid;
  v_hub_id := v_hub_ids[5];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Code Estrellas', 'DEMO-0004', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000005'::uuid;
  v_hub_id := v_hub_ids[6];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'App Estrellas', 'DEMO-0005', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000006'::uuid;
  v_hub_id := v_hub_ids[7];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Data Estrellas', 'DEMO-0006', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000007'::uuid;
  v_hub_id := v_hub_ids[8];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Smart Estrellas', 'DEMO-0007', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000008'::uuid;
  v_hub_id := v_hub_ids[9];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Eco Estrellas', 'DEMO-0008', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000009'::uuid;
  v_hub_id := v_hub_ids[10];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Quantum Estrellas', 'DEMO-0009', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000010'::uuid;
  v_hub_id := v_hub_ids[11];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Pixel Estrellas', 'DEMO-0010', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000011'::uuid;
  v_hub_id := v_hub_ids[12];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nano Estrellas', 'DEMO-0011', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000012'::uuid;
  v_hub_id := v_hub_ids[13];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Bio Estrellas', 'DEMO-0012', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000013'::uuid;
  v_hub_id := v_hub_ids[14];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cloud Estrellas', 'DEMO-0013', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000014'::uuid;
  v_hub_id := v_hub_ids[15];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Hack Estrellas', 'DEMO-0014', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000015'::uuid;
  v_hub_id := v_hub_ids[16];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Web Estrellas', 'DEMO-0015', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000016'::uuid;
  v_hub_id := v_hub_ids[17];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Logic Estrellas', 'DEMO-0016', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000017'::uuid;
  v_hub_id := v_hub_ids[18];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Net Estrellas', 'DEMO-0017', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000018'::uuid;
  v_hub_id := v_hub_ids[19];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Algo Estrellas', 'DEMO-0018', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000019'::uuid;
  v_hub_id := v_hub_ids[20];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Byte Estrellas', 'DEMO-0019', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000020'::uuid;
  v_hub_id := v_hub_ids[21];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nova Estrellas', 'DEMO-0020', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000021'::uuid;
  v_hub_id := v_hub_ids[22];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Tech Innovadoras', 'DEMO-0021', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000022'::uuid;
  v_hub_id := v_hub_ids[23];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cyber Innovadoras', 'DEMO-0022', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000023'::uuid;
  v_hub_id := v_hub_ids[24];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Digital Innovadoras', 'DEMO-0023', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000024'::uuid;
  v_hub_id := v_hub_ids[25];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Code Innovadoras', 'DEMO-0024', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000025'::uuid;
  v_hub_id := v_hub_ids[26];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'App Innovadoras', 'DEMO-0025', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000026'::uuid;
  v_hub_id := v_hub_ids[27];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Data Innovadoras', 'DEMO-0026', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000027'::uuid;
  v_hub_id := v_hub_ids[28];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Smart Innovadoras', 'DEMO-0027', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000028'::uuid;
  v_hub_id := v_hub_ids[29];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Eco Innovadoras', 'DEMO-0028', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000029'::uuid;
  v_hub_id := v_hub_ids[30];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Quantum Innovadoras', 'DEMO-0029', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000030'::uuid;
  v_hub_id := v_hub_ids[31];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Pixel Innovadoras', 'DEMO-0030', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000031'::uuid;
  v_hub_id := v_hub_ids[32];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nano Innovadoras', 'DEMO-0031', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000032'::uuid;
  v_hub_id := v_hub_ids[33];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Bio Innovadoras', 'DEMO-0032', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000033'::uuid;
  v_hub_id := v_hub_ids[34];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cloud Innovadoras', 'DEMO-0033', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000034'::uuid;
  v_hub_id := v_hub_ids[35];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Hack Innovadoras', 'DEMO-0034', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000035'::uuid;
  v_hub_id := v_hub_ids[1];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Web Innovadoras', 'DEMO-0035', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000036'::uuid;
  v_hub_id := v_hub_ids[2];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Logic Innovadoras', 'DEMO-0036', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000037'::uuid;
  v_hub_id := v_hub_ids[3];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Net Innovadoras', 'DEMO-0037', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000038'::uuid;
  v_hub_id := v_hub_ids[4];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Algo Innovadoras', 'DEMO-0038', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000039'::uuid;
  v_hub_id := v_hub_ids[5];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Byte Innovadoras', 'DEMO-0039', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000040'::uuid;
  v_hub_id := v_hub_ids[6];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nova Innovadoras', 'DEMO-0040', 'beginner', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000041'::uuid;
  v_hub_id := v_hub_ids[7];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Tech Exploradoras', 'DEMO-0041', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000042'::uuid;
  v_hub_id := v_hub_ids[8];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cyber Exploradoras', 'DEMO-0042', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000043'::uuid;
  v_hub_id := v_hub_ids[9];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Digital Exploradoras', 'DEMO-0043', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000044'::uuid;
  v_hub_id := v_hub_ids[10];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Code Exploradoras', 'DEMO-0044', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000045'::uuid;
  v_hub_id := v_hub_ids[11];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'App Exploradoras', 'DEMO-0045', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000046'::uuid;
  v_hub_id := v_hub_ids[12];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Data Exploradoras', 'DEMO-0046', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000047'::uuid;
  v_hub_id := v_hub_ids[13];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Smart Exploradoras', 'DEMO-0047', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000048'::uuid;
  v_hub_id := v_hub_ids[14];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Eco Exploradoras', 'DEMO-0048', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000049'::uuid;
  v_hub_id := v_hub_ids[15];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Quantum Exploradoras', 'DEMO-0049', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000050'::uuid;
  v_hub_id := v_hub_ids[16];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Pixel Exploradoras', 'DEMO-0050', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000051'::uuid;
  v_hub_id := v_hub_ids[17];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nano Exploradoras', 'DEMO-0051', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000052'::uuid;
  v_hub_id := v_hub_ids[18];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Bio Exploradoras', 'DEMO-0052', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000053'::uuid;
  v_hub_id := v_hub_ids[19];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cloud Exploradoras', 'DEMO-0053', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000054'::uuid;
  v_hub_id := v_hub_ids[20];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Hack Exploradoras', 'DEMO-0054', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000055'::uuid;
  v_hub_id := v_hub_ids[21];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Web Exploradoras', 'DEMO-0055', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000056'::uuid;
  v_hub_id := v_hub_ids[22];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Logic Exploradoras', 'DEMO-0056', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000057'::uuid;
  v_hub_id := v_hub_ids[23];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Net Exploradoras', 'DEMO-0057', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000058'::uuid;
  v_hub_id := v_hub_ids[24];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Algo Exploradoras', 'DEMO-0058', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000059'::uuid;
  v_hub_id := v_hub_ids[25];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Byte Exploradoras', 'DEMO-0059', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000060'::uuid;
  v_hub_id := v_hub_ids[26];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nova Exploradoras', 'DEMO-0060', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000061'::uuid;
  v_hub_id := v_hub_ids[27];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Tech Creadoras', 'DEMO-0061', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000062'::uuid;
  v_hub_id := v_hub_ids[28];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cyber Creadoras', 'DEMO-0062', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000063'::uuid;
  v_hub_id := v_hub_ids[29];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Digital Creadoras', 'DEMO-0063', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000064'::uuid;
  v_hub_id := v_hub_ids[30];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Code Creadoras', 'DEMO-0064', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000065'::uuid;
  v_hub_id := v_hub_ids[31];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'App Creadoras', 'DEMO-0065', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000066'::uuid;
  v_hub_id := v_hub_ids[32];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Data Creadoras', 'DEMO-0066', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000067'::uuid;
  v_hub_id := v_hub_ids[33];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Smart Creadoras', 'DEMO-0067', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000068'::uuid;
  v_hub_id := v_hub_ids[34];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Eco Creadoras', 'DEMO-0068', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000069'::uuid;
  v_hub_id := v_hub_ids[35];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Quantum Creadoras', 'DEMO-0069', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000070'::uuid;
  v_hub_id := v_hub_ids[1];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Pixel Creadoras', 'DEMO-0070', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000071'::uuid;
  v_hub_id := v_hub_ids[2];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nano Creadoras', 'DEMO-0071', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000072'::uuid;
  v_hub_id := v_hub_ids[3];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Bio Creadoras', 'DEMO-0072', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000073'::uuid;
  v_hub_id := v_hub_ids[4];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cloud Creadoras', 'DEMO-0073', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000074'::uuid;
  v_hub_id := v_hub_ids[5];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Hack Creadoras', 'DEMO-0074', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000075'::uuid;
  v_hub_id := v_hub_ids[6];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Web Creadoras', 'DEMO-0075', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000076'::uuid;
  v_hub_id := v_hub_ids[7];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Logic Creadoras', 'DEMO-0076', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000077'::uuid;
  v_hub_id := v_hub_ids[8];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Net Creadoras', 'DEMO-0077', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000078'::uuid;
  v_hub_id := v_hub_ids[9];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Algo Creadoras', 'DEMO-0078', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000079'::uuid;
  v_hub_id := v_hub_ids[10];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Byte Creadoras', 'DEMO-0079', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000080'::uuid;
  v_hub_id := v_hub_ids[11];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nova Creadoras', 'DEMO-0080', 'junior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000081'::uuid;
  v_hub_id := v_hub_ids[12];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Tech Guerreras', 'DEMO-0081', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000082'::uuid;
  v_hub_id := v_hub_ids[13];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cyber Guerreras', 'DEMO-0082', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000083'::uuid;
  v_hub_id := v_hub_ids[14];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Digital Guerreras', 'DEMO-0083', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000084'::uuid;
  v_hub_id := v_hub_ids[15];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Code Guerreras', 'DEMO-0084', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000085'::uuid;
  v_hub_id := v_hub_ids[16];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'App Guerreras', 'DEMO-0085', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000086'::uuid;
  v_hub_id := v_hub_ids[17];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Data Guerreras', 'DEMO-0086', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000087'::uuid;
  v_hub_id := v_hub_ids[18];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Smart Guerreras', 'DEMO-0087', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000088'::uuid;
  v_hub_id := v_hub_ids[19];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Eco Guerreras', 'DEMO-0088', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000089'::uuid;
  v_hub_id := v_hub_ids[20];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Quantum Guerreras', 'DEMO-0089', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000090'::uuid;
  v_hub_id := v_hub_ids[21];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Pixel Guerreras', 'DEMO-0090', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000091'::uuid;
  v_hub_id := v_hub_ids[22];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nano Guerreras', 'DEMO-0091', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000092'::uuid;
  v_hub_id := v_hub_ids[23];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Bio Guerreras', 'DEMO-0092', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000093'::uuid;
  v_hub_id := v_hub_ids[24];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cloud Guerreras', 'DEMO-0093', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000094'::uuid;
  v_hub_id := v_hub_ids[25];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Hack Guerreras', 'DEMO-0094', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000095'::uuid;
  v_hub_id := v_hub_ids[26];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Web Guerreras', 'DEMO-0095', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000096'::uuid;
  v_hub_id := v_hub_ids[27];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Logic Guerreras', 'DEMO-0096', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000097'::uuid;
  v_hub_id := v_hub_ids[28];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Net Guerreras', 'DEMO-0097', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000098'::uuid;
  v_hub_id := v_hub_ids[29];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Algo Guerreras', 'DEMO-0098', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000099'::uuid;
  v_hub_id := v_hub_ids[30];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Byte Guerreras', 'DEMO-0099', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000100'::uuid;
  v_hub_id := v_hub_ids[31];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nova Guerreras', 'DEMO-0100', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000101'::uuid;
  v_hub_id := v_hub_ids[32];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Tech Pioneras', 'DEMO-0101', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000102'::uuid;
  v_hub_id := v_hub_ids[33];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cyber Pioneras', 'DEMO-0102', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000103'::uuid;
  v_hub_id := v_hub_ids[34];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Digital Pioneras', 'DEMO-0103', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000104'::uuid;
  v_hub_id := v_hub_ids[35];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Code Pioneras', 'DEMO-0104', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000105'::uuid;
  v_hub_id := v_hub_ids[1];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'App Pioneras', 'DEMO-0105', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000106'::uuid;
  v_hub_id := v_hub_ids[2];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Data Pioneras', 'DEMO-0106', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000107'::uuid;
  v_hub_id := v_hub_ids[3];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Smart Pioneras', 'DEMO-0107', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000108'::uuid;
  v_hub_id := v_hub_ids[4];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Eco Pioneras', 'DEMO-0108', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000109'::uuid;
  v_hub_id := v_hub_ids[5];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Quantum Pioneras', 'DEMO-0109', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000110'::uuid;
  v_hub_id := v_hub_ids[6];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Pixel Pioneras', 'DEMO-0110', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000111'::uuid;
  v_hub_id := v_hub_ids[7];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nano Pioneras', 'DEMO-0111', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000112'::uuid;
  v_hub_id := v_hub_ids[8];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Bio Pioneras', 'DEMO-0112', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000113'::uuid;
  v_hub_id := v_hub_ids[9];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Cloud Pioneras', 'DEMO-0113', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000114'::uuid;
  v_hub_id := v_hub_ids[10];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Hack Pioneras', 'DEMO-0114', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000115'::uuid;
  v_hub_id := v_hub_ids[11];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Web Pioneras', 'DEMO-0115', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000116'::uuid;
  v_hub_id := v_hub_ids[12];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Logic Pioneras', 'DEMO-0116', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000117'::uuid;
  v_hub_id := v_hub_ids[13];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Net Pioneras', 'DEMO-0117', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000118'::uuid;
  v_hub_id := v_hub_ids[14];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Algo Pioneras', 'DEMO-0118', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000119'::uuid;
  v_hub_id := v_hub_ids[15];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Byte Pioneras', 'DEMO-0119', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  v_team_id := '55555555-6666-7777-8888-000000000120'::uuid;
  v_hub_id := v_hub_ids[16];
  INSERT INTO public.teams (id, name, tg_team_id, category, hub_id, status, season, validated, created_at, updated_at)
  VALUES (v_team_id, 'Nova Pioneras', 'DEMO-0120', 'senior', v_hub_id, 'active', '2026', true, NOW(), NOW())
  ON CONFLICT (tg_team_id) DO NOTHING;

  RAISE NOTICE 'Created 120 teams';
END $$;