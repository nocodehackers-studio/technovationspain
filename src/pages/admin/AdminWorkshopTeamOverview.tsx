import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Users, Download, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type StatusFilter = 'all' | 'complete' | 'partial' | 'unassigned';

interface TeamOverviewRow {
  teamId: string;
  teamName: string;
  category: string | null;
  participantCount: number;
  workshopA: { name: string; company: string | null; slotNumber: number; startTime: string; endTime: string } | null;
  workshopB: { name: string; company: string | null; slotNumber: number; startTime: string; endTime: string } | null;
  assignmentCount: number;
}

export default function AdminWorkshopTeamOverview() {
  const { eventId } = useParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch event
  const { data: event } = useQuery({
    queryKey: ['admin-event', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data } = await supabase
        .from('events')
        .select('id, name, date')
        .eq('id', eventId)
        .single();
      return data;
    },
    enabled: !!eventId,
  });

  // Fetch teams overview data
  const { data: teamsOverview, isLoading } = useQuery({
    queryKey: ['workshop-teams-overview', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      // 1. Get all registered user_ids for this event (without depending on team_id)
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select('user_id')
        .eq('event_id', eventId)
        .neq('registration_status', 'cancelled')
        .not('user_id', 'is', null);

      if (regError) throw regError;

      const registeredUserIds = [...new Set(registrations?.map(r => r.user_id).filter(Boolean) as string[])];
      if (registeredUserIds.length === 0) return [];

      // 2. Find which teams these users belong to via team_members
      const { data: teamMemberships, error: tmError } = await supabase
        .from('team_members')
        .select('team_id, user_id')
        .in('user_id', registeredUserIds)
        .eq('member_type', 'participant');

      if (tmError) throw tmError;

      // Group by team and count registered participants
      const teamParticipants = new Map<string, Set<string>>();
      teamMemberships?.forEach(tm => {
        if (tm.team_id && tm.user_id) {
          if (!teamParticipants.has(tm.team_id)) teamParticipants.set(tm.team_id, new Set());
          teamParticipants.get(tm.team_id)!.add(tm.user_id);
        }
      });

      const teamIds = Array.from(teamParticipants.keys());
      if (teamIds.length === 0) return [];

      // 3. Get team details
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, category')
        .in('id', teamIds);

      if (teamsError) throw teamsError;

      // 4. Get all assignments for this event with workshop and time slot info
      const { data: assignments, error: assignError } = await supabase
        .from('workshop_assignments')
        .select(`
          team_id,
          assignment_slot,
          workshop:workshops(id, name, company),
          time_slot:workshop_time_slots(slot_number, start_time, end_time)
        `)
        .eq('event_id', eventId);

      if (assignError) throw assignError;

      // Group assignments by team
      const assignmentsByTeam = new Map<string, typeof assignments>();
      assignments?.forEach(a => {
        if (a.team_id) {
          const existing = assignmentsByTeam.get(a.team_id) || [];
          assignmentsByTeam.set(a.team_id, [...existing, a]);
        }
      });

      // 4. Build overview rows
      const rows: TeamOverviewRow[] = (teams || []).map(team => {
        const teamAssignments = assignmentsByTeam.get(team.id) || [];
        const assignmentA = teamAssignments.find(a => a.assignment_slot === 'A');
        const assignmentB = teamAssignments.find(a => a.assignment_slot === 'B');

        return {
          teamId: team.id,
          teamName: team.name,
          category: team.category,
          participantCount: teamParticipants.get(team.id)?.size || 0,
          workshopA: assignmentA ? {
            name: (assignmentA.workshop as any)?.name || '',
            company: (assignmentA.workshop as any)?.company || null,
            slotNumber: (assignmentA.time_slot as any)?.slot_number || 0,
            startTime: (assignmentA.time_slot as any)?.start_time || '',
            endTime: (assignmentA.time_slot as any)?.end_time || '',
          } : null,
          workshopB: assignmentB ? {
            name: (assignmentB.workshop as any)?.name || '',
            company: (assignmentB.workshop as any)?.company || null,
            slotNumber: (assignmentB.time_slot as any)?.slot_number || 0,
            startTime: (assignmentB.time_slot as any)?.start_time || '',
            endTime: (assignmentB.time_slot as any)?.end_time || '',
          } : null,
          assignmentCount: teamAssignments.length,
        };
      });

      // Sort: unassigned first, then partial, then complete
      rows.sort((a, b) => {
        if (a.assignmentCount !== b.assignmentCount) return a.assignmentCount - b.assignmentCount;
        return a.teamName.localeCompare(b.teamName);
      });

      return rows;
    },
    enabled: !!eventId,
  });

  // Stats
  const totalTeams = teamsOverview?.length || 0;
  const completeTeams = teamsOverview?.filter(t => t.assignmentCount >= 2).length || 0;
  const partialTeams = teamsOverview?.filter(t => t.assignmentCount === 1).length || 0;
  const unassignedTeams = teamsOverview?.filter(t => t.assignmentCount === 0).length || 0;

  // Filtered teams
  const filteredTeams = teamsOverview?.filter(t => {
    if (statusFilter === 'complete') return t.assignmentCount >= 2;
    if (statusFilter === 'partial') return t.assignmentCount === 1;
    if (statusFilter === 'unassigned') return t.assignmentCount === 0;
    return true;
  }) || [];

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case 'beginner': return 'Beginner';
      case 'junior': return 'Junior';
      case 'senior': return 'Senior';
      default: return '—';
    }
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'beginner': return 'bg-blue-100 text-blue-800';
      case 'junior': return 'bg-purple-100 text-purple-800';
      case 'senior': return 'bg-orange-100 text-orange-800';
      default: return '';
    }
  };

  const getStatusBadge = (count: number) => {
    if (count >= 2) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Completo
        </Badge>
      );
    }
    if (count === 1) {
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Parcial
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        <XCircle className="mr-1 h-3 w-3" />
        Sin asignar
      </Badge>
    );
  };

  const formatSlotInfo = (workshop: TeamOverviewRow['workshopA']) => {
    if (!workshop) return null;
    return (
      <div className="text-sm">
        <span className="font-medium">{workshop.name}</span>
        {workshop.company && (
          <span className="text-muted-foreground"> ({workshop.company})</span>
        )}
        <div className="text-xs text-muted-foreground">
          Turno {workshop.slotNumber}
          {workshop.startTime && (
            <> • {workshop.startTime.slice(0, 5)}-{workshop.endTime.slice(0, 5)}</>
          )}
        </div>
      </div>
    );
  };

  const handleExportCSV = () => {
    if (!teamsOverview?.length) return;

    const rows = teamsOverview.map(t => [
      t.teamName,
      getCategoryLabel(t.category),
      t.participantCount.toString(),
      t.workshopA ? `${t.workshopA.name} (Turno ${t.workshopA.slotNumber})` : '',
      t.workshopB ? `${t.workshopB.name} (Turno ${t.workshopB.slotNumber})` : '',
      t.assignmentCount >= 2 ? 'Completo' : t.assignmentCount === 1 ? 'Parcial' : 'Sin asignar',
    ]);

    const csvContent = [
      ['Equipo', 'Categoría', 'Participantes', 'Taller A', 'Taller B', 'Estado'],
      ...rows,
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `equipos-talleres-${event?.name || 'evento'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Equipos y Talleres">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/admin/events/${eventId}/edit`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6" />
                Equipos y Talleres Asignados
              </h1>
              <p className="text-muted-foreground">{event?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExportCSV} disabled={!teamsOverview?.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{totalTeams}</div>
                <div className="text-sm text-muted-foreground">Total equipos</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-700">{completeTeams}</div>
                <div className="text-sm text-green-600 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  2 talleres
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-700">{partialTeams}</div>
                <div className="text-sm text-amber-600 flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  1 taller
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-700">{unassignedTeams}</div>
                <div className="text-sm text-red-600 flex items-center justify-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Sin asignar
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Detalle por equipo</CardTitle>
                <CardDescription>
                  {filteredTeams.length} de {totalTeams} equipos
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los equipos</SelectItem>
                  <SelectItem value="complete">Completos (2 talleres)</SelectItem>
                  <SelectItem value="partial">Parciales (1 taller)</SelectItem>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredTeams.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-center">Part.</TableHead>
                      <TableHead>Taller A</TableHead>
                      <TableHead>Taller B</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeams.map((team) => (
                      <TableRow key={team.teamId}>
                        <TableCell className="font-medium">{team.teamName}</TableCell>
                        <TableCell>
                          {team.category && (
                            <Badge variant="outline" className={getCategoryColor(team.category)}>
                              {getCategoryLabel(team.category)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{team.participantCount}</TableCell>
                        <TableCell>
                          {team.workshopA ? formatSlotInfo(team.workshopA) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {team.workshopB ? formatSlotInfo(team.workshopB) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(team.assignmentCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {totalTeams === 0 ? (
                  <>
                    <p className="font-medium">No hay equipos inscritos</p>
                    <p className="text-sm mt-1">
                      Aún no hay equipos registrados para este evento.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">No hay equipos con este filtro</p>
                    <p className="text-sm mt-1">
                      Cambia el filtro para ver otros equipos.
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
