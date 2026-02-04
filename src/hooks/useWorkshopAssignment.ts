import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WorkshopAssignment, WorkshopTimeSlot, Workshop } from '@/types/database';

interface TeamForAssignment {
  id: string;
  name: string;
  participantCount: number;
  registrationDate: string;
  preferences: { workshopId: string; order: number }[];
}

interface AssignmentResult {
  teamId: string;
  teamName: string;
  participantCount: number;
  workshopA: { workshopId: string; workshopName: string; slotNumber: number } | null;
  workshopB: { workshopId: string; workshopName: string; slotNumber: number } | null;
  preferenceMatchedA: number | null;
  preferenceMatchedB: number | null;
  errors: string[];
}

interface AssignmentStats {
  totalTeams: number;
  fullyAssigned: number;
  partiallyAssigned: number;
  unassigned: number;
  preferenceStats: { preference: number; count: number }[];
}

/**
 * Hook para el algoritmo de asignación de talleres
 */
export function useWorkshopAssignment(eventId: string) {
  const queryClient = useQueryClient();

  // Obtener talleres del evento
  const { data: workshops } = useQuery({
    queryKey: ['event-workshops', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('event_id', eventId)
        .order('name');
      
      if (error) throw error;
      return data as Workshop[];
    },
    enabled: !!eventId,
  });

  // Obtener turnos
  const { data: timeSlots } = useQuery({
    queryKey: ['workshop-time-slots', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_time_slots')
        .select('*')
        .eq('event_id', eventId)
        .order('slot_number');
      
      if (error) throw error;
      return data as WorkshopTimeSlot[];
    },
    enabled: !!eventId,
  });

  // Obtener asignaciones existentes
  const { data: existingAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['workshop-assignments', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_assignments')
        .select(`
          *,
          team:teams(id, name),
          workshop:workshops(id, name),
          time_slot:workshop_time_slots(id, slot_number, start_time, end_time)
        `)
        .eq('event_id', eventId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Algoritmo de asignación
  const runAssignmentMutation = useMutation({
    mutationFn: async ({ dryRun = false }: { dryRun?: boolean } = {}) => {
      if (!workshops || !timeSlots || timeSlots.length === 0) {
        throw new Error('Faltan talleres o turnos configurados');
      }

      // 1. Obtener equipos registrados con sus preferencias
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          team_id,
          participant_count,
          created_at,
          team:teams(id, name)
        `)
        .eq('event_id', eventId)
        .not('team_id', 'is', null)
        .order('created_at');

      if (regError) throw regError;

      // Agrupar por equipo (FIFO por primera inscripción)
      const teamsMap = new Map<string, TeamForAssignment>();
      registrations?.forEach(reg => {
        if (reg.team_id && reg.team) {
          const existing = teamsMap.get(reg.team_id);
          if (!existing) {
            teamsMap.set(reg.team_id, {
              id: reg.team_id,
              name: (reg.team as any).name,
              participantCount: reg.participant_count || 1,
              registrationDate: reg.created_at,
              preferences: [],
            });
          } else {
            existing.participantCount += reg.participant_count || 1;
          }
        }
      });

      // 2. Obtener preferencias
      const { data: allPreferences, error: prefError } = await supabase
        .from('workshop_preferences')
        .select('team_id, workshop_id, preference_order')
        .eq('event_id', eventId)
        .order('preference_order');

      if (prefError) throw prefError;

      allPreferences?.forEach(pref => {
        const team = teamsMap.get(pref.team_id);
        if (team) {
          team.preferences.push({
            workshopId: pref.workshop_id,
            order: pref.preference_order,
          });
        }
      });

      const teams = Array.from(teamsMap.values());

      // 3. Inicializar contadores de ocupación (participantes, no equipos)
      const workshopsMap = new Map(workshops.map(w => [w.id, w]));
      const slotsMap = new Map(timeSlots.map(s => [s.slot_number, s]));
      
      // occupancy[workshopId][slotNumber] = participantes actuales
      const occupancy: Record<string, Record<number, number>> = {};
      workshops.forEach(w => {
        occupancy[w.id] = {};
        timeSlots.forEach(s => {
          occupancy[w.id][s.slot_number] = 0;
        });
      });

      // 4. Resultados de asignación
      const results: AssignmentResult[] = teams.map(t => ({
        teamId: t.id,
        teamName: t.name,
        participantCount: t.participantCount,
        workshopA: null,
        workshopB: null,
        preferenceMatchedA: null,
        preferenceMatchedB: null,
        errors: [],
      }));

      // ============================================
      // FASE 1: Asignar Taller A
      // ============================================
      const maxPreference = workshops.length;

      for (let priorityLevel = 1; priorityLevel <= maxPreference; priorityLevel++) {
        for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
          const team = teams[teamIdx];
          const result = results[teamIdx];

          // Si ya tiene Taller A, saltar
          if (result.workshopA !== null) continue;

          // Encontrar qué taller tiene esta prioridad
          const pref = team.preferences.find(p => p.order === priorityLevel);
          if (!pref) continue;

          const workshop = workshopsMap.get(pref.workshopId);
          if (!workshop) continue;

          // Intentar asignar en algún turno
          for (const slot of timeSlots) {
            const currentOccupancy = occupancy[pref.workshopId][slot.slot_number];
            if (currentOccupancy + team.participantCount <= workshop.max_capacity) {
              occupancy[pref.workshopId][slot.slot_number] += team.participantCount;
              result.workshopA = {
                workshopId: pref.workshopId,
                workshopName: workshop.name,
                slotNumber: slot.slot_number,
              };
              result.preferenceMatchedA = priorityLevel;
              break;
            }
          }
        }
      }

      // ============================================
      // FASE 2: Asignar Taller B
      // ============================================
      for (let priorityLevel = 1; priorityLevel <= maxPreference; priorityLevel++) {
        for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
          const team = teams[teamIdx];
          const result = results[teamIdx];

          // Si ya tiene Taller B, saltar
          if (result.workshopB !== null) continue;

          // Encontrar qué taller tiene esta prioridad
          const pref = team.preferences.find(p => p.order === priorityLevel);
          if (!pref) continue;

          // No puede ser el mismo taller que A
          if (result.workshopA && pref.workshopId === result.workshopA.workshopId) continue;

          const workshop = workshopsMap.get(pref.workshopId);
          if (!workshop) continue;

          // Intentar asignar en turno DIFERENTE al de Taller A
          for (const slot of timeSlots) {
            // Evitar mismo turno que A
            if (result.workshopA && slot.slot_number === result.workshopA.slotNumber) continue;

            const currentOccupancy = occupancy[pref.workshopId][slot.slot_number];
            if (currentOccupancy + team.participantCount <= workshop.max_capacity) {
              occupancy[pref.workshopId][slot.slot_number] += team.participantCount;
              result.workshopB = {
                workshopId: pref.workshopId,
                workshopName: workshop.name,
                slotNumber: slot.slot_number,
              };
              result.preferenceMatchedB = priorityLevel;
              break;
            }
          }
        }
      }

      // ============================================
      // FASE 3: Validación
      // ============================================
      for (const result of results) {
        if (!result.workshopA) {
          result.errors.push('No se pudo asignar Taller A');
        }
        if (!result.workshopB) {
          result.errors.push('No se pudo asignar Taller B');
        }
        if (result.workshopA && result.workshopB) {
          if (result.workshopA.slotNumber === result.workshopB.slotNumber) {
            result.errors.push('Conflicto: mismo turno para A y B');
          }
          if (result.workshopA.workshopId === result.workshopB.workshopId) {
            result.errors.push('Conflicto: mismo taller para A y B');
          }
        }
      }

      // 5. Si no es dry run, guardar en BD
      if (!dryRun) {
        // Eliminar asignaciones existentes
        const { error: deleteError } = await supabase
          .from('workshop_assignments')
          .delete()
          .eq('event_id', eventId);

        if (deleteError) throw deleteError;

        // Insertar nuevas asignaciones
        const assignmentsToInsert: any[] = [];

        for (const result of results) {
          if (result.workshopA) {
            const slot = slotsMap.get(result.workshopA.slotNumber);
            if (slot) {
              assignmentsToInsert.push({
                team_id: result.teamId,
                event_id: eventId,
                workshop_id: result.workshopA.workshopId,
                time_slot_id: slot.id,
                assignment_slot: 'A',
                preference_matched: result.preferenceMatchedA,
                assignment_type: 'algorithm',
              });
            }
          }
          if (result.workshopB) {
            const slot = slotsMap.get(result.workshopB.slotNumber);
            if (slot) {
              assignmentsToInsert.push({
                team_id: result.teamId,
                event_id: eventId,
                workshop_id: result.workshopB.workshopId,
                time_slot_id: slot.id,
                assignment_slot: 'B',
                preference_matched: result.preferenceMatchedB,
                assignment_type: 'algorithm',
              });
            }
          }
        }

        if (assignmentsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('workshop_assignments')
            .insert(assignmentsToInsert);

          if (insertError) throw insertError;
        }
      }

      // Calcular estadísticas
      const stats: AssignmentStats = {
        totalTeams: results.length,
        fullyAssigned: results.filter(r => r.workshopA && r.workshopB).length,
        partiallyAssigned: results.filter(r => (r.workshopA && !r.workshopB) || (!r.workshopA && r.workshopB)).length,
        unassigned: results.filter(r => !r.workshopA && !r.workshopB).length,
        preferenceStats: [],
      };

      // Estadísticas de preferencias cumplidas
      const prefCounts: Record<number, number> = {};
      results.forEach(r => {
        if (r.preferenceMatchedA) {
          prefCounts[r.preferenceMatchedA] = (prefCounts[r.preferenceMatchedA] || 0) + 1;
        }
        if (r.preferenceMatchedB) {
          prefCounts[r.preferenceMatchedB] = (prefCounts[r.preferenceMatchedB] || 0) + 1;
        }
      });

      stats.preferenceStats = Object.entries(prefCounts)
        .map(([pref, count]) => ({ preference: parseInt(pref), count }))
        .sort((a, b) => a.preference - b.preference);

      return { results, stats, dryRun };
    },
    onSuccess: (data) => {
      if (!data.dryRun) {
        queryClient.invalidateQueries({ queryKey: ['workshop-assignments', eventId] });
        toast.success(`Asignación completada: ${data.stats.fullyAssigned} equipos asignados`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Asignación manual de un equipo
  const manualAssignMutation = useMutation({
    mutationFn: async ({
      teamId,
      workshopId,
      timeSlotId,
      assignmentSlot,
      userId,
    }: {
      teamId: string;
      workshopId: string;
      timeSlotId: string;
      assignmentSlot: 'A' | 'B';
      userId: string;
    }) => {
      // Verificar si ya existe asignación para este slot
      const { data: existing } = await supabase
        .from('workshop_assignments')
        .select('id')
        .eq('team_id', teamId)
        .eq('event_id', eventId)
        .eq('assignment_slot', assignmentSlot)
        .maybeSingle();

      if (existing) {
        // Actualizar
        const { error } = await supabase
          .from('workshop_assignments')
          .update({
            workshop_id: workshopId,
            time_slot_id: timeSlotId,
            assignment_type: 'manual',
            assigned_by: userId,
            assigned_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insertar
        const { error } = await supabase
          .from('workshop_assignments')
          .insert({
            team_id: teamId,
            event_id: eventId,
            workshop_id: workshopId,
            time_slot_id: timeSlotId,
            assignment_slot: assignmentSlot,
            assignment_type: 'manual',
            assigned_by: userId,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments', eventId] });
      toast.success('Asignación manual guardada');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Eliminar todas las asignaciones
  const clearAssignmentsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('workshop_assignments')
        .delete()
        .eq('event_id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments', eventId] });
      toast.success('Asignaciones eliminadas');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  return {
    workshops,
    timeSlots,
    existingAssignments,
    assignmentsLoading,
    runAssignment: runAssignmentMutation.mutateAsync,
    manualAssign: manualAssignMutation.mutateAsync,
    clearAssignments: clearAssignmentsMutation.mutateAsync,
    isRunning: runAssignmentMutation.isPending,
    isAssigning: manualAssignMutation.isPending,
    isClearing: clearAssignmentsMutation.isPending,
  };
}
