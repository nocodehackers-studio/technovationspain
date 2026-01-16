-- Insert test event
INSERT INTO events (
  name,
  description,
  date,
  start_time,
  end_time,
  location_name,
  location_address,
  location_city,
  max_capacity,
  status,
  registration_open_date,
  registration_close_date,
  event_type
) VALUES (
  'Technovation Girls Spain 2026 - Final Regional Madrid',
  'Únete a la final regional de Madrid donde los equipos presentarán sus proyectos de apps móviles ante el jurado. Un día lleno de tecnología, innovación y emprendimiento para niñas y jóvenes.',
  '2026-03-15',
  '09:00',
  '18:00',
  'Campus Google Madrid',
  'Calle Príncipe de Vergara 187',
  'Madrid',
  500,
  'published',
  '2026-01-01',
  '2026-03-10',
  'regional_final'
);

-- Get the event ID and create ticket types
INSERT INTO event_ticket_types (event_id, name, description, max_capacity, allowed_roles, requires_team, requires_verification, sort_order, is_active)
SELECT 
  id,
  'Participante / Mentor',
  'Entrada para participantes y mentores verificados de Technovation Girls',
  400,
  ARRAY['participant', 'mentor'],
  false,
  true,
  1,
  true
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';

INSERT INTO event_ticket_types (event_id, name, description, max_capacity, allowed_roles, requires_team, requires_verification, sort_order, is_active)
SELECT 
  id,
  'Acompañante',
  'Entrada para familiares y acompañantes (no requiere verificación)',
  100,
  NULL,
  false,
  false,
  2,
  true
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';

-- Add sample agenda items
INSERT INTO event_agenda (event_id, title, description, start_time, end_time, sort_order, color)
SELECT id, 'Acreditación y bienvenida', 'Registro de asistentes y entrega de materiales', '09:00', '09:30', 1, '#10b981'
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';

INSERT INTO event_agenda (event_id, title, description, start_time, end_time, sort_order, color)
SELECT id, 'Ceremonia de apertura', 'Bienvenida oficial y presentación del jurado', '09:30', '10:00', 2, '#3b82f6'
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';

INSERT INTO event_agenda (event_id, title, description, start_time, end_time, sort_order, color)
SELECT id, 'Presentaciones - Ronda 1', 'Primeras presentaciones de proyectos', '10:00', '12:00', 3, '#8b5cf6'
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';

INSERT INTO event_agenda (event_id, title, description, start_time, end_time, sort_order, color)
SELECT id, 'Almuerzo', 'Pausa para comer y networking', '12:00', '13:30', 4, '#f59e0b'
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';

INSERT INTO event_agenda (event_id, title, description, start_time, end_time, sort_order, color)
SELECT id, 'Presentaciones - Ronda 2', 'Segundas presentaciones de proyectos', '13:30', '16:00', 5, '#8b5cf6'
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';

INSERT INTO event_agenda (event_id, title, description, start_time, end_time, sort_order, color)
SELECT id, 'Deliberación del jurado', 'El jurado evalúa los proyectos', '16:00', '17:00', 6, '#6b7280'
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';

INSERT INTO event_agenda (event_id, title, description, start_time, end_time, sort_order, color)
SELECT id, 'Ceremonia de premios', 'Anuncio de ganadores y entrega de premios', '17:00', '18:00', 7, '#ec4899'
FROM events WHERE name = 'Technovation Girls Spain 2026 - Final Regional Madrid';