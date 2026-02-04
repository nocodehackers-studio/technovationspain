import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkshopTimeSlots } from '@/hooks/useWorkshopTimeSlots';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calendar, Download } from 'lucide-react';

export default function AdminWorkshopSchedule() {
  const { eventId } = useParams();
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

  const isLoading = timeSlotsLoading || workshopsLoading || assignmentsLoading;

  // Group assignments by slot and workshop
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

  const handleExportCSV = () => {
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
      
      rows.push(['', '', '', '']); // Empty row between slots
    });

    const csvContent = [
      ['Taller', 'Empresa', 'Sala', 'Equipos'],
      ...rows,
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cuadrante-talleres-${event?.name || 'evento'}.csv`;
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
              <Link to={`/admin/events/${eventId}/edit`}>
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
          <Button variant="outline" onClick={handleExportCSV} disabled={!assignments?.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Info Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          ⚠️ Esta información es confidencial. No compartir con mentores ni participantes antes del evento.
        </div>

        {/* Schedule by Slot */}
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
                <CardHeader className="bg-muted/50">
                  <CardTitle className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      Turno {slot.slot_number}
                    </Badge>
                    <span className="font-mono">
                      {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                    </span>
                  </CardTitle>
                </CardHeader>
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
      </div>
    </AdminLayout>
  );
}
