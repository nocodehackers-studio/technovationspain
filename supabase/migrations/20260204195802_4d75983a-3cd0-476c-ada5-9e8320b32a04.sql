-- Permitir a mentores ver perfiles de participantes de sus equipos
CREATE POLICY "Mentors can view team participants profiles"
ON profiles
FOR SELECT
USING (
  id IN (
    SELECT tm_participant.user_id
    FROM team_members tm_participant
    WHERE tm_participant.member_type = 'participant'
    AND tm_participant.team_id IN (
      SELECT tm_mentor.team_id
      FROM team_members tm_mentor
      WHERE tm_mentor.user_id = auth.uid()
      AND tm_mentor.member_type = 'mentor'
    )
  )
);