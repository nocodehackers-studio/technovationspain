import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Users, UserCheck, Download, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import { useJudgingAssignment } from '@/hooks/useJudgingAssignment';
import { CheckinJudgesGrid } from './CheckinJudgesGrid';
import { CheckinTeamsGrid } from './CheckinTeamsGrid';
import { exportTeamsNoShowCSV, type TeamNoShowRow } from '@/lib/exports/exportTeamsNoShow';

interface EventCheckinViewProps {
  eventId: string;
}

export function EventCheckinView({ eventId }: EventCheckinViewProps) {
  const {
    judges,
    teams,
    markJudgeArrived,
    markJudgeDeparted,
    markTeamNoShow,
    unmarkTeamNoShow,
    isLoading,
  } = useCheckinStatus(eventId);

  const { assignments } = useJudgingAssignment(eventId);

  const [judgeSearch, setJudgeSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

  // Map teamId → panel info (session, room, panel_code) for enriching the export
  const panelByTeamId = useMemo(() => {
    const map = new Map<string, { sessionNumber: number; roomNumber: number; panelCode: string }>();
    for (const panel of assignments || []) {
      for (const t of panel.judging_panel_teams || []) {
        const teamId = (t.teams as any)?.id as string | undefined;
        if (teamId) {
          map.set(teamId, {
            sessionNumber: panel.session_number,
            roomNumber: panel.room_number,
            panelCode: panel.panel_code,
          });
        }
      }
    }
    return map;
  }, [assignments]);

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  // --- Judges list (filtered & sorted) ---
  const filteredJudges = judges.list
    .filter(j => {
      if (!judgeSearch) return true;
      const q = judgeSearch.toLowerCase();
      return (
        (j.firstName || '').toLowerCase().includes(q) ||
        (j.lastName || '').toLowerCase().includes(q) ||
        (j.email || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // Arrived first, then by name
      const aChecked = a.checkedInAt ? 1 : 0;
      const bChecked = b.checkedInAt ? 1 : 0;
      if (aChecked !== bChecked) return bChecked - aChecked;
      const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return aName.localeCompare(bName);
    });

  // --- Teams list (filtered & sorted) ---
  // Sort: no-shows first (problemas), then pending, then arrived (verde)
  const filteredTeams = teams.list
    .filter(t => {
      if (!teamSearch) return true;
      const q = teamSearch.toLowerCase();
      return (
        t.teamCode.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const stateRank = (t: typeof a) => {
        const arrived = t.checkedInAt !== null || t.participantCheckedIn;
        const noShow = t.notArrivedAt !== null && !arrived;
        if (noShow) return 0;
        if (!arrived) return 1;
        return 2;
      };
      const ra = stateRank(a);
      const rb = stateRank(b);
      if (ra !== rb) return ra - rb;
      return a.teamCode.localeCompare(b.teamCode);
    });

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const handleExportNoShows = () => {
    const noShowList = teams.list.filter(
      t => t.notArrivedAt !== null && t.checkedInAt === null && !t.participantCheckedIn
    );
    if (noShowList.length === 0) {
      toast.info('No hay equipos marcados como no llegados.');
      return;
    }
    const rows: TeamNoShowRow[] = noShowList.map(t => {
      const panel = panelByTeamId.get(t.teamId);
      return {
        teamCode: t.teamCode,
        name: t.name,
        category: t.category,
        turn: t.turn,
        sessionNumber: panel?.sessionNumber,
        roomNumber: panel?.roomNumber,
        panelCode: panel?.panelCode,
        notArrivedAt: t.notArrivedAt!,
      };
    });
    exportTeamsNoShowCSV(rows);
    toast.success(`Exportados ${rows.length} equipo(s) no llegado(s).`);
  };

  return (
    <div className="space-y-4">
      {/* Header with live badge and counters */}
      <div className="flex items-center gap-4 flex-wrap">
        <Badge className="bg-green-500 text-white animate-pulse">En Vivo</Badge>
        <div className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            Jueces: {judges.arrived}/{judges.total}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Equipos: {teams.total} total</span>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            Confirmados: {teams.arrived}
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            No llegados: {teams.noShow}
          </Badge>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs defaultValue="judges">
        <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
          <TabsTrigger value="judges">Jueces</TabsTrigger>
          <TabsTrigger value="teams">Equipos</TabsTrigger>
        </TabsList>

        {/* ===== Judges Tab ===== */}
        <TabsContent value="judges" className="space-y-4 mt-4">
          <CheckinJudgesGrid eventId={eventId} checkedInUserIds={judges.checkedInUserIds} />

          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border rounded p-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Solo se muestran jueces que han sacado su entrada. Si falta alguien, comprueba que tenga su ticket emitido.
                Pueden marcar llegada manualmente o escaneando su QR (la fila se pondrá en verde automáticamente).
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o correo..."
                value={judgeSearch}
                onChange={e => setJudgeSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-left font-medium">Nombre</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Vía</th>
                    <th className="px-3 py-2 text-left font-medium">Hora</th>
                    <th className="px-3 py-2 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJudges.map(judge => {
                    const isArrived = judge.checkedInAt !== null;
                    const viaSelf = isArrived && judge.checkedInBy && judge.userId && judge.checkedInBy === judge.userId;
                    const viaLabel = isArrived ? (viaSelf ? 'QR' : 'Manual') : '—';
                    return (
                      <tr key={judge.registrationId} className={`border-b last:border-0 ${isArrived ? 'bg-green-50' : ''}`}>
                        <td className="px-3 py-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${isArrived ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {judge.firstName} {judge.lastName}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{judge.email}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{viaLabel}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatTime(judge.checkedInAt)}</td>
                        <td className="px-3 py-2 text-right">
                          {isArrived ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (window.confirm(`¿Desmarcar llegada de ${judge.firstName} ${judge.lastName}?`))
                                  markJudgeDeparted(judge.registrationId);
                              }}
                            >
                              Desmarcar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-green-600 hover:text-green-700"
                              onClick={() => markJudgeArrived(judge.registrationId)}
                            >
                              Marcar llegada
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredJudges.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        {judgeSearch ? 'No se encontraron jueces con ese filtro' : 'No hay jueces registrados'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ===== Teams Tab ===== */}
        <TabsContent value="teams" className="space-y-4 mt-4">
          <CheckinTeamsGrid
            eventId={eventId}
            checkedInTeamIds={teams.checkedInTeamIds}
            noShowTeamIds={teams.noShowTeamIds}
          />

          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border rounded p-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Por defecto los equipos se asumen presentes. Marca <strong>"No ha llegado"</strong> para identificar ausencias y exportarlas.
                Si una participante escanea su QR, su equipo pasará automáticamente a verde y prevalece sobre cualquier marca de no-llegada.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código o nombre..."
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleExportNoShows} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar no llegados
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Equipo</th>
                    <th className="px-3 py-2 text-left font-medium">Categoría</th>
                    <th className="px-3 py-2 text-left font-medium">Vía</th>
                    <th className="px-3 py-2 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map(team => {
                    const isArrived = team.checkedInAt !== null || team.participantCheckedIn;
                    const isNoShow = team.notArrivedAt !== null && !isArrived;

                    let stateColor = 'bg-gray-300';
                    let rowClass = '';
                    if (isArrived) {
                      stateColor = 'bg-green-500';
                      rowClass = 'bg-green-50';
                    } else if (isNoShow) {
                      stateColor = 'bg-red-500';
                      rowClass = 'bg-red-50';
                    }

                    let viaLabel = '—';
                    if (isArrived) {
                      if (team.checkedInAt && team.participantCheckedIn) viaLabel = 'Manual + QR';
                      else if (team.participantCheckedIn) viaLabel = 'QR participante';
                      else viaLabel = 'Manual';
                    } else if (isNoShow) {
                      viaLabel = 'No llegado';
                    }

                    return (
                      <tr key={team.eventTeamId} className={`border-b last:border-0 ${rowClass}`}>
                        <td className="px-3 py-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${stateColor}`} />
                        </td>
                        <td className="px-3 py-2 font-mono font-medium">{team.teamCode}</td>
                        <td className="px-3 py-2 font-medium">{team.name}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {team.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{viaLabel}</td>
                        <td className="px-3 py-2 text-right">
                          {isArrived ? (
                            <span className="text-xs text-muted-foreground italic">
                              {team.participantCheckedIn && !team.checkedInAt ? 'Confirmado vía QR' : 'Confirmado'}
                            </span>
                          ) : isNoShow ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => unmarkTeamNoShow(team.eventTeamId)}
                            >
                              Quitar marca
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (window.confirm(`¿Marcar ${team.teamCode} (${team.name}) como NO llegado?`))
                                  markTeamNoShow(team.eventTeamId);
                              }}
                            >
                              Marcar no llegada
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTeams.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        {teamSearch ? 'No se encontraron equipos con ese filtro' : 'No hay equipos importados'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
