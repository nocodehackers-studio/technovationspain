import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WorkshopAssignment, WorkshopTimeSlot, Workshop } from '@/types/database';

interface TeamForAssignment {
  id: string;
  name: string;
  participantCount: number;
  registrationDate: string;
  preferencesSubmittedAt: string | null;
  preferences: { workshopId: string; order: number }[];
}

export interface AssignmentResult {
  teamId: string;
  teamName: string;
  participantCount: number;
  workshopA: { workshopId: string; workshopName: string; slotNumber: number } | null;
  workshopB: { workshopId: string; workshopName: string; slotNumber: number } | null;
  preferenceMatchedA: number | null;
  preferenceMatchedB: number | null;
  errors: string[];
  assignmentNotes: string[];
}

export interface AssignmentStats {
  totalTeams: number;
  excludedTeams: number;
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

      // 1. Obtener registros activos del evento (con y sin team_id)
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          team_id,
          user_id,
          participant_count,
          created_at,
          team:teams(id, name)
        `)
        .eq('event_id', eventId)
        .eq('is_companion', false)
        .neq('registration_status', 'cancelled')
        .order('created_at');

      if (regError) throw regError;

      // 2. Recopilar team_ids directos del registro
      const directTeamIdsRaw = new Set(
        registrations?.map(r => r.team_id).filter((id): id is string => !!id) || []
      );

      // 2b. Filtrar solo equipos validados
      const directTeamIds = new Set<string>();
      if (directTeamIdsRaw.size > 0) {
        const { data: validatedTeams, error: valError } = await supabase
          .from('teams')
          .select('id')
          .in('id', [...directTeamIdsRaw])
          .eq('validated', true);
        if (valError) throw valError;
        validatedTeams?.forEach(t => directTeamIds.add(t.id));
      }

      // 3. Para usuarios sin team_id en el registro, buscar equipo vía team_members
      const userIdsWithoutTeam = (registrations || [])
        .filter(r => !r.team_id && r.user_id)
        .map(r => r.user_id)
        .filter((id): id is string => !!id);

      const membershipTeamIds = new Set<string>();
      if (userIdsWithoutTeam.length > 0) {
        const { data: memberships } = await supabase
          .from('team_members')
          .select('team_id')
          .in('user_id', userIdsWithoutTeam)
          .not('team_id', 'is', null);

        memberships?.forEach(m => {
          if (m.team_id) membershipTeamIds.add(m.team_id);
        });
      }

      // 4. Unir todos los team_ids encontrados
      const allTeamIds = [...new Set([...directTeamIds, ...membershipTeamIds])];

      // 5. Obtener info de equipos descubiertos vía membership (no en registros directos)
      const teamsFromMembership = allTeamIds.filter(id => !directTeamIds.has(id));
      let extraTeams: { id: string; name: string }[] = [];
      if (teamsFromMembership.length > 0) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamsFromMembership)
          .eq('validated', true);
        extraTeams = teamData || [];
      }

      // 6. Contar participantes con entrada al evento + 1 (mentor fijo)
      // Fórmula: count(participantes registradas en evento) + 1
      const participantsByTeam = new Map<string, number>();
      if (allTeamIds.length > 0) {
        // Obtener user_ids con entrada confirmada al evento
        const registeredUserIds = new Set(
          registrations
            ?.filter(r => r.user_id)
            .map(r => r.user_id)
            .filter((id): id is string => !!id) || []
        );

        // Obtener miembros de equipos (necesitamos user_id para cruzar)
        const { data: memberCounts } = await supabase
          .from('team_members')
          .select('team_id, member_type, user_id')
          .in('team_id', allTeamIds);

        // Contar solo participantes que están registradas en el evento
        const registeredParticipantCounts = new Map<string, number>();
        memberCounts?.forEach(m => {
          if (!m.team_id || !m.user_id) return;
          if (m.member_type === 'participant' && registeredUserIds.has(m.user_id)) {
            registeredParticipantCounts.set(
              m.team_id,
              (registeredParticipantCounts.get(m.team_id) || 0) + 1
            );
          }
        });

        for (const teamId of allTeamIds) {
          const registeredParticipants = registeredParticipantCounts.get(teamId) || 0;
          participantsByTeam.set(teamId, registeredParticipants > 0 ? registeredParticipants + 1 : 0);
        }
      }

      // 7. Construir teamsMap desde registros directos (solo equipos validados)
      const teamsMap = new Map<string, TeamForAssignment>();
      registrations?.forEach(reg => {
        if (reg.team_id && reg.team && directTeamIds.has(reg.team_id)) {
          const existing = teamsMap.get(reg.team_id);
          if (!existing) {
            teamsMap.set(reg.team_id, {
              id: reg.team_id,
              name: (reg.team as any).name,
              participantCount: participantsByTeam.get(reg.team_id) ?? reg.participant_count ?? 0,
              registrationDate: reg.created_at,
              preferencesSubmittedAt: null,
              preferences: [],
            });
          }
        }
      });

      // 8. Añadir equipos descubiertos vía team_members (fallback)
      for (const team of extraTeams) {
        if (!teamsMap.has(team.id)) {
          const earliestReg = registrations?.find(r =>
            userIdsWithoutTeam.includes(r.user_id!)
          )?.created_at || new Date().toISOString();

          teamsMap.set(team.id, {
            id: team.id,
            name: team.name,
            participantCount: participantsByTeam.get(team.id) ?? 0,
            registrationDate: earliestReg,
            preferencesSubmittedAt: null,
            preferences: [],
          });
        }
      }

      // 2. Obtener preferencias
      const { data: allPreferences, error: prefError } = await supabase
        .from('workshop_preferences')
        .select('team_id, workshop_id, preference_order, submitted_at')
        .eq('event_id', eventId)
        .order('preference_order');

      if (prefError) throw prefError;

      // Trackear MIN(submitted_at) por equipo
      const submittedAtByTeam = new Map<string, string>();
      allPreferences?.forEach(pref => {
        const team = teamsMap.get(pref.team_id);
        if (team) {
          team.preferences.push({
            workshopId: pref.workshop_id,
            order: pref.preference_order,
          });
        }
        if (pref.submitted_at) {
          const current = submittedAtByTeam.get(pref.team_id);
          if (!current || pref.submitted_at < current) {
            submittedAtByTeam.set(pref.team_id, pref.submitted_at);
          }
        }
      });

      // Asignar preferencesSubmittedAt a cada equipo
      for (const team of teamsMap.values()) {
        team.preferencesSubmittedAt = submittedAtByTeam.get(team.id) || null;
      }

      const teamsAll = Array.from(teamsMap.values());

      // Filtrar equipos con 0 participantes — no participan en el algoritmo
      const teams = teamsAll.filter(t => t.participantCount > 0);

      // Ordenar por fecha de registro de preferencias (ASC), nulls al final, nombre como tiebreaker
      teams.sort((a, b) => {
        if (a.preferencesSubmittedAt && b.preferencesSubmittedAt) {
          const cmp = a.preferencesSubmittedAt.localeCompare(b.preferencesSubmittedAt);
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
        }
        if (a.preferencesSubmittedAt && !b.preferencesSubmittedAt) return -1;
        if (!a.preferencesSubmittedAt && b.preferencesSubmittedAt) return 1;
        return a.name.localeCompare(b.name);
      });

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

      // Helper: ordenar turnos por menor ocupación relativa para distribución equilibrada
      const getSortedSlots = (workshopId: string) => {
        const workshop = workshopsMap.get(workshopId);
        if (!workshop || workshop.max_capacity <= 0) return [...timeSlots];
        return [...timeSlots].sort((a, b) => {
          const ratioA = occupancy[workshopId][a.slot_number] / workshop.max_capacity;
          const ratioB = occupancy[workshopId][b.slot_number] / workshop.max_capacity;
          return ratioA !== ratioB ? ratioA - ratioB : a.slot_number - b.slot_number;
        });
      };

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
        assignmentNotes: [],
      }));

      // ============================================
      // FASE 1: Asignar Taller A
      // ============================================
      const maxPreference = workshops.length;

      // Recolectar razones de rechazo por equipo para Taller A
      const rejectionReasonsA: Map<number, string[]> = new Map();

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

          // Intentar asignar en algún turno (ordenados por menor ocupación)
          let assigned = false;
          const slotReasons: string[] = [];
          for (const slot of getSortedSlots(pref.workshopId)) {
            const currentOccupancy = occupancy[pref.workshopId][slot.slot_number];
            if (currentOccupancy + team.participantCount <= workshop.max_capacity) {
              occupancy[pref.workshopId][slot.slot_number] += team.participantCount;
              result.workshopA = {
                workshopId: pref.workshopId,
                workshopName: workshop.name,
                slotNumber: slot.slot_number,
              };
              result.preferenceMatchedA = priorityLevel;
              assigned = true;
              break;
            } else {
              slotReasons.push(`Turno ${slot.slot_number} lleno (${currentOccupancy}/${workshop.max_capacity})`);
            }
          }
          if (!assigned) {
            if (!rejectionReasonsA.has(teamIdx)) rejectionReasonsA.set(teamIdx, []);
            rejectionReasonsA.get(teamIdx)!.push(`Pref #${priorityLevel} (${workshop.name}): ${slotReasons.join(', ')}`);
          }
        }
      }

      // ============================================
      // FASE 2: Asignar Taller B
      // ============================================
      const rejectionReasonsB: Map<number, string[]> = new Map();

      for (let priorityLevel = 1; priorityLevel <= maxPreference; priorityLevel++) {
        for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
          const team = teams[teamIdx];
          const result = results[teamIdx];

          // Si ya tiene Taller B, saltar
          if (result.workshopB !== null) continue;

          // Encontrar qué taller tiene esta prioridad
          const pref = team.preferences.find(p => p.order === priorityLevel);
          if (!pref) continue;

          const workshop = workshopsMap.get(pref.workshopId);
          if (!workshop) continue;

          // No puede ser el mismo taller que A
          if (result.workshopA && pref.workshopId === result.workshopA.workshopId) {
            if (!rejectionReasonsB.has(teamIdx)) rejectionReasonsB.set(teamIdx, []);
            rejectionReasonsB.get(teamIdx)!.push(`Pref #${priorityLevel} (${workshop.name}): descartado — ya asignado como Taller A`);
            continue;
          }

          // Intentar asignar en turno DIFERENTE al de Taller A (ordenados por menor ocupación)
          let assigned = false;
          const slotReasons: string[] = [];
          for (const slot of getSortedSlots(pref.workshopId)) {
            // Evitar mismo turno que A
            if (result.workshopA && slot.slot_number === result.workshopA.slotNumber) {
              slotReasons.push(`Turno ${slot.slot_number} descartado — coincide con Taller A`);
              continue;
            }

            const currentOccupancy = occupancy[pref.workshopId][slot.slot_number];
            if (currentOccupancy + team.participantCount <= workshop.max_capacity) {
              occupancy[pref.workshopId][slot.slot_number] += team.participantCount;
              result.workshopB = {
                workshopId: pref.workshopId,
                workshopName: workshop.name,
                slotNumber: slot.slot_number,
              };
              result.preferenceMatchedB = priorityLevel;
              assigned = true;
              break;
            } else {
              slotReasons.push(`Turno ${slot.slot_number} lleno (${currentOccupancy}/${workshop.max_capacity})`);
            }
          }
          if (!assigned) {
            if (!rejectionReasonsB.has(teamIdx)) rejectionReasonsB.set(teamIdx, []);
            rejectionReasonsB.get(teamIdx)!.push(`Pref #${priorityLevel} (${workshop.name}): ${slotReasons.join(', ')}`);
          }
        }
      }

      // ============================================
      // FASE 2b: Fallback — equipos con preferencias sin asignar
      // ============================================
      for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
        const team = teams[teamIdx];
        const result = results[teamIdx];

        // Solo equipos CON preferencias que no consiguieron slot
        if (team.preferences.length === 0) continue;

        // Intentar asignar Taller A si falta
        if (!result.workshopA) {
          const fallbackReasonsA: string[] = [];
          for (const workshop of workshops) {
            let workshopAssigned = false;
            for (const slot of getSortedSlots(workshop.id)) {
              const currentOcc = occupancy[workshop.id][slot.slot_number];
              if (currentOcc + team.participantCount <= workshop.max_capacity) {
                occupancy[workshop.id][slot.slot_number] += team.participantCount;
                result.workshopA = {
                  workshopId: workshop.id,
                  workshopName: workshop.name,
                  slotNumber: slot.slot_number,
                };
                result.preferenceMatchedA = null;
                result.assignmentNotes.push('Taller A asignado por disponibilidad (preferencias llenas)');
                workshopAssigned = true;
                break;
              } else {
                fallbackReasonsA.push(`${workshop.name} Turno ${slot.slot_number} lleno (${currentOcc}/${workshop.max_capacity})`);
              }
            }
            if (workshopAssigned) break;
          }
          if (!result.workshopA) {
            if (!rejectionReasonsA.has(teamIdx)) rejectionReasonsA.set(teamIdx, []);
            rejectionReasonsA.get(teamIdx)!.push(`Fallback Taller A: ${fallbackReasonsA.join(', ')}`);
          }
        }

        // Intentar asignar Taller B si falta
        if (!result.workshopB) {
          const fallbackReasonsB: string[] = [];
          for (const workshop of workshops) {
            if (result.workshopA && workshop.id === result.workshopA.workshopId) continue;

            let workshopAssigned = false;
            for (const slot of getSortedSlots(workshop.id)) {
              if (result.workshopA && slot.slot_number === result.workshopA.slotNumber) {
                fallbackReasonsB.push(`${workshop.name} Turno ${slot.slot_number} conflicto con Taller A`);
                continue;
              }

              const currentOcc = occupancy[workshop.id][slot.slot_number];
              if (currentOcc + team.participantCount <= workshop.max_capacity) {
                occupancy[workshop.id][slot.slot_number] += team.participantCount;
                result.workshopB = {
                  workshopId: workshop.id,
                  workshopName: workshop.name,
                  slotNumber: slot.slot_number,
                };
                result.preferenceMatchedB = null;
                result.assignmentNotes.push('Taller B asignado por disponibilidad (preferencias llenas)');
                workshopAssigned = true;
                break;
              } else {
                fallbackReasonsB.push(`${workshop.name} Turno ${slot.slot_number} lleno (${currentOcc}/${workshop.max_capacity})`);
              }
            }
            if (workshopAssigned) break;
          }
          if (!result.workshopB) {
            if (!rejectionReasonsB.has(teamIdx)) rejectionReasonsB.set(teamIdx, []);
            rejectionReasonsB.get(teamIdx)!.push(`Fallback Taller B: ${fallbackReasonsB.join(', ')}`);
          }
        }
      }

      // ============================================
      // FASE 2c: Equipos sin preferencias — asignar por disponibilidad
      // ============================================
      for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
        const team = teams[teamIdx];
        const result = results[teamIdx];

        // Solo equipos SIN preferencias
        if (team.preferences.length > 0) continue;

        // Intentar asignar Taller A
        if (!result.workshopA) {
          const noPrefsReasonsA: string[] = [];
          for (const workshop of workshops) {
            let workshopAssigned = false;
            for (const slot of getSortedSlots(workshop.id)) {
              const currentOcc = occupancy[workshop.id][slot.slot_number];
              if (currentOcc + team.participantCount <= workshop.max_capacity) {
                occupancy[workshop.id][slot.slot_number] += team.participantCount;
                result.workshopA = {
                  workshopId: workshop.id,
                  workshopName: workshop.name,
                  slotNumber: slot.slot_number,
                };
                result.preferenceMatchedA = null;
                result.assignmentNotes.push('Taller A asignado por disponibilidad (sin preferencias)');
                workshopAssigned = true;
                break;
              } else {
                noPrefsReasonsA.push(`${workshop.name} Turno ${slot.slot_number} lleno (${currentOcc}/${workshop.max_capacity})`);
              }
            }
            if (workshopAssigned) break;
          }
          if (!result.workshopA) {
            if (!rejectionReasonsA.has(teamIdx)) rejectionReasonsA.set(teamIdx, []);
            rejectionReasonsA.get(teamIdx)!.push(`Sin preferencias — Taller A: ${noPrefsReasonsA.join(', ')}`);
          }
        }

        // Intentar asignar Taller B
        if (!result.workshopB) {
          const noPrefsReasonsB: string[] = [];
          for (const workshop of workshops) {
            if (result.workshopA && workshop.id === result.workshopA.workshopId) continue;

            let workshopAssigned = false;
            for (const slot of getSortedSlots(workshop.id)) {
              if (result.workshopA && slot.slot_number === result.workshopA.slotNumber) {
                noPrefsReasonsB.push(`${workshop.name} Turno ${slot.slot_number} conflicto con Taller A`);
                continue;
              }

              const currentOcc = occupancy[workshop.id][slot.slot_number];
              if (currentOcc + team.participantCount <= workshop.max_capacity) {
                occupancy[workshop.id][slot.slot_number] += team.participantCount;
                result.workshopB = {
                  workshopId: workshop.id,
                  workshopName: workshop.name,
                  slotNumber: slot.slot_number,
                };
                result.preferenceMatchedB = null;
                result.assignmentNotes.push('Taller B asignado por disponibilidad (sin preferencias)');
                workshopAssigned = true;
                break;
              } else {
                noPrefsReasonsB.push(`${workshop.name} Turno ${slot.slot_number} lleno (${currentOcc}/${workshop.max_capacity})`);
              }
            }
            if (workshopAssigned) break;
          }
          if (!result.workshopB) {
            if (!rejectionReasonsB.has(teamIdx)) rejectionReasonsB.set(teamIdx, []);
            rejectionReasonsB.get(teamIdx)!.push(`Sin preferencias — Taller B: ${noPrefsReasonsB.join(', ')}`);
          }
        }
      }

      // ============================================
      // FASE 3: Validación con mensajes descriptivos
      // ============================================
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const reasonsA = rejectionReasonsA.get(i) || [];
        const reasonsB = rejectionReasonsB.get(i) || [];

        if (!result.workshopA && !result.workshopB) {
          const details = [...reasonsA, ...reasonsB].join('; ');
          result.errors.push(details
            ? `No se asignó ningún taller: ${details}`
            : 'Sin preferencias registradas — no se pudo asignar automáticamente');
        } else {
          if (!result.workshopA) {
            const details = reasonsA.join('; ');
            result.errors.push(details
              ? `No se asignó Taller A: ${details}`
              : 'Taller A: no se encontró espacio disponible');
          }
          if (!result.workshopB) {
            const details = reasonsB.join('; ');
            result.errors.push(details
              ? `No se asignó Taller B: ${details}`
              : 'Taller B: no se encontró espacio disponible');
          }
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
        excludedTeams: teamsAll.length - teams.length,
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

      return { results, stats, dryRun, occupancy };
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
      // 1. Validar conflictos: consultar el otro slot del equipo
      const otherSlot = assignmentSlot === 'A' ? 'B' : 'A';
      const { data: otherAssignment } = await supabase
        .from('workshop_assignments')
        .select('workshop_id, time_slot_id')
        .eq('team_id', teamId)
        .eq('event_id', eventId)
        .eq('assignment_slot', otherSlot)
        .maybeSingle();

      if (otherAssignment) {
        if (otherAssignment.workshop_id === workshopId) {
          throw new Error('No se puede asignar el mismo taller en ambos turnos');
        }
        if (otherAssignment.time_slot_id === timeSlotId) {
          throw new Error('No se puede asignar el mismo turno para ambos talleres');
        }
      }

      // 2. Validar capacidad: contar participantes actuales en el workshop+slot
      const { data: workshop } = await supabase
        .from('workshops')
        .select('name, max_capacity')
        .eq('id', workshopId)
        .single();

      if (!workshop) throw new Error('Taller no encontrado');

      // Contar participantes asignados al workshop en este time_slot (excluyendo este equipo)
      const { data: currentAssignments } = await supabase
        .from('workshop_assignments')
        .select('team_id')
        .eq('event_id', eventId)
        .eq('workshop_id', workshopId)
        .eq('time_slot_id', timeSlotId)
        .neq('team_id', teamId);

      const assignedTeamIds = currentAssignments?.map(a => a.team_id) || [];
      let currentOccupancy = 0;

      if (assignedTeamIds.length > 0) {
        const { data: memberCounts } = await supabase
          .from('team_members')
          .select('team_id, member_type')
          .in('team_id', assignedTeamIds);

        // Calcular ocupación con fórmula: participants + min(1, mentors) por equipo
        const occParticipants = new Map<string, number>();
        const occMentors = new Map<string, number>();
        memberCounts?.forEach(m => {
          if (!m.team_id) return;
          if (m.member_type === 'mentor') {
            occMentors.set(m.team_id, (occMentors.get(m.team_id) || 0) + 1);
          } else if (m.member_type === 'participant') {
            occParticipants.set(m.team_id, (occParticipants.get(m.team_id) || 0) + 1);
          }
        });
        for (const tid of assignedTeamIds) {
          const p = occParticipants.get(tid) || 0;
          const m = occMentors.get(tid) || 0;
          currentOccupancy += p > 0 ? p + Math.min(1, m) : 0;
        }
      }

      // Contar participantes del equipo registrados al evento
      const { data: eventRegs } = await supabase
        .from('event_registrations')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('is_companion', false)
        .neq('registration_status', 'cancelled');

      const registeredUserIds = new Set(
        eventRegs?.map(r => r.user_id).filter((id): id is string => !!id) || []
      );

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('member_type, user_id')
        .eq('team_id', teamId);

      const teamParticipants = teamMembers?.filter(
        m => m.member_type === 'participant' && m.user_id && registeredUserIds.has(m.user_id)
      ).length || 0;
      const teamMentors = teamMembers?.filter(m => m.member_type === 'mentor').length || 0;

      if (teamParticipants === 0) {
        throw new Error('No se puede asignar un taller a un equipo sin participantes inscritos');
      }
      const teamSize = teamParticipants + Math.min(1, teamMentors);

      if (currentOccupancy + teamSize > workshop.max_capacity) {
        const { data: slotInfo } = await supabase
          .from('workshop_time_slots')
          .select('slot_number')
          .eq('id', timeSlotId)
          .single();
        throw new Error(
          `El taller "${workshop.name}" está lleno en el turno ${slotInfo?.slot_number || '?'} (${currentOccupancy}/${workshop.max_capacity} participantes)`
        );
      }

      // 3. Verificar si ya existe asignación para este slot
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

  // Eliminar una asignación específica de un equipo
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({
      teamId,
      assignmentSlot,
    }: {
      teamId: string;
      assignmentSlot: 'A' | 'B';
    }) => {
      const { error } = await supabase
        .from('workshop_assignments')
        .delete()
        .eq('team_id', teamId)
        .eq('event_id', eventId)
        .eq('assignment_slot', assignmentSlot);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['workshop-assignments-full', eventId] });
      toast.success('Asignación eliminada');
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
    removeAssignment: removeAssignmentMutation.mutateAsync,
    clearAssignments: clearAssignmentsMutation.mutateAsync,
    isRunning: runAssignmentMutation.isPending,
    isAssigning: manualAssignMutation.isPending,
    isRemoving: removeAssignmentMutation.isPending,
    isClearing: clearAssignmentsMutation.isPending,
  };
}
