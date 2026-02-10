INSERT INTO team_members (team_id, user_id, member_type)
VALUES ('19c2976b-9a08-42b9-b1c1-bc5254ffeba7', '9a06f412-cb66-4563-9d06-477d092a09ea', 'participant')
ON CONFLICT DO NOTHING;