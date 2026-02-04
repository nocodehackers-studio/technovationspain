-- Asignar usuario al equipo Tech Innovators
INSERT INTO team_members (team_id, user_id, member_type) 
VALUES ('902c02c9-bdc9-4d41-8ff1-6af0cdb9fc52', '4d87acf6-0fea-48b2-92b1-f158cb5cd686', 'participant')
ON CONFLICT DO NOTHING;

-- Inscribir al usuario en el evento
INSERT INTO event_registrations (
  event_id, 
  user_id, 
  ticket_type_id,
  qr_code,
  registration_number,
  first_name,
  last_name,
  email,
  registration_status,
  participant_count,
  team_id
) VALUES (
  'd97c4be7-d2ba-4fd5-9f99-ee20ed01165a',
  '4d87acf6-0fea-48b2-92b1-f158cb5cd686',
  'ee4129db-7497-4293-82d7-7c57e1c73f5b',
  'QR-' || gen_random_uuid()::text,
  'TGM-2025-' || upper(substr(md5(random()::text), 1, 8)),
  'Alejandro',
  'Bernardo Díaz',
  'alejandrobernardodiaz@gmail.com',
  'confirmed',
  1,
  '902c02c9-bdc9-4d41-8ff1-6af0cdb9fc52'
) ON CONFLICT DO NOTHING;