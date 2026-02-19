-- =============================================================================
-- Script de datos de prueba para staging
-- Flujo: Mentor asigna preferencias de talleres para sus equipos
--
-- Ejecutar en: SQL Editor del dashboard de Supabase (staging)
-- Proyecto: pmbxafzjkqbyfggjkmmg
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Variables de referencia
-- ---------------------------------------------------------------------------
-- Mentor: d046dfff-98bd-48af-b396-0b9f7f98afef (alejandrobernardodiaz+mentor@gmail.com)
-- Evento: ef37a9ef-aa62-4725-863c-22ca5f7ad50d (Prueba - intermediate)
-- Ticket: 45102b36-524d-4549-9e13-1473e56a94d9 (Participante)

-- ---------------------------------------------------------------------------
-- 1. Crear 40 usuarios ficticios en auth.users
--    (el trigger handle_new_user() crea automáticamente el perfil en profiles)
--    Usamos WHERE NOT EXISTS en vez de ON CONFLICT porque auth.users
--    usa un índice parcial en email, no un constraint UNIQUE directo
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test-participante-' || i || '@test.technovation.es',
  crypt('test-password-unused', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
FROM generate_series(1, 40) AS i
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.email = 'test-participante-' || i || '@test.technovation.es'
);

-- ---------------------------------------------------------------------------
-- 2. Actualizar perfiles (ya creados por el trigger) con nombre y datos
-- ---------------------------------------------------------------------------
UPDATE profiles
SET
  first_name = 'Participante ' || SUBSTRING(email FROM 'test-participante-(\d+)@'),
  last_name = 'Test',
  onboarding_completed = true
WHERE email LIKE 'test-participante-%@test.technovation.es';

-- ---------------------------------------------------------------------------
-- 3. Asegurar perfil del mentor
-- ---------------------------------------------------------------------------
INSERT INTO profiles (id, email, first_name, last_name, onboarding_completed)
VALUES (
  'd046dfff-98bd-48af-b396-0b9f7f98afef',
  'alejandrobernardodiaz+mentor@gmail.com',
  'Mentor',
  'Test',
  true
)
ON CONFLICT (id) DO UPDATE SET
  first_name = COALESCE(profiles.first_name, EXCLUDED.first_name),
  last_name = COALESCE(profiles.last_name, EXCLUDED.last_name),
  onboarding_completed = true;

-- ---------------------------------------------------------------------------
-- 4. Crear roles
-- ---------------------------------------------------------------------------
-- Rol mentor
INSERT INTO user_roles (user_id, role)
VALUES ('d046dfff-98bd-48af-b396-0b9f7f98afef', 'mentor')
ON CONFLICT (user_id, role) DO NOTHING;

-- Roles participante
INSERT INTO user_roles (user_id, role)
SELECT au.id, 'participant'
FROM auth.users au
WHERE au.email LIKE 'test-participante-%@test.technovation.es'
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Crear 10 equipos
-- ---------------------------------------------------------------------------
INSERT INTO teams (id, name, category)
VALUES
  (gen_random_uuid(), 'Equipo Test 1',  'beginner'),
  (gen_random_uuid(), 'Equipo Test 2',  'beginner'),
  (gen_random_uuid(), 'Equipo Test 3',  'junior'),
  (gen_random_uuid(), 'Equipo Test 4',  'junior'),
  (gen_random_uuid(), 'Equipo Test 5',  'senior'),
  (gen_random_uuid(), 'Equipo Test 6',  'senior'),
  (gen_random_uuid(), 'Equipo Test 7',  'beginner'),
  (gen_random_uuid(), 'Equipo Test 8',  'junior'),
  (gen_random_uuid(), 'Equipo Test 9',  'senior'),
  (gen_random_uuid(), 'Equipo Test 10', 'beginner');

-- ---------------------------------------------------------------------------
-- 6. Asignar mentor a los 10 equipos
-- ---------------------------------------------------------------------------
INSERT INTO team_members (team_id, user_id, member_type)
SELECT t.id, 'd046dfff-98bd-48af-b396-0b9f7f98afef', 'mentor'
FROM teams t
WHERE t.name ~ '^Equipo Test [0-9]+$'
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Asignar 4 participantes por equipo
--    Participantes 1-4 → Equipo 1, 5-8 → Equipo 2, etc.
-- ---------------------------------------------------------------------------
WITH numbered_teams AS (
  SELECT t.id AS team_id, t.name,
         ROW_NUMBER() OVER (ORDER BY
           CAST(SUBSTRING(t.name FROM 'Equipo Test (\d+)') AS INTEGER)
         ) AS team_num
  FROM teams t
  WHERE t.name ~ '^Equipo Test [0-9]+$'
),
numbered_participants AS (
  SELECT au.id AS user_id, au.email,
         CAST(SUBSTRING(au.email FROM 'test-participante-(\d+)@') AS INTEGER) AS participant_num
  FROM auth.users au
  WHERE au.email LIKE 'test-participante-%@test.technovation.es'
)
INSERT INTO team_members (team_id, user_id, member_type)
SELECT nt.team_id, np.user_id, 'participant'
FROM numbered_teams nt
JOIN numbered_participants np
  ON np.participant_num BETWEEN (nt.team_num - 1) * 4 + 1 AND nt.team_num * 4
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Inscribir 1 participante de cada equipo al evento
--    (la primera participante de cada equipo)
-- ---------------------------------------------------------------------------
WITH numbered_teams AS (
  SELECT t.id AS team_id, t.name,
         ROW_NUMBER() OVER (ORDER BY
           CAST(SUBSTRING(t.name FROM 'Equipo Test (\d+)') AS INTEGER)
         ) AS team_num
  FROM teams t
  WHERE t.name ~ '^Equipo Test [0-9]+$'
),
first_participants AS (
  SELECT au.id AS user_id, au.email,
         p.first_name, p.last_name,
         CAST(SUBSTRING(au.email FROM 'test-participante-(\d+)@') AS INTEGER) AS participant_num
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  WHERE au.email LIKE 'test-participante-%@test.technovation.es'
),
team_first_participant AS (
  SELECT nt.team_id, nt.team_num, nt.name AS team_name,
         fp.user_id, fp.email, fp.first_name, fp.last_name
  FROM numbered_teams nt
  JOIN first_participants fp
    ON fp.participant_num = (nt.team_num - 1) * 4 + 1
)
INSERT INTO event_registrations (
  event_id, user_id, team_id, ticket_type_id,
  registration_status, qr_code, registration_number,
  first_name, last_name, email, team_name,
  image_consent, data_consent, participant_count
)
SELECT
  'ef37a9ef-aa62-4725-863c-22ca5f7ad50d',
  tfp.user_id,
  tfp.team_id,
  '45102b36-524d-4549-9e13-1473e56a94d9',
  'confirmed',
  'QR-TEST-' || tfp.team_num || '-' || gen_random_uuid(),
  '202602-T' || LPAD(tfp.team_num::TEXT, 4, '0'),
  tfp.first_name,
  tfp.last_name,
  tfp.email,
  tfp.team_name,
  true,
  true,
  1
FROM team_first_participant tfp;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificación (ejecutar después del script principal)
-- ---------------------------------------------------------------------------
-- SELECT 'Equipos creados' AS check_name, COUNT(*) AS total FROM teams WHERE name ~ '^Equipo Test [0-9]+$';
-- SELECT 'Miembros por equipo' AS check_name, t.name, COUNT(*) AS total FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.name ~ '^Equipo Test [0-9]+$' GROUP BY t.name ORDER BY t.name;
-- SELECT 'Registros evento' AS check_name, COUNT(*) AS total FROM event_registrations WHERE event_id = 'ef37a9ef-aa62-4725-863c-22ca5f7ad50d' AND email LIKE '%test.technovation.es';
