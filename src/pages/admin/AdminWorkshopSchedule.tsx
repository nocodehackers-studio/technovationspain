import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkshopTimeSlots } from '@/hooks/useWorkshopTimeSlots';
import { useEventTeams } from '@/hooks/useEventTeams';
import { useWorkshopAssignment } from '@/hooks/useWorkshopAssignment';
import { useAuth } from '@/hooks/useAuth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Calendar, Download, Users, Layers, Loader2, X, Plus, AlertTriangle } from 'lucide-react';

interface ManualAssignmentState {
  workshopA?: string;
  slotA?: string;
  workshopB?: string;
  slotB?: string;
}

export default function AdminWorkshopSchedule() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('talleres');
  const [manualSelections, setManualSelections] = useState<Record<string, ManualAssignmentState>>({});
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null);
  // State for "Por Talleres" add-team selects: key = `${workshopId}-${slotId}`
  const [workshopAddTeam, setWorkshopAddTeam] = useState<Record<string, { teamId: string; assignmentSlot: 'A' | 'B' }>>({});
  const [addingToWorkshop, setAddingToWorkshop] = useState<string | null>(null);
  const [removingAssignment, setRemovingAssignment] = useState<string | null>(null);
  const { timeSlots, isLoading: timeSlotsLoading } = useWorkshopTimeSlots(eventId || '');

  const {
    workshops,
    timeSlots: assignmentTimeSlots,
    manualAssign,
    removeAssignment,
    isAssigning,
  } = useWorkshopAssignment(eventId || '');

  // Use assignmentTimeSlots as fallback if timeSlots from the other hook
  const availableTimeSlots = timeSlots || assignmentTimeSlots || [];

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

  // Fetch workshops (for schedule view)
  const { data: workshopsData, isLoading: workshopsLoading } = useQuery({
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

  const allWorkshops = workshopsData || workshops || [];

  const isLoading = timeSlotsLoading || workshopsLoading || assignmentsLoading || teamsLoading;

  // === WORKSHOP VIEW DATA ===
  const scheduleBySlot = availableTimeSlots?.map(slot => {
    const slotAssignments = assignments?.filter(
      a => (a.time_slot as any)?.id === slot.id
    ) || [];

    const workshopGroups = allWorkshops?.map(workshop => {
      const workshopAssignments = slotAssignments.filter(
        a => (a.workshop as any)?.id === (workshop as any).id
      );
      return {
        workshop,
        teams: workshopAssignments.map(a => ({
          id: (a.team as any)?.id,
          name: (a.team as any)?.name,
          category: (a.team as any)?.category,
          slot: a.assignment_slot as 'A' | 'B',
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
            workshopId: (assignment.workshop as any)?.id || '',
            workshopName: (assignment.workshop as any)?.name || '',
            workshopCompany: (assignment.workshop as any)?.company || '',
            workshopLocation: (assignment.workshop as any)?.location || '',
            timeSlotId: (assignment.time_slot as any)?.id || '',
            turnoNumber: (assignment.time_slot as any)?.slot_number,
            turnoTime: `${(assignment.time_slot as any)?.start_time?.slice(0, 5)} – ${(assignment.time_slot as any)?.end_time?.slice(0, 5)}`,
            preferenceMatched: assignment.preference_matched,
            assignmentType: assignment.assignment_type || 'algorithm',
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
    const validatedTeams = teamsWithAssignments.filter(t => t.assignmentCount > 0 || t.validated);
    const total = validatedTeams.length;
    const complete = validatedTeams.filter(t => t.assignmentCount === 2).length;
    const partial = validatedTeams.filter(t => t.assignmentCount === 1).length;
    const unassigned = validatedTeams.filter(t => t.assignmentCount === 0).length;
    return { total, complete, partial, unassigned };
  }, [teamsWithAssignments]);

  // === CAPACITY WARNINGS ===
  const capacityWarnings = useMemo(() => {
    if (!assignments || !allWorkshops || !allTeams) return new Map<string, { count: number; max: number }>();

    const warnings = new Map<string, { count: number; max: number }>();

    // Group assignments by workshop+timeSlot and count participants
    const occupancy = new Map<string, Set<string>>();
    assignments.forEach(a => {
      const wId = (a.workshop as any)?.id;
      const tsId = (a.time_slot as any)?.id;
      const tId = (a.team as any)?.id;
      if (!wId || !tsId || !tId) return;
      const key = `${wId}-${tsId}`;
      if (!occupancy.has(key)) occupancy.set(key, new Set());
      occupancy.get(key)!.add(tId);
    });

    // Build participant count map from allTeams
    const teamSizeMap = new Map(allTeams.map(t => [t.id, t.participantCount]));

    occupancy.forEach((teamIds, key) => {
      const workshopId = key.split('-')[0];
      const ws = allWorkshops.find((w: any) => w.id === workshopId) as any;
      if (!ws?.max_capacity) return;

      let totalParticipants = 0;
      teamIds.forEach(tid => {
        totalParticipants += teamSizeMap.get(tid) || 1;
      });

      if (totalParticipants > ws.max_capacity) {
        warnings.set(key, { count: totalParticipants, max: ws.max_capacity });
      }
    });

    return warnings;
  }, [assignments, allWorkshops, allTeams]);

  // === CONFLICT WARNINGS (same workshop or same time slot in both slots) ===
  const conflictWarnings = useMemo(() => {
    const conflicts: { teamId: string; teamName: string; type: string }[] = [];
    if (!assignments) return conflicts;

    // Group by team
    const byTeam = new Map<string, typeof assignments>();
    assignments.forEach(a => {
      const tid = (a.team as any)?.id;
      if (!tid) return;
      if (!byTeam.has(tid)) byTeam.set(tid, []);
      byTeam.get(tid)!.push(a);
    });

    byTeam.forEach((teamAssignments, teamId) => {
      if (teamAssignments.length !== 2) return;
      const [a1, a2] = teamAssignments;
      const teamName = (a1.team as any)?.name || teamId;

      if ((a1.workshop as any)?.id === (a2.workshop as any)?.id) {
        conflicts.push({ teamId, teamName, type: 'Mismo taller en ambos slots' });
      }
      if ((a1.time_slot as any)?.id === (a2.time_slot as any)?.id) {
        conflicts.push({ teamId, teamName, type: 'Mismo turno en ambos slots' });
      }
    });

    return conflicts;
  }, [assignments]);

  // === INLINE EDIT HANDLER ===
  const handleInlineChange = async (
    teamId: string,
    assignmentSlot: 'A' | 'B',
    field: 'workshop' | 'timeSlot',
    value: string,
    currentSlot: { workshopId: string; timeSlotId: string }
  ) => {
    if (!user?.id) return;

    const workshopId = field === 'workshop' ? value : currentSlot.workshopId;
    const timeSlotId = field === 'timeSlot' ? value : currentSlot.timeSlotId;

    try {
      await manualAssign({
        teamId,
        workshopId,
        timeSlotId,
        assignmentSlot,
        userId: user.id,
      });
      // Refetch assignments for this view
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments-full', eventId] });
    } catch (error) {
      // Error handled in hook via toast
    }
  };

  // === MANUAL ASSIGNMENT FOR UNASSIGNED TEAMS ===
  const updateManualSelection = (teamId: string, field: keyof ManualAssignmentState, value: string) => {
    setManualSelections(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: value },
    }));
  };

  const canAssignTeam = (teamId: string) => {
    const sel = manualSelections[teamId];
    if (!sel) return false;
    return (sel.workshopA && sel.slotA) || (sel.workshopB && sel.slotB);
  };

  const handleManualAssign = async (teamId: string) => {
    if (!user?.id) return;
    const selection = manualSelections[teamId];
    if (!selection) return;

    setAssigningTeamId(teamId);
    try {
      if (selection.workshopA && selection.slotA) {
        await manualAssign({
          teamId,
          workshopId: selection.workshopA,
          timeSlotId: selection.slotA,
          assignmentSlot: 'A',
          userId: user.id,
        });
      }
      if (selection.workshopB && selection.slotB) {
        await manualAssign({
          teamId,
          workshopId: selection.workshopB,
          timeSlotId: selection.slotB,
          assignmentSlot: 'B',
          userId: user.id,
        });
      }
      setManualSelections(prev => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments-full', eventId] });
    } catch (error) {
      // Error handled in hook via toast
    } finally {
      setAssigningTeamId(null);
    }
  };

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

    const csvRows = [
      ['Taller', 'Empresa', 'Sala', 'Equipos'],
      ...rows,
    ].map(row => row.map(cell => {
      const strVal = String(cell);
      if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
        return `"${strVal.replace(/"/g, '""')}"`;
      }
      return strVal;
    }).join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvRows], { type: 'text/csv;charset=utf-8;' });
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

    const csvRows = [
      ['Equipo', 'Categoría', 'Asignaciones', 'Taller A', 'Turno A', 'Horario A', 'Taller B', 'Turno B', 'Horario B'],
      ...rows,
    ].map(row => row.map(cell => {
      const strVal = String(cell);
      if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
        return `"${strVal.replace(/"/g, '""')}"`;
      }
      return strVal;
    }).join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `equipos-talleres-${event?.name || 'evento'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper: render slot assignment with inline editing
  // === WORKSHOP VIEW: Add team to workshop ===
  const handleAddTeamToWorkshop = async (workshopId: string, timeSlotId: string) => {
    if (!user?.id) return;
    const key = `${workshopId}-${timeSlotId}`;
    const selection = workshopAddTeam[key];
    if (!selection?.teamId) return;

    setAddingToWorkshop(key);
    try {
      await manualAssign({
        teamId: selection.teamId,
        workshopId,
        timeSlotId,
        assignmentSlot: selection.assignmentSlot,
        userId: user.id,
      });
      setWorkshopAddTeam(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments-full', eventId] });
    } catch {
      // Error handled in hook via toast
    } finally {
      setAddingToWorkshop(null);
    }
  };

  const handleRemoveTeamFromWorkshop = async (teamId: string, assignmentSlot: 'A' | 'B') => {
    const key = `${teamId}-${assignmentSlot}`;
    setRemovingAssignment(key);
    try {
      await removeAssignment({ teamId, assignmentSlot });
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments-full', eventId] });
    } catch {
      // Error handled in hook via toast
    } finally {
      setRemovingAssignment(null);
    }
  };

  // Teams available for assignment (validated, not fully assigned)
  const availableTeamsForWorkshop = useMemo(() => {
    if (!allTeams) return [];
    return allTeams.filter(t => {
      if (!t.validated) return false;
      // Check how many assignments this team already has
      const teamAssignments = assignments?.filter(a => (a.team as any)?.id === t.id) || [];
      return teamAssignments.length < 2;
    });
  }, [allTeams, assignments]);

  // Get which slots are available for a team
  const getAvailableSlots = (teamId: string): ('A' | 'B')[] => {
    const teamAssignments = assignments?.filter(a => (a.team as any)?.id === teamId) || [];
    const usedSlots = teamAssignments.map(a => a.assignment_slot);
    const slots: ('A' | 'B')[] = [];
    if (!usedSlots.includes('A')) slots.push('A');
    if (!usedSlots.includes('B')) slots.push('B');
    return slots;
  };

  const renderSlotEditor = (
    team: (typeof teamsWithAssignments)[0],
    slotLabel: 'A' | 'B',
    slotData: (typeof teamsWithAssignments)[0]['slotA']
  ) => {
    if (slotData) {
      // Has assignment — show inline editable selects
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={slotData.workshopId}
            onValueChange={(val) =>
              handleInlineChange(team.id, slotLabel, 'workshop', val, {
                workshopId: slotData.workshopId,
                timeSlotId: slotData.timeSlotId,
              })
            }
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allWorkshops.map(w => (
                <SelectItem key={(w as any).id} value={(w as any).id} className="text-xs">
                  {(w as any).name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={slotData.timeSlotId}
            onValueChange={(val) =>
              handleInlineChange(team.id, slotLabel, 'timeSlot', val, {
                workshopId: slotData.workshopId,
                timeSlotId: slotData.timeSlotId,
              })
            }
          >
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableTimeSlots.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  Turno {s.slot_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {slotData.preferenceMatched && (
            <span className="text-xs text-muted-foreground">
              Pref #{slotData.preferenceMatched}
            </span>
          )}
          {slotData.assignmentType === 'manual' && (
            <Badge variant="outline" className="text-[10px] h-5">Manual</Badge>
          )}
        </div>
      );
    }

    // No assignment — show selects for manual assignment
    const sel = manualSelections[team.id] || {};
    const workshopKey = slotLabel === 'A' ? 'workshopA' : 'workshopB';
    const slotKey = slotLabel === 'A' ? 'slotA' : 'slotB';

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={sel[workshopKey] || ''}
          onValueChange={(val) => updateManualSelection(team.id, workshopKey, val)}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Seleccionar taller" />
          </SelectTrigger>
          <SelectContent>
            {allWorkshops.map(w => (
              <SelectItem key={(w as any).id} value={(w as any).id} className="text-xs">
                {(w as any).name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sel[slotKey] || ''}
          onValueChange={(val) => updateManualSelection(team.id, slotKey, val)}
        >
          <SelectTrigger className="w-[100px] h-8 text-xs">
            <SelectValue placeholder="Turno" />
          </SelectTrigger>
          <SelectContent>
            {availableTimeSlots.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                Turno {s.slot_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
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

        {/* Warnings */}
        {(capacityWarnings.size > 0 || conflictWarnings.length > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Incompatibilidades detectadas
            </div>
            {capacityWarnings.size > 0 && (
              <div className="space-y-1">
                {Array.from(capacityWarnings.entries()).map(([key, { count, max }]) => {
                  const [workshopId, timeSlotId] = key.split('-');
                  const ws = allWorkshops.find((w: any) => w.id === workshopId) as any;
                  const ts = availableTimeSlots.find(s => s.id === timeSlotId);
                  return (
                    <p key={key}>
                      • <strong>{ws?.name}</strong> en Turno {ts?.slot_number}: {count}/{max} participantes (excede capacidad)
                    </p>
                  );
                })}
              </div>
            )}
            {conflictWarnings.map((c, i) => (
              <p key={i}>
                • <strong>{c.teamName}</strong>: {c.type}
              </p>
            ))}
          </div>
        )}

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

          {/* === WORKSHOPS VIEW === */}
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
                              {(() => {
                                const wKey = `${(workshop as any).id}-${slot.id}`;
                                const warning = capacityWarnings.get(wKey);
                                const maxCap = (workshop as any).max_capacity;
                                return (
                                  <div className="flex items-center gap-2">
                                    {warning && (
                                      <AlertTriangle className="h-4 w-4 text-red-500" />
                                    )}
                                    <Badge variant={warning ? 'destructive' : 'outline'}>
                                      {teams.length} equipos{maxCap ? ` (cap. ${maxCap})` : ''}
                                    </Badge>
                                  </div>
                                );
                              })()}
                            </div>

                            {teams.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {teams.map((team) => {
                                  const removeKey = `${team.id}-${team.slot}`;
                                  const isRemoving = removingAssignment === removeKey;
                                  return (
                                    <Badge
                                      key={`${team.id}-${team.slot}`}
                                      variant="secondary"
                                      className="text-xs pr-1 flex items-center gap-1"
                                    >
                                      {team.name}
                                      {team.slot && (
                                        <span className="opacity-60">
                                          ({team.slot})
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleRemoveTeamFromWorkshop(team.id, team.slot)}
                                        disabled={isRemoving}
                                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                        title="Quitar equipo"
                                      >
                                        {isRemoving ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <X className="h-3 w-3" />
                                        )}
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic mb-3">
                                Sin equipos asignados
                              </p>
                            )}

                            {/* Add team selector */}
                            {(() => {
                              const workshopId = (workshop as any).id;
                              const key = `${workshopId}-${slot.id}`;
                              const selection = workshopAddTeam[key];
                              const isAdding = addingToWorkshop === key;
                              return (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Select
                                    value={selection?.teamId || ''}
                                    onValueChange={(val) => {
                                      const slots = getAvailableSlots(val);
                                      setWorkshopAddTeam(prev => ({
                                        ...prev,
                                        [key]: { teamId: val, assignmentSlot: slots[0] || 'A' },
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="w-[180px] h-8 text-xs">
                                      <SelectValue placeholder="Añadir equipo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableTeamsForWorkshop.map(t => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">
                                          {t.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {selection?.teamId && (
                                    <Select
                                      value={selection.assignmentSlot}
                                      onValueChange={(val) =>
                                        setWorkshopAddTeam(prev => ({
                                          ...prev,
                                          [key]: { ...prev[key], assignmentSlot: val as 'A' | 'B' },
                                        }))
                                      }
                                    >
                                      <SelectTrigger className="w-[80px] h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getAvailableSlots(selection.teamId).map(s => (
                                          <SelectItem key={s} value={s} className="text-xs">
                                            Slot {s}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {selection?.teamId && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() => handleAddTeamToWorkshop(workshopId, slot.id)}
                                      disabled={isAdding}
                                    >
                                      {isAdding ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Plus className="h-3 w-3 mr-1" />
                                      )}
                                      Asignar
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}
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

          {/* === TEAMS VIEW with inline editing === */}
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

                {/* Teams List with inline editing */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {teamsWithAssignments
                      .filter(team => team.assignmentCount > 0 || team.validated)
                      .map(team => {
                        const isUnassigned = team.assignmentCount === 0;
                        const isPartial = team.assignmentCount === 1;
                        const isAssigningThis = assigningTeamId === team.id;
                        const canAssign = canAssignTeam(team.id);

                        return (
                          <div
                            key={team.id}
                            className="p-4 border rounded-lg"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
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
                              {/* Show Assign button for unassigned/partial teams with selections */}
                              {(isUnassigned || isPartial) && canAssign && (
                                <Button
                                  size="sm"
                                  onClick={() => handleManualAssign(team.id)}
                                  disabled={isAssigningThis}
                                >
                                  {isAssigningThis ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Asignar'
                                  )}
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              {/* Slot A */}
                              <div className="flex items-start gap-2">
                                <Badge variant="outline" className="text-xs shrink-0 mt-1">A</Badge>
                                {renderSlotEditor(team, 'A', team.slotA)}
                              </div>
                              {/* Slot B */}
                              <div className="flex items-start gap-2">
                                <Badge variant="outline" className="text-xs shrink-0 mt-1">B</Badge>
                                {renderSlotEditor(team, 'B', team.slotB)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
