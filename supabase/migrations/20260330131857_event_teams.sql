-- ============================================================================
-- Migration: Event Teams (importación de equipos para regional_final)
-- Description: Junction table evento↔equipo con nomenclatura, matching y turno.
-- ============================================================================

CREATE TABLE public.event_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  team_code VARCHAR NOT NULL,
  category VARCHAR NOT NULL CHECK (category IN ('beginner', 'junior', 'senior')),
  turn VARCHAR NOT NULL CHECK (turn IN ('morning', 'afternoon')),
  csv_team_name TEXT,
  match_type VARCHAR NOT NULL DEFAULT 'exact'
    CHECK (match_type IN ('exact', 'fuzzy', 'email', 'manual', 'tg_id')),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, team_id),
  UNIQUE(event_id, team_code)
);

-- Indexes
CREATE INDEX idx_event_teams_event ON public.event_teams(event_id);
CREATE INDEX idx_event_teams_team ON public.event_teams(team_id);

-- Trigger para updated_at
CREATE TRIGGER update_event_teams_updated_at
  BEFORE UPDATE ON public.event_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with event_teams"
  ON public.event_teams FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view event_teams"
  ON public.event_teams FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Grants para PostgREST
GRANT SELECT ON public.event_teams TO anon;
GRANT ALL ON public.event_teams TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
