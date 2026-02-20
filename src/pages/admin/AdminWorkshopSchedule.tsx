import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkshopTimeSlots } from '@/hooks/useWorkshopTimeSlots';
import { useEventTeams } from '@/hooks/useEventTeams';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, Download, Users, Layers } from 'lucide-react';

export default function AdminWorkshopSchedule() {
  const { eventId } = useParams();
  const [activeTab, setActiveTab] = useState('talleres');
  const { timeSlots, isLoading: timeSlotsLoading } = useWorkshopTimeSlots(eventId || '');

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

  // Fetch workshops
  const { data: workshops, isLoading: workshopsLoading } = useQuery({
    queryKey: ['event-workshops', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('event_id', eventId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Fetch assignments with teams
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['workshop-assignments-full', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_assignments')
        .select(`
          *,
          team:teams(id, name, category),
          workshop:workshops(id, name, company, location),
          time_slot:workshop_time_slots(id, slot_number, start_time, end_time)
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Fetch all teams registered for the event
  const { data: allTeams, isLoading: teamsLoading } = useEventTeams(eventId || '');

  const isLoading = timeSlotsLoading || workshopsLoading || assignmentsLoading || teamsLoading;

  // === WORKSHOP VIEW DATA ===
  const scheduleBySlot = timeSlots?.map(slot => {
    const slotAssignments = assignments?.filter(
      a => (a.time_slot as any)?.id === slot.id
    ) || [];

    const workshopGroups = workshops?.map(workshop => {
      const workshopAssignments = slotAssignments.filter(
        a => (a.workshop as any)?.id === workshop.id
      );
      return {
        workshop,
        teams: workshopAssignments.map(a => ({
          id: (a.team as any)?.id,
          name: (a.team as any)?.name,
          category: (a.team as any)?.category,
          slot: a.assignment_slot,
        })),
      };
    }) || [];

    return {
      slot,
      workshops: workshopGroups,
    };
  }) || [];

  // === TEAMS VIEW DATA ===
  const teamsWithAssignments = useMemo(() => {
    if (!allTeams) return [];

    return allTeams
      .map(team => {
        const teamAssignments = assignments?.filter(
          a => (a.team as any)?.id === team.id
        ) || [];
        const slotA = teamAssignments.find(a => a.assignment_slot === 'A');
        const slotB = teamAssignments.find(a => a.assignment_slot === 'B');
        const assignmentCount = teamAssignments.length;

        const formatSlot = (assignment: typeof slotA) => {
          if (!assignment) return null;
          return {
            workshopName: (assignment.workshop as any)?.name || '',
            workshopCompany: (assignment.workshop as any)?.company || '',
            workshopLocation: (assignment.workshop as any)?.location || '',
            turnoNumber: (assignment.time_slot as any)?.slot_number,
            turnoTime: `${(assignment.time_slot as any)?.start_time?.slice(0, 5)} – ${(assignment.time_slot as any)?.end_time?.slice(0, 5)}`,
            preferenceMatched: assignment.preference_matched,
          };
        };

        return {
          ...team,
          assignmentCount,
          slotA: formatSlot(slotA),
          slotB: formatSlot(slotB),
        };
      })
      .sort((a, b) => a.assignmentCount - b.assignmentCount);
  }, [allTeams, assignments]);

  const teamStats = useMemo(() => {
    const total = teamsWithAssignments.length;
    const complete = teamsWithAssignments.filter(t => t.assignmentCount === 2).length;
    const partial = teamsWithAssignments.filter(t => t.assignmentCount === 1).length;
    const unassigned = teamsWithAssignments.filter(t => t.assignmentCount === 0).length;
    return { total, complete, partial, unassigned };
  }, [teamsWithAssignments]);

  // === CSV EXPORTS ===
  const handleExportWorkshopsCSV = () => {
    if (!scheduleBySlot.length) return;

    const rows: string[][] = [];

    scheduleBySlot.forEach(({ slot, workshops }) => {
      rows.push([
        `TURNO ${slot.slot_number}`,
        `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`,
        '',
        '',
      ]);

      workshops.forEach(({ workshop, teams }) => {
        if (teams.length > 0) {
          rows.push([
            (workshop as any).name,
            (workshop as any).company || '',
            (workshop as any).location || '',
            teams.map(t => t.name).join(', '),
          ]);
        }
      });

      rows.push(['', '', '', '']);
    });

    const csvContent = [
      ['Taller', 'Empresa', 'Sala', 'Equipos'],
      ...rows,
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cuadrante-talleres-${event?.name || 'evento'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTeamsCSV = () => {
    if (!teamsWithAssignments.length) return;

    const rows = teamsWithAssignments.map(team => [
      team.name,
      team.category || '',
      String(team.assignmentCount),
      team.slotA?.workshopName || 'Sin asignar',
      team.slotA ? `Turno ${team.slotA.turnoNumber}` : '',
      team.slotA?.turnoTime || '',
      team.slotB?.workshopName || 'Sin asignar',
      team.slotB ? `Turno ${team.slotB.turnoNumber}` : '',
      team.slotB?.turnoTime || '',
    ]);

    const csvContent = [
      ['Equipo', 'Categoría', 'Asignaciones', 'Taller A', 'Turno A', 'Horario A', 'Taller B', 'Turno B', 'Horario B'],
      ...rows,
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `equipos-talleres-${event?.name || 'evento'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Cuadrante de Talleres">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/workshops">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                Cuadrante de Talleres
              </h1>
              <p className="text-muted-foreground">{event?.name}</p>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          ⚠️ Esta información es confidencial. No compartir con mentores ni participantes antes del evento.
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="talleres" className="gap-2">
                <Layers className="h-4 w-4" />
                Por Talleres
              </TabsTrigger>
              <TabsTrigger value="equipos" className="gap-2">
                <Users className="h-4 w-4" />
                Por Equipos
                {teamStats.total > 0 && (
                  <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                    {teamStats.total}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              onClick={activeTab === 'talleres' ? handleExportWorkshopsCSV : handleExportTeamsCSV}
              disabled={activeTab === 'talleres' ? !assignments?.length : !teamsWithAssignments.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {/* === WORKSHOPS VIEW (existing) === */}
          <TabsContent value="talleres">
            {isLoading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-64 w-full" />
                ))}
              </div>
            ) : scheduleBySlot.length > 0 ? (
              <div className="space-y-6">
                {scheduleBySlot.map(({ slot, workshops }) => (
                  <Card key={slot.id}>
                    <div className="bg-muted/50 p-6">
                      <CardTitle className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          Turno {slot.slot_number}
                        </Badge>
                        <span className="font-mono">
                          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                        </span>
                      </CardTitle>
                    </div>
                    <CardContent className="pt-4">
                      <div className="grid gap-4">
                        {workshops.map(({ workshop, teams }) => (
                          <div
                            key={(workshop as any).id}
                            className="p-4 border rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium">{(workshop as any).name}</h4>
                                <div className="text-sm text-muted-foreground">
                                  {(workshop as any).company && (
                                    <span>{(workshop as any).company}</span>
                                  )}
                                  {(workshop as any).location && (
                                    <span> • {(workshop as any).location}</span>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline">
                                {teams.length} equipos
                              </Badge>
                            </div>

                            {teams.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {teams.map((team) => (
                                  <Badge
                                    key={team.id}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {team.name}
                                    {team.slot && (
                                      <span className="ml-1 opacity-60">
                                        ({team.slot})
                                      </span>
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                Sin equipos asignados
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No hay asignaciones todavía</p>
                    <p className="text-sm mt-1">
                      Ejecuta el algoritmo de asignación para generar el cuadrante.
                    </p>
                    <Button className="mt-4" asChild>
                      <Link to={`/admin/events/${eventId}/workshops/assign`}>
                        Ir a Asignación
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* === TEAMS VIEW (new) === */}
          <TabsContent value="equipos">
            {isLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64 w-full" />
              </div>
            ) : teamsWithAssignments.length > 0 ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{teamStats.complete}</div>
                      <div className="text-sm text-muted-foreground">Completos (2 talleres)</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">{teamStats.partial}</div>
                      <div className="text-sm text-muted-foreground">Parcial (1 taller)</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{teamStats.unassigned}</div>
                      <div className="text-sm text-muted-foreground">Sin asignar (0 talleres)</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Teams List */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {teamsWithAssignments.map(team => (
                        <div
                          key={team.id}
                          className="p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-medium">{team.name}</h4>
                            {team.category && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {team.category}
                              </Badge>
                            )}
                            <Badge
                              variant={team.assignmentCount === 0 ? 'destructive' : 'secondary'}
                              className={
                                team.assignmentCount === 2
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : team.assignmentCount === 1
                                  ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                  : ''
                              }
                            >
                              {team.assignmentCount}/2 talleres
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {/* Slot A */}
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="text-xs shrink-0 mt-0.5">A</Badge>
                              {team.slotA ? (
                                <div>
                                  <span className="font-medium">{team.slotA.workshopName}</span>
                                  <span className="text-muted-foreground ml-1">
                                    (Turno {team.slotA.turnoNumber} · {team.slotA.turnoTime})
                                  </span>
                                  {team.slotA.preferenceMatched && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      — Pref. #{team.slotA.preferenceMatched}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="italic text-muted-foreground">Sin asignar</span>
                              )}
                            </div>
                            {/* Slot B */}
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="text-xs shrink-0 mt-0.5">B</Badge>
                              {team.slotB ? (
                                <div>
                                  <span className="font-medium">{team.slotB.workshopName}</span>
                                  <span className="text-muted-foreground ml-1">
                                    (Turno {team.slotB.turnoNumber} · {team.slotB.turnoTime})
                                  </span>
                                  {team.slotB.preferenceMatched && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      — Pref. #{team.slotB.preferenceMatched}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="italic text-muted-foreground">Sin asignar</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No hay equipos registrados</p>
                    <p className="text-sm mt-1">
                      Los equipos aparecerán aquí cuando se registren al evento.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
