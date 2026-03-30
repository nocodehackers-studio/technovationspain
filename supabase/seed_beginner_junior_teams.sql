-- Seed: 50 equipos Beginner y Junior para pruebas de importación/asignación
-- Ejecutar después de las migraciones base

-- ═══════════════════════════════════════════════════════════════
-- BEGINNER (25 equipos) — TG IDs 70011–70035
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.teams (tg_team_id, name, category, status, season)
VALUES
  ('70011', 'Las Exploradoras',   'beginner', 'active', '2026'),
  ('70012', 'TechStars Mini',     'beginner', 'active', '2026'),
  ('70013', 'Robotitas',          'beginner', 'active', '2026'),
  ('70014', 'CiberHeroinas',      'beginner', 'active', '2026'),
  ('70015', 'MiniCoders',         'beginner', 'active', '2026'),
  ('70016', 'PixelPrincesas',     'beginner', 'active', '2026'),
  ('70017', 'StarCoders',         'beginner', 'active', '2026'),
  ('70018', 'Las Inventoras',     'beginner', 'active', '2026'),
  ('70019', 'TechButterflies',    'beginner', 'active', '2026'),
  ('70020', 'CodeKittens',        'beginner', 'active', '2026'),
  ('70021', 'DigiAmigas',         'beginner', 'active', '2026'),
  ('70022', 'AppStar Girls',      'beginner', 'active', '2026'),
  ('70023', 'Las Programadoras',  'beginner', 'active', '2026'),
  ('70024', 'TechFlowers',        'beginner', 'active', '2026'),
  ('70025', 'BinaryGirls',        'beginner', 'active', '2026'),
  ('70026', 'RocketCoders',       'beginner', 'active', '2026'),
  ('70027', 'EcoTech Kids',       'beginner', 'active', '2026'),
  ('70028', 'Las Creadoras',      'beginner', 'active', '2026'),
  ('70029', 'MiniHackers',        'beginner', 'active', '2026'),
  ('70030', 'TechRainbow',        'beginner', 'active', '2026'),
  ('70031', 'SmartGirls',         'beginner', 'active', '2026'),
  ('70032', 'CodeLuna',           'beginner', 'active', '2026'),
  ('70033', 'DigitalSisters',     'beginner', 'active', '2026'),
  ('70034', 'TechSupernovas',     'beginner', 'active', '2026'),
  ('70035', 'Las Conectadas',     'beginner', 'active', '2026')
ON CONFLICT (tg_team_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- JUNIOR (25 equipos) — TG IDs 70036–70060
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.teams (tg_team_id, name, category, status, season)
VALUES
  ('70036', 'FutureBuilders',     'junior', 'active', '2026'),
  ('70037', 'TechValientes',      'junior', 'active', '2026'),
  ('70038', 'InfinityGirls',      'junior', 'active', '2026'),
  ('70039', 'CodeWarriors',       'junior', 'active', '2026'),
  ('70040', 'AppMakers',          'junior', 'active', '2026'),
  ('70041', 'Las Ingenieras',     'junior', 'active', '2026'),
  ('70042', 'CyberQueens',        'junior', 'active', '2026'),
  ('70043', 'TechRebels',         'junior', 'active', '2026'),
  ('70044', 'DataStorm',          'junior', 'active', '2026'),
  ('70045', 'AlgoGirls',          'junior', 'active', '2026'),
  ('70046', 'WebWizards',         'junior', 'active', '2026'),
  ('70047', 'HackHeroinas',       'junior', 'active', '2026'),
  ('70048', 'BitBlossoms',        'junior', 'active', '2026'),
  ('70049', 'LogicLadies',        'junior', 'active', '2026'),
  ('70050', 'TechAurora',         'junior', 'active', '2026'),
  ('70051', 'Las Codenadoras',    'junior', 'active', '2026'),
  ('70052', 'QuantumGirls',       'junior', 'active', '2026'),
  ('70053', 'DevDreams',          'junior', 'active', '2026'),
  ('70054', 'TechPhoenix',        'junior', 'active', '2026'),
  ('70055', 'CodeCometas',        'junior', 'active', '2026'),
  ('70056', 'NexGen Girls',       'junior', 'active', '2026'),
  ('70057', 'AppArtistas',        'junior', 'active', '2026'),
  ('70058', 'TechTitanas',        'junior', 'active', '2026'),
  ('70059', 'ByteForce',          'junior', 'active', '2026'),
  ('70060', 'Las Digitales',      'junior', 'active', '2026')
ON CONFLICT (tg_team_id) DO NOTHING;
