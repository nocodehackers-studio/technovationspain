-- ============================================
-- WORKSHOP SYSTEM MIGRATION
-- Sistema completo de gestión de talleres
-- ============================================

-- 1. Añadir campo empresa a workshops
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS company VARCHAR(255);

COMMENT ON COLUMN workshops.max_capacity IS 'Aforo máximo por turno horario';

-- 2. Crear tabla workshop_time_slots
CREATE TABLE IF NOT EXISTS workshop_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_wts_event ON workshop_time_slots(event_id);

ALTER TABLE workshop_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage time slots" ON workshop_time_slots
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Verified users can view time slots" ON workshop_time_slots
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND verification_status = 'verified')
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Crear tabla workshop_preferences
CREATE TABLE IF NOT EXISTS workshop_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  preference_order INTEGER NOT NULL CHECK (preference_order >= 1),
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, event_id, workshop_id),
  UNIQUE(team_id, event_id, preference_order)
);

CREATE INDEX IF NOT EXISTS idx_wp_team ON workshop_preferences(team_id);
CREATE INDEX IF NOT EXISTS idx_wp_event ON workshop_preferences(event_id);
CREATE INDEX IF NOT EXISTS idx_wp_workshop ON workshop_preferences(workshop_id);

ALTER TABLE workshop_preferences ENABLE ROW LEVEL SECURITY;

-- Mentores pueden ver preferencias de sus equipos
CREATE POLICY "Mentors can view team preferences" ON workshop_preferences
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = workshop_preferences.team_id 
    AND user_id = auth.uid() 
    AND member_type = 'mentor'
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Mentores pueden crear preferencias (una vez)
CREATE POLICY "Mentors can insert preferences" ON workshop_preferences
FOR INSERT WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = workshop_preferences.team_id 
    AND user_id = auth.uid() 
    AND member_type = 'mentor'
  )
);

-- Solo admin puede modificar/eliminar
CREATE POLICY "Admins can manage all preferences" ON workshop_preferences
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Crear tabla workshop_assignments
CREATE TABLE IF NOT EXISTS workshop_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES workshop_time_slots(id),
  assignment_slot CHAR(1) NOT NULL CHECK (assignment_slot IN ('A', 'B')),
  preference_matched INTEGER,
  assignment_type VARCHAR(20) DEFAULT 'algorithm',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID,
  UNIQUE(team_id, event_id, assignment_slot),
  UNIQUE(team_id, event_id, workshop_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_team ON workshop_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_wa_workshop ON workshop_assignments(workshop_id);
CREATE INDEX IF NOT EXISTS idx_wa_slot ON workshop_assignments(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_wa_event ON workshop_assignments(event_id);

ALTER TABLE workshop_assignments ENABLE ROW LEVEL SECURITY;

-- Solo admin puede gestionar asignaciones
CREATE POLICY "Admins can manage assignments" ON workshop_assignments
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Mentores pueden ver asignaciones de sus equipos
CREATE POLICY "Team members can view assignments" ON workshop_assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = workshop_assignments.team_id 
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Añadir campo participant_count a event_registrations
ALTER TABLE event_registrations 
ADD COLUMN IF NOT EXISTS participant_count INTEGER DEFAULT 1;

COMMENT ON COLUMN event_registrations.participant_count IS 
  'Número de participantes del equipo que asistirán al evento';