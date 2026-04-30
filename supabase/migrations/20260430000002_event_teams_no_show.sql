-- Tech-Spec: tech-spec-checkin-evento-final-v2-no-show-equipos
-- Añade flag de "no llegada" a equipos del evento final.
-- Convive con checked_in_at: la confirmación de llegada (manual o vía QR de participante)
-- gana visualmente sobre la marca de no-show. El export de no-shows filtra por
-- not_arrived_at IS NOT NULL AND checked_in_at IS NULL AND sin auto-checkin.

ALTER TABLE event_teams
  ADD COLUMN not_arrived_at TIMESTAMPTZ NULL,
  ADD COLUMN not_arrived_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN event_teams.not_arrived_at IS
  'Marca de admin indicando que el equipo NO se ha presentado al evento. Independiente de checked_in_at.';
COMMENT ON COLUMN event_teams.not_arrived_by IS
  'Profile que marcó al equipo como no-show.';

CREATE INDEX IF NOT EXISTS event_teams_not_arrived_at_idx
  ON event_teams (event_id) WHERE not_arrived_at IS NOT NULL;
