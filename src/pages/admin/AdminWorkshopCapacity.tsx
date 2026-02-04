import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkshopTimeSlots } from '@/hooks/useWorkshopTimeSlots';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BarChart3 } from 'lucide-react';

export default function AdminWorkshopCapacity() {
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

  // Fetch assignments with participant counts
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['workshop-assignments-with-counts', eventId],
    queryFn: async () => {
      // Get all assignments
      const { data: assignmentData, error: assignError } = await supabase
        .from('workshop_assignments')
        .select(`
          workshop_id,
          time_slot_id,
          team:teams(id, name)
        `)
        .eq('event_id', eventId);
      
      if (assignError) throw assignError;

      // Get participant counts from registrations
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select('team_id, participant_count')
        .eq('event_id', eventId)
        .not('team_id', 'is', null);

      if (regError) throw regError;

      // Create participant count map by team
      const teamCounts = new Map<string, number>();
      registrations?.forEach(reg => {
        if (reg.team_id) {
          teamCounts.set(
            reg.team_id, 
            (teamCounts.get(reg.team_id) || 0) + (reg.participant_count || 1)
          );
        }
      });

      // Calculate occupancy per workshop/slot
      const occupancy: Record<string, Record<string, { teams: string[]; participants: number }>> = {};
      
      assignmentData?.forEach(assignment => {
        if (!occupancy[assignment.workshop_id]) {
          occupancy[assignment.workshop_id] = {};
        }
        if (!occupancy[assignment.workshop_id][assignment.time_slot_id]) {
          occupancy[assignment.workshop_id][assignment.time_slot_id] = { teams: [], participants: 0 };
        }
        
        const teamId = (assignment.team as any)?.id;
        const teamName = (assignment.team as any)?.name || 'Equipo';
        
        occupancy[assignment.workshop_id][assignment.time_slot_id].teams.push(teamName);
        occupancy[assignment.workshop_id][assignment.time_slot_id].participants += 
          teamCounts.get(teamId) || 1;
      });

      return occupancy;
    },
    enabled: !!eventId,
  });

  const isLoading = timeSlotsLoading || workshopsLoading || assignmentsLoading;

  const getOccupancyColor = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio >= 0.9) return 'bg-red-100 text-red-800 border-red-300';
    if (ratio >= 0.7) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getOccupancyIcon = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio >= 0.9) return '🔴';
    if (ratio >= 0.7) return '🟡';
    return '🟢';
  };

  return (
    <AdminLayout title="Ocupación de Talleres">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/admin/events/${eventId}/edit`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Ocupación de Talleres
            </h1>
            <p className="text-muted-foreground">{event?.name}</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Leyenda:</span>
          <span className="flex items-center gap-1">🟢 &lt; 70% ocupación</span>
          <span className="flex items-center gap-1">🟡 70-90% ocupación</span>
          <span className="flex items-center gap-1">🔴 &gt; 90% ocupación</span>
        </div>

        {/* Capacity Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Matriz de Ocupación</CardTitle>
            <CardDescription>
              Participantes asignados por taller y turno
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : workshops && workshops.length > 0 && timeSlots && timeSlots.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-3 border-b font-medium">Taller</th>
                      {timeSlots.map((slot) => (
                        <th key={slot.id} className="text-center p-3 border-b font-medium min-w-[120px]">
                          <div>Turno {slot.slot_number}</div>
                          <div className="text-xs font-normal text-muted-foreground">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workshops.map((workshop) => (
                      <tr key={workshop.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{workshop.name}</div>
                          {(workshop as any).company && (
                            <div className="text-xs text-muted-foreground">
                              {(workshop as any).company}
                            </div>
                          )}
                        </td>
                        {timeSlots.map((slot) => {
                          const slotData = assignments?.[workshop.id]?.[slot.id];
                          const current = slotData?.participants || 0;
                          const max = workshop.max_capacity;
                          
                          return (
                            <td key={slot.id} className="text-center p-3">
                              <div 
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getOccupancyColor(current, max)}`}
                              >
                                <span>{getOccupancyIcon(current, max)}</span>
                                <span className="font-mono font-medium">
                                  {current}/{max}
                                </span>
                              </div>
                              {slotData && slotData.teams.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {slotData.teams.length} equipos
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {!workshops?.length 
                  ? 'No hay talleres configurados para este evento.'
                  : 'No hay turnos horarios configurados.'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {workshops && timeSlots && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{workshops.length}</div>
                  <div className="text-sm text-muted-foreground">Talleres</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{timeSlots.length}</div>
                  <div className="text-sm text-muted-foreground">Turnos</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {workshops.reduce((sum, w) => sum + w.max_capacity, 0) * timeSlots.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Capacidad total</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
