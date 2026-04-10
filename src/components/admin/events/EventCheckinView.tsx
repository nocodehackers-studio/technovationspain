import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Users, UserCheck } from 'lucide-react';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import { CheckinJudgesGrid } from './CheckinJudgesGrid';
import { CheckinTeamsGrid } from './CheckinTeamsGrid';

interface EventCheckinViewProps {
  eventId: string;
}

export function EventCheckinView({ eventId }: EventCheckinViewProps) {
  const {
    judges,
    teams,
    markJudgeArrived,
    markJudgeDeparted,
    markTeamArrived,
    markTeamDeparted,
    isLoading,
  } = useCheckinStatus(eventId);

  const [judgeSearch, setJudgeSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

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
      const aArrived = (a.checkedInAt || a.participantCheckedIn) ? 1 : 0;
      const bArrived = (b.checkedInAt || b.participantCheckedIn) ? 1 : 0;
      if (aArrived !== bArrived) return bArrived - aArrived;
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
          <span className="font-medium">
            Equipos: {teams.arrived}/{teams.total}
          </span>
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
                    <th className="px-3 py-2 text-left font-medium">Hora</th>
                    <th className="px-3 py-2 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJudges.map(judge => {
                    const isArrived = judge.checkedInAt !== null;
                    return (
                      <tr key={judge.registrationId} className={`border-b last:border-0 ${isArrived ? 'bg-green-50' : ''}`}>
                        <td className="px-3 py-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${isArrived ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {judge.firstName} {judge.lastName}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{judge.email}</td>
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
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
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
          <CheckinTeamsGrid eventId={eventId} checkedInTeamIds={teams.checkedInTeamIds} />

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
                className="pl-9"
              />
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
                    const isAutoOnly = !team.checkedInAt && team.participantCheckedIn;
                    return (
                      <tr key={team.eventTeamId} className={`border-b last:border-0 ${isArrived ? 'bg-green-50' : ''}`}>
                        <td className="px-3 py-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${isArrived ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </td>
                        <td className="px-3 py-2 font-mono font-medium">{team.teamCode}</td>
                        <td className="px-3 py-2 font-medium">{team.name}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {team.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {isArrived
                            ? isAutoOnly
                              ? 'QR participante'
                              : team.checkedInAt && team.participantCheckedIn
                                ? 'Manual + QR'
                                : 'Manual'
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {team.checkedInAt ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (window.confirm(`¿Desmarcar llegada del equipo ${team.teamCode}?`))
                                  markTeamDeparted(team.eventTeamId);
                              }}
                            >
                              Desmarcar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`text-xs ${isAutoOnly ? 'text-muted-foreground' : 'text-green-600 hover:text-green-700'}`}
                              onClick={() => markTeamArrived(team.eventTeamId)}
                              disabled={isAutoOnly}
                              title={isAutoOnly ? 'Ya llegó vía QR de participante' : undefined}
                            >
                              {isAutoOnly ? 'Llegó (QR)' : 'Marcar llegada'}
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
