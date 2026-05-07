import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, RefreshCw, AlertTriangle } from 'lucide-react';
import AdminJudgingSchedule, {
  type AdminJudgingScheduleDataOverride,
} from '@/pages/admin/AdminJudgingSchedule';
import EscaletaPasswordGate from '@/components/public/EscaletaPasswordGate';
import { usePublicJudgingSchedule } from '@/hooks/usePublicJudgingSchedule';
import { clearAuth, isAuthenticated } from '@/lib/escaletaAccess';
import type { PublicScheduleResponse } from '@/types/publicSchedule';
import type { PanelWithRelations } from '@/hooks/useJudgingAssignment';
import type { JudgeForAssignment } from '@/hooks/useEventJudges';
import type { JudgingEventConfig } from '@/types/database';

function mapResponseToOverride(data: PublicScheduleResponse): AdminJudgingScheduleDataOverride {
  const hubsMap: Record<string, string> = {};
  for (const h of data.hubs || []) hubsMap[h.id] = h.name;

  const assignments = (data.panels || []).map(p => ({
    id: p.id,
    event_id: p.event_id,
    panel_code: p.panel_code,
    session_number: p.session_number,
    room_number: p.room_number,
    turn: p.turn,
    created_at: p.created_at ?? new Date(0).toISOString(),
    updated_at: p.created_at ?? new Date(0).toISOString(),
    judging_panel_judges: (p.judging_panel_judges || []).map(j => ({
      id: j.id,
      panel_id: j.panel_id,
      judge_id: j.judge_id,
      assignment_type: j.assignment_type,
      is_active: j.is_active,
      assigned_by: null,
      deactivated_at: j.deactivated_at,
      deactivated_reason: j.deactivated_reason,
      manual_change_comment: j.manual_change_comment,
      manual_change_by: j.manual_change_by,
      manual_change_at: j.manual_change_at,
      created_at: '',
      updated_at: '',
      profiles: {
        id: j.profiles.id,
        first_name: j.profiles.first_name,
        last_name: j.profiles.last_name,
        email: j.profiles.email ?? '',
        hub_id: j.profiles.hub_id,
        chapter: j.profiles.chapter,
        city: j.profiles.city,
        state: j.profiles.state,
      } as PanelWithRelations['judging_panel_judges'][number]['profiles'],
      manual_change_by_profile: j.manual_change_by_profile,
    })),
    judging_panel_teams: (p.judging_panel_teams || []).map(t => ({
      id: t.id,
      panel_id: t.panel_id,
      team_id: t.team_id,
      team_code: t.team_code,
      subsession: t.subsession,
      assignment_type: t.assignment_type,
      is_active: t.is_active,
      assigned_by: null,
      moved_from_panel_id: null,
      display_order: t.display_order,
      manual_change_comment: t.manual_change_comment,
      manual_change_by: t.manual_change_by,
      manual_change_at: t.manual_change_at,
      created_at: '',
      updated_at: '',
      teams: t.teams,
      manual_change_by_profile: t.manual_change_by_profile,
    })),
  }));

  const config: JudgingEventConfig | null = data.config
    ? {
        id: data.config.id,
        event_id: data.config.event_id,
        total_rooms: data.config.total_rooms,
        teams_per_group: data.config.teams_per_group,
        judges_per_group: data.config.judges_per_group,
        sessions_per_turn: data.config.sessions_per_turn,
        algorithm_run_at: data.config.algorithm_run_at,
        algorithm_run_by: data.config.algorithm_run_by,
        created_at: data.config.created_at ?? '',
        updated_at: data.config.updated_at ?? '',
      }
    : null;

  const eventJudges: JudgeForAssignment[] = (data.judges || [])
    .filter(j => !j.profiles.judge_excluded)
    .map(j => ({
      id: j.profiles.id,
      name: `${j.profiles.first_name || ''} ${j.profiles.last_name || ''}`.trim(),
      email: j.profiles.email ?? '',
      hubId: j.profiles.hub_id,
      schedulePreference: j.schedule_preference,
      conflictTeamIds: j.conflict_team_ids ?? [],
      conflictOtherText: j.conflict_other_text,
      onboardingCompleted: j.onboarding_completed,
      techGlobalOnboarded: j.tech_global_onboarded,
      comments: j.comments,
      isEventActive: j.is_active,
      judgeExcluded: j.profiles.judge_excluded,
      chapter: j.profiles.chapter,
      city: j.profiles.city,
      state: j.profiles.state,
    }));

  const eventTeams = (data.event_teams || []).map(et => ({
    id: et.id,
    team_id: et.team_id,
    team_code: et.team_code ?? '',
    category: et.category ?? '',
    turn: et.turn ?? 'morning',
    is_active: et.is_active,
    teams: et.teams
      ? { id: et.teams.id, name: et.teams.name, hub_id: et.teams.hub_id }
      : null,
  }));

  return {
    event: {
      id: data.event.id,
      name: data.event.name,
      date: data.event.date,
      status: data.event.status,
      event_type: data.event.event_type,
    },
    assignments: assignments as unknown as PanelWithRelations[],
    config,
    eventJudges,
    eventTeams,
    hubsMap,
  };
}

function NotFoundView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="max-w-md text-center space-y-4">
        <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
        <h1 className="text-2xl font-bold">Esta escaleta no está disponible</h1>
        <p className="text-muted-foreground">
          El enlace puede haber sido desactivado o ya no es válido. Pide al organizador un enlace actualizado.
        </p>
        <Link to="/" className="text-primary underline text-sm">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="max-w-md text-center space-y-4">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
        <h1 className="text-2xl font-bold">No se pudo cargar la escaleta</h1>
        <p className="text-muted-foreground">
          Ha ocurrido un error al obtener los datos. Comprueba tu conexión y vuelve a intentarlo.
        </p>
        <Button onClick={onRetry}>Reintentar</Button>
      </div>
    </div>
  );
}

export default function EscaletaPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [authed, setAuthed] = useState(() => (token ? isAuthenticated(token) : false));
  const queryClient = useQueryClient();
  const query = usePublicJudgingSchedule(authed && token ? token : undefined);

  const override = useMemo(
    () => (query.data ? mapResponseToOverride(query.data) : null),
    [query.data]
  );

  if (!token) {
    return <NotFoundView />;
  }

  if (!authed) {
    return <EscaletaPasswordGate token={token} onAuth={() => setAuthed(true)} />;
  }

  if (query.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (query.isError) {
    return <ErrorView onRetry={() => query.refetch()} />;
  }

  if (!override) {
    return <NotFoundView />;
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['public-judging-schedule', token] });
  };

  const handleExit = () => {
    clearAuth(token);
    setAuthed(false);
  };

  const eventDate = override.event.date
    ? new Date(override.event.date).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">Acceso público</Badge>
            <div>
              <h2 className="font-semibold leading-tight">{override.event.name}</h2>
              {eventDate && (
                <p className="text-xs text-muted-foreground capitalize">{eventDate}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={query.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${query.isFetching ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExit}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <AdminJudgingSchedule readOnly dataOverride={override} />
      </main>
    </div>
  );
}
