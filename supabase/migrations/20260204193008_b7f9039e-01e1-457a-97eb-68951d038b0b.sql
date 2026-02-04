-- Permitir a mentores ver registros de participantes de sus equipos
CREATE POLICY "Mentors can view team participant registrations"
ON event_registrations
FOR SELECT
USING (
  -- El usuario inscrito es participante de un equipo donde yo soy mentor
  user_id IN (
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