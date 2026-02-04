-- Asignar mentor al equipo Tech Innovators
INSERT INTO team_members (team_id, user_id, member_type) 
VALUES ('902c02c9-bdc9-4d41-8ff1-6af0cdb9fc52', '7ef3b397-2d0f-4ab4-89a7-85a5b120c5f4', 'mentor')
ON CONFLICT DO NOTHING;