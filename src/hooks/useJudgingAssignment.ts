import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  JudgingEventConfig,
  JudgingPanel,
  JudgingPanelJudge,
  JudgingPanelTeam,
  TeamCategory,
  Profile,
  Team,
} from '@/types/database';
import type { JudgeForAssignment } from './useEventJudges';

// ============================================================================
// Types
// ============================================================================

export interface PanelAssignmentResult {
  panelCode: string;
  sessionNumber: number;
  roomNumber: number;
  turn: 'morning' | 'afternoon';
  judges: JudgeInPanel[];
  teamsSubsession1: TeamInPanel[];
  teamsSubsession2: TeamInPanel[];
  warnings: string[];
}

export interface JudgeInPanel {
  id: string;
  name: string;
  hubId: string | null;
  isManual: boolean;
}

export interface TeamInPanel {
  id: string;
  name: string;
  code: string;
  category: string;
  hubId: string | null;
}

export type WarningSeverity = 'error' | 'warning' | 'info';

export interface StructuredWarning {
  severity: WarningSeverity;
  message: string;
  suggestion?: string;
  count: number;
  panels?: string[];
}

export interface JudgingAssignmentStats {
  totalTeams: number;
  totalJudges: number;
  totalPanels: number;
  assignedTeams: number;
  assignedJudges: number;
  unassignedTeams: number;
  unassignedJudges: number;
  pendingTeams: TeamInPanel[];
  blockedJudges: { judge: string; panel: string; reason: 'hub' | 'conflict' }[];
  teamsByCategory: { category: string; count: number }[];
  judgesByPreference: { preference: string; count: number }[];
  constraintViolations: string[];
  structuredWarnings: StructuredWarning[];
  roomUtilization: { room: number; session: number; teamCount: number }[];
}

interface TeamForJudging {
  id: string;
  name: string;
  category: TeamCategory;
  hubId: string | null;
}

// Typed Supabase response for assignments query
interface PanelWithRelations extends JudgingPanel {
  judging_panel_judges: (JudgingPanelJudge & {
    profiles: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email' | 'hub_id' | 'chapter' | 'city' | 'state'>;
    manual_change_by_profile: { first_name: string; last_name: string } | null;
  })[];
  judging_panel_teams: (JudgingPanelTeam & {
    teams: Pick<Team, 'id' | 'name' | 'category' | 'hub_id'>;
    manual_change_by_profile: { first_name: string; last_name: string } | null;
  })[];
}

// ============================================================================
// Hook
// ============================================================================

export function useJudgingAssignment(eventId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch existing assignments with proper types
  const assignmentsQuery = useQuery({
    queryKey: ['judging-assignments', eventId],
    queryFn: async () => {
      const { data: panels, error } = await supabase
        .from('judging_panels')
        .select(`
          *,
          judging_panel_judges (
            *,
            profiles:judge_id (id, first_name, last_name, email, hub_id, chapter, city, state),
            manual_change_by_profile:manual_change_by (first_name, last_name)
          ),
          judging_panel_teams!judging_panel_teams_panel_id_fkey (
            *,
            teams:team_id (id, name, category, hub_id),
            manual_change_by_profile:manual_change_by (first_name, last_name)
          )
        `)
        .eq('event_id', eventId!)
        .order('session_number')
        .order('room_number');

      if (error) throw error;
      return (panels || []) as PanelWithRelations[];
    },
    enabled: !!eventId,
  });

  // ============================================================================
  // Algorithm
  // ============================================================================

  const runAssignment = useMutation({
    mutationFn: async ({ dryRun = true }: { dryRun?: boolean }) => {
      if (!eventId) throw new Error('No se proporcionó eventId');

      // --- Phase 0: Data collection ---
      const { data: configData, error: configErr } = await supabase
        .from('judging_event_config')
        .select('*')
        .eq('event_id', eventId)
        .single();

      if (configErr) throw new Error('No se encontró configuración de judging');
      const config = configData as JudgingEventConfig;

      // Get teams from event_teams (imported with turn already assigned, only active)
      const { data: eventTeamsData, error: etErr } = await supabase
        .from('event_teams')
        .select(`
          team_id,
          team_code,
          category,
          turn,
          teams:team_id (id, name, hub_id)
        `)
        .eq('event_id', eventId)
        .eq('is_active', true);

      if (etErr) throw etErr;

      interface EventTeamForJudging extends TeamForJudging {
        turn: 'morning' | 'afternoon';
        teamCode: string;
      }

      const teams: EventTeamForJudging[] = (eventTeamsData || []).map(et => {
        const team = et.teams as { id: string; name: string; hub_id: string | null };
        return {
          id: team.id,
          name: team.name,
          category: et.category as TeamCategory,
          hubId: team.hub_id,
          turn: et.turn as 'morning' | 'afternoon',
          teamCode: et.team_code,
        };
      });

      // Get judges
      const { data: judgeData, error: judgeErr } = await supabase
        .from('judge_assignments')
        .select(`
          user_id,
          schedule_preference,
          conflict_team_ids,
          conflict_other_text,
          onboarding_completed,
          profiles:user_id (id, first_name, last_name, email, hub_id, judge_excluded)
        `)
        .eq('event_id', eventId)
        .eq('is_active', true);

      if (judgeErr) throw judgeErr;

      const allJudges: JudgeForAssignment[] = (judgeData || [])
        .filter((ja) => !(ja.profiles as any).judge_excluded)
        .map((ja) => {
        const p = ja.profiles as { id: string; first_name: string | null; last_name: string | null; email: string; hub_id: string | null; judge_excluded: boolean };
        return {
          id: p.id,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          email: p.email,
          hubId: p.hub_id,
          schedulePreference: ja.schedule_preference as JudgeForAssignment['schedulePreference'],
          conflictTeamIds: (ja.conflict_team_ids || []) as string[],
          conflictOtherText: ja.conflict_other_text as string | null,
          onboardingCompleted: ja.onboarding_completed as boolean,
        };
      });

      const readyJudges = allJudges.filter(j => j.onboardingCompleted);

      // Validation
      if (teams.length === 0) {
        throw new Error('No hay equipos registrados y validados');
      }
      if (readyJudges.length === 0) {
        throw new Error('No hay jueces con onboarding completo');
      }

      // --- Phase 1: Structure calculation ---
      const { total_rooms, teams_per_group, judges_per_group, sessions_per_turn } = config;
      const warnings: string[] = [];
      // Collectors for structured warnings
      const overflowPanels: string[] = [];
      const underflowPanels: string[] = [];
      const blockedJudges: { judge: string; panel: string; reason: 'hub' | 'conflict' }[] = [];
      const deficitPanels: { panel: string; deficit: number }[] = [];
      let hasCapacityIssue = false;

      const categoryOrder: TeamCategory[] = ['senior', 'junior', 'beginner'];
      const teamsByCategory = new Map<string, EventTeamForJudging[]>();
      for (const cat of categoryOrder) {
        teamsByCategory.set(cat, teams.filter(t => t.category === cat));
      }

      // Determine active turns from imported teams
      const activeTurns = [...new Set(teams.map(t => t.turn))].sort((a, b) => a === 'morning' ? -1 : 1) as ('morning' | 'afternoon')[];
      const numberOfTurns = activeTurns.length || 1;
      const totalSessions = sessions_per_turn * numberOfTurns;

      const totalTeamSlots = total_rooms * totalSessions * teams_per_group;
      if (teams.length > totalTeamSlots) {
        warnings.push(`Se necesitan más aulas: ${teams.length} equipos > ${totalTeamSlots} slots disponibles`);
        hasCapacityIssue = true;
      }

      // Split teams by their assigned turn
      const morningTeams = teams.filter(t => t.turn === 'morning')
        .sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
      const afternoonTeams = teams.filter(t => t.turn === 'afternoon')
        .sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));

      // Room count is calculated dynamically per category in distributeTurnTeams

      interface PanelSlot {
        sessionNumber: number;
        roomNumber: number;
        turn: 'morning' | 'afternoon';
        panelCode: string;
        teams: TeamInPanel[];
        teamsSubsession1: TeamInPanel[];
        teamsSubsession2: TeamInPanel[];
        judges: JudgeInPanel[];
        warnings: string[];
      }

      const panels: PanelSlot[] = [];
      const pendingTeams: TeamInPanel[] = [];

      const distributeTurnTeams = (
        turnTeams: EventTeamForJudging[],
        turn: 'morning' | 'afternoon',
        startSession: number,
      ) => {
        const sessCount = sessions_per_turn;

        // Group teams strictly by category
        const teamsByCat = new Map<string, EventTeamForJudging[]>();
        for (const cat of categoryOrder) {
          const catTeams = turnTeams.filter(t => t.category === cat);
          if (catTeams.length > 0) teamsByCat.set(cat, catTeams);
        }

        for (let s = 0; s < sessCount; s++) {
          const sessionNum = startSession + s;
          let roomCounter = 0;

          for (const [_cat, allCatTeams] of teamsByCat) {
            // Slice this category's teams for this session
            const perSession = Math.ceil(allCatTeams.length / sessCount);
            const sTeams = allCatTeams.slice(s * perSession, (s + 1) * perSession);
            if (sTeams.length === 0) continue;

            // How many rooms available for this category (respect total_rooms cap)
            const roomsAvailable = total_rooms - roomCounter;
            if (roomsAvailable <= 0) {
              // No rooms left — all teams in this category go to pending
              for (const t of sTeams) {
                pendingTeams.push({ id: t.id, name: t.name, code: t.teamCode, category: t.category, hubId: t.hubId });
              }
              continue;
            }

            const roomsNeeded = Math.ceil(sTeams.length / teams_per_group);
            const roomsForCat = Math.min(roomsNeeded, roomsAvailable);
            const catCapacity = roomsForCat * teams_per_group;

            // Assign teams that fit; overflow goes to pending
            const fittingTeams = sTeams.slice(0, catCapacity);
            for (const t of sTeams.slice(catCapacity)) {
              pendingTeams.push({ id: t.id, name: t.name, code: t.teamCode, category: t.category, hubId: t.hubId });
            }

            // Distribute fitting teams across rooms with round-robin
            const roomTeams: EventTeamForJudging[][] = Array.from({ length: roomsForCat }, () => []);
            for (let i = 0; i < fittingTeams.length; i++) {
              roomTeams[i % roomsForCat].push(fittingTeams[i]);
            }

            for (let r = 0; r < roomsForCat; r++) {
              const rt = roomTeams[r];
              if (rt.length === 0) continue;
              roomCounter++;
              const panelCode = `JUECES ${sessionNum}.${roomCounter}`;

              const teamsPanelized: TeamInPanel[] = rt.map(t => ({
                id: t.id,
                name: t.name,
                code: t.teamCode,
                category: t.category,
                hubId: t.hubId,
              }));

              const splitIdx = Math.ceil(teamsPanelized.length / 2);

              if (rt.length > 0 && rt.length < teams_per_group - 1) {
                warnings.push(`Panel ${panelCode}: solo ${rt.length} equipos (esperado ~${teams_per_group})`);
                underflowPanels.push(panelCode);
              }

              panels.push({
                sessionNumber: sessionNum,
                roomNumber: roomCounter,
                turn,
                panelCode,
                teams: teamsPanelized,
                teamsSubsession1: teamsPanelized.slice(0, splitIdx),
                teamsSubsession2: teamsPanelized.slice(splitIdx),
                judges: [],
                warnings: [],
              });
            }
          }
        }
      };

      if (morningTeams.length > 0) {
        distributeTurnTeams(morningTeams, 'morning', 1);
      }
      if (afternoonTeams.length > 0) {
        const afternoonStart = morningTeams.length > 0 ? sessions_per_turn + 1 : 1;
        distributeTurnTeams(afternoonTeams, 'afternoon', afternoonStart);
      }

      // Sort panels for consistent ordering
      panels.sort((a, b) => a.sessionNumber - b.sessionNumber || a.roomNumber - b.roomNumber);

      // --- Phase 3: Judge assignment ---
      const assignedJudgeIds = new Set<string>();
      const singleTurn = activeTurns.length === 1;

      const morningJudges = readyJudges.filter(j => j.schedulePreference === 'morning');
      const afternoonJudges = readyJudges.filter(j => j.schedulePreference === 'afternoon');
      const flexJudges = readyJudges.filter(
        j => !j.schedulePreference || j.schedulePreference === 'no_preference'
      );

      const getAvailableJudges = (_turn: 'morning' | 'afternoon'): JudgeForAssignment[] => {
        // Single turn: all judges are available regardless of preference
        if (singleTurn) {
          return readyJudges.filter(j => !assignedJudgeIds.has(j.id));
        }

        // Two turns: respect preferences and split flex judges proportionally
        const morningPanels = panels.filter(p => p.turn === 'morning');
        const totalPanelCount = panels.length;
        const morningFlexBudget = totalPanelCount > 0
          ? Math.round(flexJudges.length * (morningPanels.length / totalPanelCount))
          : 0;

        const shuffledFlex = [...flexJudges].sort(() => Math.random() - 0.5);
        const preferred = _turn === 'morning' ? morningJudges : afternoonJudges;
        const flexPool = _turn === 'morning'
          ? shuffledFlex.slice(0, morningFlexBudget)
          : shuffledFlex.slice(morningFlexBudget);

        return [...preferred, ...flexPool].filter(j => !assignedJudgeIds.has(j.id));
      };

      for (const panel of panels) {
        const available = getAvailableJudges(panel.turn);
        const panelTeamIds = new Set(panel.teams.map(t => t.id));
        const panelTeamHubIds = new Set(
          panel.teams.map(t => t.hubId).filter((h): h is string => !!h)
        );

        // Filter out judges with hard-block conflicts, then score the rest
        const eligible = available.filter(judge => {
          // Hard block: same hub as any team in this panel
          if (judge.hubId && panelTeamHubIds.has(judge.hubId)) {
            blockedJudges.push({ judge: judge.name, panel: panel.panelCode, reason: 'hub' });
            return false;
          }
          // Hard block: declared conflict with a team in this panel
          if (judge.conflictTeamIds.some(tid => panelTeamIds.has(tid))) {
            blockedJudges.push({ judge: judge.name, panel: panel.panelCode, reason: 'conflict' });
            return false;
          }
          return true;
        });

        const scored = eligible.map(judge => {
          let score = 100;
          const judgeWarnings: string[] = [];

          if (judge.schedulePreference === panel.turn) {
            score += 10;
          }

          const assignedHubs = panel.judges.map(j => j.hubId).filter(Boolean);
          if (judge.hubId && !assignedHubs.includes(judge.hubId)) {
            score += 5;
          }

          return { judge, score, warnings: judgeWarnings };
        });

        scored.sort((a, b) => b.score - a.score);

        const needed = judges_per_group;
        const selected = scored.slice(0, needed);

        for (const { judge, score, warnings: jw } of selected) {
          panel.judges.push({
            id: judge.id,
            name: judge.name,
            hubId: judge.hubId,
            isManual: false,
          });
          assignedJudgeIds.add(judge.id);

          if (score < 20 && jw.length > 0) {
            panel.warnings.push(...jw);
            warnings.push(`${panel.panelCode}: ${jw.join(', ')} — restricción relajada para ${judge.name}`);
          }
        }

        if (panel.judges.length < needed) {
          const deficit = needed - panel.judges.length;
          const blocked = available.length - eligible.length;
          const reason = blocked > 0
            ? `Faltan ${deficit} jueces (${blocked} bloqueados por conflicto de hub/equipo)`
            : `Faltan ${deficit} jueces`;
          panel.warnings.push(reason);
          warnings.push(`${panel.panelCode}: ${reason}`);
          deficitPanels.push({ panel: panel.panelCode, deficit });
        }
      }

      // --- Phase 4: Validation & Stats ---
      const assignedTeamCount = panels.reduce((sum, p) => sum + p.teams.length, 0);
      const assignedJudgeCount = assignedJudgeIds.size;

      // Build structured warnings
      const structuredWarnings: StructuredWarning[] = [];

      if (hasCapacityIssue) {
        const neededRooms = Math.ceil(teams.length / (totalSessions * teams_per_group));
        const neededSessions = Math.ceil(teams.length / (total_rooms * teams_per_group * numberOfTurns));
        structuredWarnings.push({
          severity: 'error',
          message: `Faltan aulas: ${teams.length} equipos no caben en ${totalTeamSlots} slots (${total_rooms} aulas × ${totalSessions} sesiones × ${teams_per_group} equipos/grupo)`,
          suggestion: `Aumenta aulas a ${neededRooms} o sesiones por turno a ${neededSessions}`,
          count: 1,
        });
      }

      if (deficitPanels.length > 0) {
        const totalDeficit = deficitPanels.reduce((sum, d) => sum + d.deficit, 0);
        structuredWarnings.push({
          severity: 'error',
          message: `Faltan jueces en ${deficitPanels.length} ${deficitPanels.length === 1 ? 'panel' : 'paneles'} (déficit total: ${totalDeficit})`,
          suggestion: `Necesitas al menos ${totalDeficit} jueces más con onboarding completo`,
          count: deficitPanels.length,
          panels: deficitPanels.map(d => d.panel),
        });
      }

      if (overflowPanels.length > 0) {
        structuredWarnings.push({
          severity: 'warning',
          message: `${overflowPanels.length} ${overflowPanels.length === 1 ? 'panel excede' : 'paneles exceden'} el máximo de equipos configurado (${teams_per_group})`,
          suggestion: `Aumenta "equipos por grupo" o añade más aulas`,
          count: overflowPanels.length,
          panels: overflowPanels,
        });
      }

      if (blockedJudges.length > 0) {
        const hubBlocked = blockedJudges.filter(b => b.reason === 'hub');
        const conflictBlocked = blockedJudges.filter(b => b.reason === 'conflict');
        const uniqueJudges = [...new Set(blockedJudges.map(b => b.judge))];
        const uniquePanels = [...new Set(blockedJudges.map(b => b.panel))];

        structuredWarnings.push({
          severity: 'info',
          message: `${uniqueJudges.length} ${uniqueJudges.length === 1 ? 'juez bloqueado' : 'jueces bloqueados'} por conflictos${hubBlocked.length > 0 ? ` (${hubBlocked.length} por hub)` : ''}${conflictBlocked.length > 0 ? ` (${conflictBlocked.length} por incompatibilidad declarada)` : ''}`,
          suggestion: `Estos jueces no se asignan a paneles con equipos de su mismo hub o con incompatibilidad declarada`,
          count: uniqueJudges.length,
          panels: uniquePanels,
        });
      }

      if (underflowPanels.length > 0) {
        structuredWarnings.push({
          severity: 'info',
          message: `${underflowPanels.length} ${underflowPanels.length === 1 ? 'panel tiene' : 'paneles tienen'} menos equipos de lo esperado`,
          count: underflowPanels.length,
          panels: underflowPanels,
        });
      }

      if (pendingTeams.length > 0) {
        structuredWarnings.push({
          severity: 'warning',
          message: `${pendingTeams.length} ${pendingTeams.length === 1 ? 'equipo pendiente' : 'equipos pendientes'} de asignar manualmente`,
          suggestion: `No caben en los paneles actuales. Asígnalos desde la sección inferior o aumenta aulas/sesiones`,
          count: pendingTeams.length,
        });
      }

      const stats: JudgingAssignmentStats = {
        totalTeams: teams.length,
        totalJudges: readyJudges.length,
        totalPanels: panels.length,
        assignedTeams: assignedTeamCount,
        assignedJudges: assignedJudgeCount,
        unassignedTeams: pendingTeams.length,
        unassignedJudges: readyJudges.length - assignedJudgeCount,
        pendingTeams,
        blockedJudges,
        teamsByCategory: categoryOrder.map(cat => ({
          category: cat,
          count: teamsByCategory.get(cat)?.length || 0,
        })),
        judgesByPreference: [
          { preference: 'morning', count: morningJudges.length },
          { preference: 'afternoon', count: afternoonJudges.length },
          { preference: 'no_preference', count: flexJudges.length },
        ],
        constraintViolations: warnings,
        structuredWarnings,
        roomUtilization: panels.map(p => ({
          room: p.roomNumber,
          session: p.sessionNumber,
          teamCount: p.teams.length,
        })),
      };

      const results: PanelAssignmentResult[] = panels.map(p => ({
        panelCode: p.panelCode,
        sessionNumber: p.sessionNumber,
        roomNumber: p.roomNumber,
        turn: p.turn,
        judges: p.judges,
        teamsSubsession1: p.teamsSubsession1,
        teamsSubsession2: p.teamsSubsession2,
        warnings: p.warnings,
      }));

      // --- Persist if not dry run (F2 fix: batch inserts, better error handling) ---
      if (!dryRun) {
        // Delete existing assignments (cascade)
        const { error: delErr } = await supabase
          .from('judging_panels')
          .delete()
          .eq('event_id', eventId);

        if (delErr) throw new Error(`Fallo al limpiar asignaciones previas: ${delErr.message}`);

        // Batch insert all panels first
        const panelInserts = results.map(panel => ({
          event_id: eventId,
          panel_code: panel.panelCode,
          session_number: panel.sessionNumber,
          room_number: panel.roomNumber,
          turn: panel.turn,
        }));

        const { data: insertedPanels, error: panelErr } = await supabase
          .from('judging_panels')
          .insert(panelInserts)
          .select('id, panel_code');

        if (panelErr) {
          throw new Error(`Fallo al insertar paneles. Las asignaciones anteriores han sido eliminadas. Re-ejecute el algoritmo. Error: ${panelErr.message}`);
        }

        // Build panel code → id map
        const panelIdMap = new Map<string, string>();
        for (const p of insertedPanels || []) {
          panelIdMap.set(p.panel_code, p.id);
        }

        // Batch insert all judges
        const allJudgeInserts: { panel_id: string; judge_id: string; assignment_type: string }[] = [];
        for (const panel of results) {
          const panelId = panelIdMap.get(panel.panelCode);
          if (!panelId) continue;
          for (const j of panel.judges) {
            allJudgeInserts.push({
              panel_id: panelId,
              judge_id: j.id,
              assignment_type: 'algorithm',
            });
          }
        }

        if (allJudgeInserts.length > 0) {
          const { error: jErr } = await supabase
            .from('judging_panel_judges')
            .insert(allJudgeInserts);
          if (jErr) throw new Error(`Fallo al insertar jueces: ${jErr.message}. Paneles creados pero sin jueces/equipos.`);
        }

        // Batch insert all teams
        const allTeamInserts: { panel_id: string; team_id: string; team_code: string; subsession: number; assignment_type: string }[] = [];
        for (const panel of results) {
          const panelId = panelIdMap.get(panel.panelCode);
          if (!panelId) continue;
          for (const t of panel.teamsSubsession1) {
            allTeamInserts.push({ panel_id: panelId, team_id: t.id, team_code: t.code, subsession: 1, assignment_type: 'algorithm' });
          }
          for (const t of panel.teamsSubsession2) {
            allTeamInserts.push({ panel_id: panelId, team_id: t.id, team_code: t.code, subsession: 2, assignment_type: 'algorithm' });
          }
        }

        if (allTeamInserts.length > 0) {
          const { error: tErr } = await supabase
            .from('judging_panel_teams')
            .insert(allTeamInserts);
          if (tErr) throw new Error(`Fallo al insertar equipos: ${tErr.message}. Paneles y jueces insertados pero sin equipos.`);
        }

        // Update config with run timestamp
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from('judging_event_config')
          .update({
            algorithm_run_at: new Date().toISOString(),
            algorithm_run_by: user?.id || null,
          })
          .eq('event_id', eventId);
      }

      return { results, stats, dryRun };
    },
    onSuccess: (data) => {
      if (!data.dryRun) {
        queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
        queryClient.invalidateQueries({ queryKey: ['judging-config', eventId] });
        toast.success('Asignaciones guardadas correctamente');
      }
    },
    onError: (error: Error) => {
      toast.error(`Error en asignación: ${error.message}`);
    },
  });

  // Manual: add judge to panel
  const addJudgeToPanel = useMutation({
    mutationFn: async ({ panelId, judgeId, userId, comment }: { panelId: string; judgeId: string; userId: string; comment?: string }) => {
      const { error } = await supabase
        .from('judging_panel_judges')
        .insert({
          panel_id: panelId,
          judge_id: judgeId,
          assignment_type: 'manual',
          assigned_by: userId,
          manual_change_comment: comment || null,
          manual_change_by: userId,
          manual_change_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      toast.success('Juez añadido al panel');
    },
    onError: (error: Error) => {
      toast.error(`Error al añadir juez: ${error.message}`);
    },
  });

  // Deactivate judge from panel
  const deactivateJudgeFromPanel = useMutation({
    mutationFn: async ({
      panelJudgeId,
      reason,
      userId,
    }: {
      panelJudgeId: string;
      reason: string;
      userId?: string;
    }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('judging_panel_judges')
        .update({
          is_active: false,
          deactivated_at: now,
          deactivated_reason: reason,
          manual_change_comment: reason,
          manual_change_by: userId || null,
          manual_change_at: now,
        })
        .eq('id', panelJudgeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      toast.success('Juez dado de baja del panel');
    },
    onError: (error: Error) => {
      toast.error(`Error al dar de baja: ${error.message}`);
    },
  });

  // Move team between panels (F1 fix: rollback on insert failure)
  const moveTeam = useMutation({
    mutationFn: async ({
      teamId,
      targetPanelId,
      targetSubsession,
      userId,
      comment,
    }: {
      teamId: string;
      targetPanelId: string;
      targetSubsession: 1 | 2;
      userId: string;
      comment?: string;
    }) => {
      // Find current active assignment (limit 1 in case of duplicates)
      const { data: currentRows, error: findErr } = await supabase
        .from('judging_panel_teams')
        .select('id, panel_id, team_code, subsession')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .limit(1);

      if (findErr || !currentRows || currentRows.length === 0) {
        throw new Error('No se encontró asignación activa del equipo');
      }
      const current = currentRows[0];

      // Same panel, same subsession — nothing to do
      if (current.panel_id === targetPanelId && current.subsession === targetSubsession) return;

      // Get turns for code update
      const [{ data: targetPanel }, { data: sourcePanel }] = await Promise.all([
        supabase.from('judging_panels').select('turn').eq('id', targetPanelId).single(),
        supabase.from('judging_panels').select('turn').eq('id', current.panel_id).single(),
      ]);

      let newCode = current.team_code;
      if (targetPanel && sourcePanel && targetPanel.turn !== sourcePanel.turn) {
        const turnInitial = targetPanel.turn === 'morning' ? 'M' : 'T';
        newCode = current.team_code.replace(/^([A-Z])[MT]/, `$1${turnInitial}`);
      }

      // Delete current active record
      const { error: delErr } = await supabase
        .from('judging_panel_teams')
        .delete()
        .eq('id', current.id);

      if (delErr) throw delErr;

      // Clean up any previous inactive records in target panel for this team
      await supabase
        .from('judging_panel_teams')
        .delete()
        .eq('panel_id', targetPanelId)
        .eq('team_id', teamId);

      // Insert new assignment — rollback on failure
      const { error: insErr } = await supabase
        .from('judging_panel_teams')
        .insert({
          panel_id: targetPanelId,
          team_id: teamId,
          team_code: newCode,
          subsession: targetSubsession,
          assignment_type: 'manual',
          assigned_by: userId,
          moved_from_panel_id: current.panel_id,
          manual_change_comment: comment || null,
          manual_change_by: userId,
          manual_change_at: new Date().toISOString(),
        });

      if (insErr) {
        // Rollback: re-insert the original record
        await supabase
          .from('judging_panel_teams')
          .insert({
            panel_id: current.panel_id,
            team_id: teamId,
            team_code: current.team_code,
            subsession: current.subsession,
            assignment_type: 'manual',
            assigned_by: userId,
          });
        throw new Error(`Fallo al mover equipo: ${insErr.message}. Asignación original restaurada.`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      toast.success('Equipo movido correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Replace judge in panel (deactivate old + insert new, with rollback)
  const replaceJudge = useMutation({
    mutationFn: async ({
      panelJudgeId,
      panelId,
      newJudgeId,
      userId,
      comment,
    }: {
      panelJudgeId: string;
      panelId: string;
      newJudgeId: string;
      userId: string;
      comment?: string;
    }) => {
      // Verify the new judge isn't already assigned to an active panel
      const { data: existing } = await supabase
        .from('judging_panel_judges')
        .select('id')
        .eq('judge_id', newJudgeId)
        .eq('is_active', true)
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error('Este juez ya fue asignado a otro panel. Recarga la página.');
      }

      // Deactivate original judge
      const now = new Date().toISOString();
      const { error: deactErr } = await supabase
        .from('judging_panel_judges')
        .update({
          is_active: false,
          deactivated_at: now,
          deactivated_reason: comment || 'Reemplazado por otro juez',
          manual_change_comment: comment || 'Reemplazado por otro juez',
          manual_change_by: userId,
          manual_change_at: now,
        })
        .eq('id', panelJudgeId);

      if (deactErr) throw deactErr;

      // Insert new judge
      const { error: insErr } = await supabase
        .from('judging_panel_judges')
        .insert({
          panel_id: panelId,
          judge_id: newJudgeId,
          assignment_type: 'manual',
          assigned_by: userId,
          manual_change_comment: comment || null,
          manual_change_by: userId,
          manual_change_at: now,
        });

      if (insErr) {
        // Rollback: re-activate original judge
        await supabase
          .from('judging_panel_judges')
          .update({
            is_active: true,
            deactivated_at: null,
            deactivated_reason: null,
          })
          .eq('id', panelJudgeId);
        throw new Error(`Fallo al insertar nuevo juez: ${insErr.message}. Juez original restaurado.`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      toast.success('Juez reemplazado correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Swap two judges between panels (with rollback)
  const swapJudges = useMutation({
    mutationFn: async ({
      panelJudgeAId,
      panelJudgeBId,
      userId,
      comment,
    }: {
      panelJudgeAId: string;
      panelJudgeBId: string;
      userId: string;
      comment?: string;
    }) => {
      // Fetch both records to get judge_id and panel_id
      const [{ data: recordA, error: errA }, { data: recordB, error: errB }] = await Promise.all([
        supabase.from('judging_panel_judges').select('id, judge_id, panel_id, is_active').eq('id', panelJudgeAId).single(),
        supabase.from('judging_panel_judges').select('id, judge_id, panel_id, is_active').eq('id', panelJudgeBId).single(),
      ]);

      if (errA || errB || !recordA || !recordB) {
        throw new Error('No se pudieron cargar los registros de jueces. Recarga la página.');
      }
      if (!recordA.is_active || !recordB.is_active) {
        throw new Error('Uno de los jueces ya no está activo. Recarga la página.');
      }

      // Step 1: Deactivate both
      const now = new Date().toISOString();
      const swapComment = comment || 'Intercambiado con otro juez';
      const { error: deactAErr } = await supabase
        .from('judging_panel_judges')
        .update({
          is_active: false,
          deactivated_at: now,
          deactivated_reason: swapComment,
          manual_change_comment: swapComment,
          manual_change_by: userId,
          manual_change_at: now,
        })
        .eq('id', panelJudgeAId);

      if (deactAErr) throw deactAErr;

      const { error: deactBErr } = await supabase
        .from('judging_panel_judges')
        .update({
          is_active: false,
          deactivated_at: now,
          deactivated_reason: swapComment,
          manual_change_comment: swapComment,
          manual_change_by: userId,
          manual_change_at: now,
        })
        .eq('id', panelJudgeBId);

      if (deactBErr) {
        // Rollback: re-activate A
        await supabase.from('judging_panel_judges').update({ is_active: true, deactivated_at: null, deactivated_reason: null }).eq('id', panelJudgeAId);
        throw new Error(`Fallo al desactivar segundo juez: ${deactBErr.message}. Restaurado.`);
      }

      // Step 2: Insert A into B's panel
      const { data: insertedA, error: insAErr } = await supabase
        .from('judging_panel_judges')
        .insert({
          panel_id: recordB.panel_id,
          judge_id: recordA.judge_id,
          assignment_type: 'manual',
          assigned_by: userId,
          manual_change_comment: swapComment,
          manual_change_by: userId,
          manual_change_at: now,
        })
        .select('id')
        .single();

      if (insAErr) {
        // Rollback: re-activate both
        await Promise.all([
          supabase.from('judging_panel_judges').update({ is_active: true, deactivated_at: null, deactivated_reason: null }).eq('id', panelJudgeAId),
          supabase.from('judging_panel_judges').update({ is_active: true, deactivated_at: null, deactivated_reason: null }).eq('id', panelJudgeBId),
        ]);
        throw new Error(`Fallo al insertar juez A en panel destino: ${insAErr.message}. Restaurado.`);
      }

      // Step 3: Insert B into A's panel
      const { error: insBErr } = await supabase
        .from('judging_panel_judges')
        .insert({
          panel_id: recordA.panel_id,
          judge_id: recordB.judge_id,
          assignment_type: 'manual',
          assigned_by: userId,
          manual_change_comment: swapComment,
          manual_change_by: userId,
          manual_change_at: now,
        });

      if (insBErr) {
        // Rollback: re-activate both + delete inserted A
        await Promise.all([
          supabase.from('judging_panel_judges').delete().eq('id', insertedA.id),
          supabase.from('judging_panel_judges').update({ is_active: true, deactivated_at: null, deactivated_reason: null }).eq('id', panelJudgeAId),
          supabase.from('judging_panel_judges').update({ is_active: true, deactivated_at: null, deactivated_reason: null }).eq('id', panelJudgeBId),
        ]);
        throw new Error(`Fallo al insertar juez B en panel destino: ${insBErr.message}. Restaurado.`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      toast.success('Jueces intercambiados correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Reorder teams within a panel subsession
  const reorderTeams = useMutation({
    mutationFn: async ({
      panelId,
      subsession,
      orderedTeamIds,
      userId,
      comment,
    }: {
      panelId: string;
      subsession: 1 | 2;
      orderedTeamIds: string[]; // judging_panel_teams.id in new order
      userId: string;
      comment?: string;
    }) => {
      const now = new Date().toISOString();
      const results = await Promise.all(
        orderedTeamIds.map((id, index) =>
          supabase
            .from('judging_panel_teams')
            .update({
              display_order: index,
              manual_change_by: userId,
              manual_change_at: now,
            })
            .eq('id', id)
        )
      );
      const failed = results.filter(r => r.error);
      if (failed.length > 0) {
        throw new Error(`Error al reordenar ${failed.length} equipos: ${failed[0].error!.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
    },
    onError: (error: Error) => {
      toast.error(`Error al reordenar: ${error.message}`);
    },
  });

  // Drop team from event (deactivate in event_teams + all panel_teams)
  const dropTeam = useMutation({
    mutationFn: async ({
      teamId,
      eventId: evId,
      userId,
      comment,
    }: {
      teamId: string; // teams.id
      eventId: string;
      userId: string;
      comment?: string;
    }) => {
      const now = new Date().toISOString();

      // Step 1: Deactivate in event_teams
      const { error: etErr } = await supabase
        .from('event_teams')
        .update({ is_active: false })
        .eq('team_id', teamId)
        .eq('event_id', evId);
      if (etErr) throw new Error(`Error en event_teams: ${etErr.message}`);

      // Step 2: Get panels for this event
      const { data: panels, error: panelErr } = await supabase
        .from('judging_panels')
        .select('id')
        .eq('event_id', evId);
      if (panelErr) throw new Error(`Error obteniendo paneles: ${panelErr.message}`);
      const panelIds = panels?.map(p => p.id) || [];

      // Step 3: Deactivate in panel_teams (scoped to event)
      if (panelIds.length > 0) {
        const { error: ptErr } = await supabase
          .from('judging_panel_teams')
          .update({
            is_active: false,
            manual_change_comment: comment || null,
            manual_change_by: userId,
            manual_change_at: now,
          })
          .eq('team_id', teamId)
          .in('panel_id', panelIds);
        if (ptErr) throw new Error(`Error en panel_teams: ${ptErr.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams-for-schedule', eventId] });
      toast.success('Equipo dado de baja');
    },
    onError: (error: Error) => {
      toast.error(`Error al dar de baja: ${error.message}`);
    },
  });

  // Reactivate team in event
  const reactivateTeam = useMutation({
    mutationFn: async ({
      teamId,
      eventId: evId,
      userId,
      comment,
    }: {
      teamId: string;
      eventId: string;
      userId: string;
      comment?: string;
    }) => {
      const now = new Date().toISOString();

      const { error: etErr } = await supabase
        .from('event_teams')
        .update({ is_active: true })
        .eq('team_id', teamId)
        .eq('event_id', evId);
      if (etErr) throw new Error(`Error en event_teams: ${etErr.message}`);

      const { data: panels, error: panelErr } = await supabase
        .from('judging_panels')
        .select('id')
        .eq('event_id', evId);
      if (panelErr) throw new Error(`Error obteniendo paneles: ${panelErr.message}`);
      const panelIds = panels?.map(p => p.id) || [];

      if (panelIds.length > 0) {
        const { error: ptErr } = await supabase
          .from('judging_panel_teams')
          .update({
            is_active: true,
            manual_change_comment: comment || 'Reactivado',
            manual_change_by: userId,
            manual_change_at: now,
          })
          .eq('team_id', teamId)
          .in('panel_id', panelIds);
        if (ptErr) throw new Error(`Error en panel_teams: ${ptErr.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams-for-schedule', eventId] });
      toast.success('Equipo reactivado');
    },
    onError: (error: Error) => {
      toast.error(`Error al reactivar: ${error.message}`);
    },
  });

  // Drop judge from entire event
  const dropJudge = useMutation({
    mutationFn: async ({
      judgeId,
      eventId: evId,
      userId,
      comment,
    }: {
      judgeId: string; // profiles.id
      eventId: string;
      userId: string;
      comment?: string;
    }) => {
      const now = new Date().toISOString();

      // Step 1: Deactivate in judge_assignments
      const { error: jaErr } = await supabase
        .from('judge_assignments')
        .update({ is_active: false })
        .eq('user_id', judgeId)
        .eq('event_id', evId);
      if (jaErr) throw new Error(`Error en judge_assignments: ${jaErr.message}`);

      // Step 2: Get panels for this event
      const { data: panels, error: panelErr } = await supabase
        .from('judging_panels')
        .select('id')
        .eq('event_id', evId);
      if (panelErr) throw new Error(`Error obteniendo paneles: ${panelErr.message}`);
      const panelIds = panels?.map(p => p.id) || [];

      // Step 3: Deactivate in panel_judges (scoped to event)
      if (panelIds.length > 0) {
        const { error: pjErr } = await supabase
          .from('judging_panel_judges')
          .update({
            is_active: false,
            deactivated_at: now,
            deactivated_reason: comment || 'Baja del evento',
            manual_change_comment: comment || 'Baja del evento',
            manual_change_by: userId,
            manual_change_at: now,
          })
          .eq('judge_id', judgeId)
          .in('panel_id', panelIds);
        if (pjErr) throw new Error(`Error en panel_judges: ${pjErr.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-judges', eventId] });
      toast.success('Juez dado de baja del evento');
    },
    onError: (error: Error) => {
      toast.error(`Error al dar de baja: ${error.message}`);
    },
  });

  // Reactivate judge in event
  const reactivateJudge = useMutation({
    mutationFn: async ({
      judgeId,
      eventId: evId,
      userId,
      comment,
    }: {
      judgeId: string;
      eventId: string;
      userId: string;
      comment?: string;
    }) => {
      const now = new Date().toISOString();

      const { error: jaErr } = await supabase
        .from('judge_assignments')
        .update({ is_active: true })
        .eq('user_id', judgeId)
        .eq('event_id', evId);
      if (jaErr) throw new Error(`Error en judge_assignments: ${jaErr.message}`);

      const { data: panels, error: panelErr } = await supabase
        .from('judging_panels')
        .select('id')
        .eq('event_id', evId);
      if (panelErr) throw new Error(`Error obteniendo paneles: ${panelErr.message}`);
      const panelIds = panels?.map(p => p.id) || [];

      if (panelIds.length > 0) {
        const { error: pjErr } = await supabase
          .from('judging_panel_judges')
          .update({
            is_active: true,
            deactivated_at: null,
            deactivated_reason: null,
            manual_change_comment: comment || 'Reactivado',
            manual_change_by: userId,
            manual_change_at: now,
          })
          .eq('judge_id', judgeId)
          .in('panel_id', panelIds);
        if (pjErr) throw new Error(`Error en panel_judges: ${pjErr.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-judges', eventId] });
      toast.success('Juez reactivado en el evento');
    },
    onError: (error: Error) => {
      toast.error(`Error al reactivar: ${error.message}`);
    },
  });

  // Clear all assignments
  const clearAssignments = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No se proporcionó eventId');

      const { error: delErr } = await supabase
        .from('judging_panels')
        .delete()
        .eq('event_id', eventId);

      if (delErr) throw delErr;

      const { error: updErr } = await supabase
        .from('judging_event_config')
        .update({ algorithm_run_at: null, algorithm_run_by: null })
        .eq('event_id', eventId);

      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['judging-config', eventId] });
      toast.success('Todas las asignaciones han sido eliminadas');
    },
    onError: (error: Error) => {
      toast.error(`Error al limpiar: ${error.message}`);
    },
  });

  return {
    assignments: assignmentsQuery.data || [],
    isLoading: assignmentsQuery.isLoading,
    runAssignment: runAssignment.mutateAsync,
    isRunning: runAssignment.isPending,
    addJudgeToPanel: addJudgeToPanel.mutateAsync,
    isAddingJudge: addJudgeToPanel.isPending,
    deactivateJudgeFromPanel: deactivateJudgeFromPanel.mutateAsync,
    isDeactivating: deactivateJudgeFromPanel.isPending,
    moveTeam: moveTeam.mutateAsync,
    isMovingTeam: moveTeam.isPending,
    replaceJudge: replaceJudge.mutateAsync,
    isReplacing: replaceJudge.isPending,
    swapJudges: swapJudges.mutateAsync,
    isSwapping: swapJudges.isPending,
    reorderTeams: reorderTeams.mutateAsync,
    isReordering: reorderTeams.isPending,
    dropTeam: dropTeam.mutateAsync,
    isDroppingTeam: dropTeam.isPending,
    reactivateTeam: reactivateTeam.mutateAsync,
    isReactivatingTeam: reactivateTeam.isPending,
    dropJudge: dropJudge.mutateAsync,
    isDroppingJudge: dropJudge.isPending,
    reactivateJudge: reactivateJudge.mutateAsync,
    isReactivatingJudge: reactivateJudge.isPending,
    clearAssignments: clearAssignments.mutateAsync,
    isClearing: clearAssignments.isPending,
  };
}
