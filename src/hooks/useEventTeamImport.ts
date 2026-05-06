import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Team, TeamCategory, TeamTurn, TeamMatchType, EventTeamImportRecord } from '@/types/database';

// ─── CSV Row Interface ─────────────────────────────────────────────
export interface CsvTeamRow {
  name: string;
  division: string;
  teamId: string | null;
  studentEmails: string;
  mentorEmails: string;
}

// ─── Match Result ──────────────────────────────────────────────────
export interface MatchResult {
  csvName: string;
  category: TeamCategory;
  categoryUnknown: boolean;
  matchedTeam: Team | null;
  matchType: TeamMatchType | null;
  confidence: number;
  teamCode: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

export function normalizeTeamName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function levenshtein(a: string, b: string, maxThreshold?: number): number {
  const m = a.length;
  const n = b.length;
  // F6: Early exit if length difference alone exceeds threshold
  if (maxThreshold !== undefined && Math.abs(m - n) > maxThreshold) {
    return Math.abs(m - n);
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function generateTeamCode(category: TeamCategory, turn: TeamTurn, index: number): string {
  const catMap: Record<TeamCategory, string> = { senior: 'S', junior: 'J', beginner: 'B' };
  const turnMap: Record<TeamTurn, string> = { morning: 'M', afternoon: 'T' };
  return `${catMap[category]}${turnMap[turn]}${index + 1}`;
}

export function parseCsvRow(row: Record<string, string>): CsvTeamRow {
  return {
    name: row['Name'] || row['name'] || row['team'] || '',
    division: row['Division'] || row['division'] || '',
    teamId: row['Team ID'] || row['team_id'] || null,
    studentEmails: row['Student emails'] || row['student_emails'] || '',
    mentorEmails: row['Mentor emails'] || row['mentor_emails'] || '',
  };
}

export function normalizeCategory(division: string): TeamCategory | null {
  const lower = division.toLowerCase().trim();
  if (lower.includes('senior')) return 'senior';
  if (lower.includes('junior')) return 'junior';
  if (lower.includes('beginner')) return 'beginner';
  return null;
}

// ─── Matching Pipeline ─────────────────────────────────────────────

export async function matchTeams(
  csvRows: CsvTeamRow[],
  dbTeams: Team[],
  turn: TeamTurn,
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  const usedTeamIds = new Set<string>();

  // Build lookup maps
  const teamsByTgId = new Map<string, Team>();
  const teamsByNormalizedName = new Map<string, Team>();
  for (const t of dbTeams) {
    if (t.tg_team_id) teamsByTgId.set(t.tg_team_id, t);
    teamsByNormalizedName.set(normalizeTeamName(t.name), t);
  }

  // First pass: deterministic matches (tg_id + exact name)
  for (const row of csvRows) {
    const category = normalizeCategory(row.division);
    if (!category) {
      results.push({
        csvName: row.name,
        category: 'junior', // fallback
        categoryUnknown: true,
        matchedTeam: null,
        matchType: null,
        confidence: 0,
        teamCode: '',
      });
      continue;
    }

    let matched: Team | null = null;
    let matchType: TeamMatchType | null = null;
    let confidence = 0;

    // PASO 0: tg_team_id match
    if (row.teamId) {
      const t = teamsByTgId.get(row.teamId);
      if (t && !usedTeamIds.has(t.id)) {
        matched = t;
        matchType = 'tg_id';
        confidence = 1.0;
      }
    }

    // PASO 1: Exact name match
    if (!matched) {
      const normalized = normalizeTeamName(row.name);
      const t = teamsByNormalizedName.get(normalized);
      if (t && !usedTeamIds.has(t.id)) {
        matched = t;
        matchType = 'exact';
        confidence = 1.0;
      }
    }

    // PASO 2: Fuzzy name match
    if (!matched) {
      const normalizedCsv = normalizeTeamName(row.name);
      let bestMatch: Team | null = null;
      let bestRatio = Infinity;

      for (const t of dbTeams) {
        if (usedTeamIds.has(t.id)) continue;
        const normalizedDb = normalizeTeamName(t.name);
        const maxLen = Math.max(normalizedCsv.length, normalizedDb.length);
        const maxDist = Math.floor(maxLen * 0.3);
        const dist = levenshtein(normalizedCsv, normalizedDb, maxDist);
        const ratio = maxLen > 0 ? dist / maxLen : 1;
        if (ratio <= 0.3 && ratio < bestRatio) {
          bestRatio = ratio;
          bestMatch = t;
        }
      }

      if (bestMatch) {
        matched = bestMatch;
        matchType = 'fuzzy';
        confidence = 1 - bestRatio;
      }
    }

    if (matched) usedTeamIds.add(matched.id);

    results.push({
      csvName: row.name,
      category,
      categoryUnknown: false,
      matchedTeam: matched,
      matchType,
      confidence,
      teamCode: '', // assigned below
    });
  }

  // PASO 3: Email fallback BATCHED for unmatched rows
  const unmatchedIndices = results
    .map((r, i) => (!r.matchedTeam ? i : -1))
    .filter((i) => i >= 0);

  if (unmatchedIndices.length > 0) {
    const allEmails: string[] = [];
    const emailToRowIdx = new Map<string, number[]>();

    for (const idx of unmatchedIndices) {
      const row = csvRows[idx];
      const emails = [
        ...row.studentEmails.split(',').map((e) => e.trim().toLowerCase()),
        ...row.mentorEmails.split(',').map((e) => e.trim().toLowerCase()),
      ].filter(Boolean);

      for (const email of emails) {
        allEmails.push(email);
        const existing = emailToRowIdx.get(email) || [];
        existing.push(idx);
        emailToRowIdx.set(email, existing);
      }
    }

    if (allEmails.length > 0) {
      // F13: Batch .in() calls to avoid PostgREST URL length limits
      const BATCH_SIZE = 500;
      const uniqueEmails = [...new Set(allEmails)];

      const profiles: { id: string; email: string }[] = [];
      for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
        const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
        const { data } = await supabase
          .from('profiles')
          .select('id, email')
          .in('email', batch);
        if (data) profiles.push(...data);
      }

      if (profiles.length > 0) {
        const userIds = profiles.map((p) => p.id);
        const emailToUserId = new Map(profiles.map((p) => [p.email.toLowerCase(), p.id]));

        const members: { user_id: string; team_id: string }[] = [];
        for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
          const batch = userIds.slice(i, i + BATCH_SIZE);
          const { data } = await supabase
            .from('team_members')
            .select('user_id, team_id')
            .in('user_id', batch);
          if (data) members.push(...data);
        }

        if (members && members.length > 0) {
          // F8: Handle users belonging to multiple teams
          const userIdToTeamIds = new Map<string, string[]>();
          for (const m of members) {
            const existing = userIdToTeamIds.get(m.user_id) || [];
            existing.push(m.team_id);
            userIdToTeamIds.set(m.user_id, existing);
          }
          const dbTeamMap = new Map(dbTeams.map((t) => [t.id, t]));

          for (const [email, indices] of emailToRowIdx) {
            const userId = emailToUserId.get(email);
            if (!userId) continue;
            const teamIds = userIdToTeamIds.get(userId);
            if (!teamIds) continue;

            // Try each team the user belongs to, pick first available
            for (const teamId of teamIds) {
              const team = dbTeamMap.get(teamId);
              if (!team || usedTeamIds.has(team.id)) continue;

              for (const idx of indices) {
                if (!results[idx].matchedTeam) {
                  results[idx].matchedTeam = team;
                  results[idx].matchType = 'email';
                  results[idx].confidence = 0.8;
                  usedTeamIds.add(team.id);
                  break;
                }
              }
              break; // assigned, move to next email
            }
          }
        }
      }
    }
  }

  // POST: Generate team_codes per category+turn, ordered S → J → B
  const categoryOrder: TeamCategory[] = ['senior', 'junior', 'beginner'];
  const counters: Record<string, number> = {};

  for (const cat of categoryOrder) {
    const key = `${cat}-${turn}`;
    counters[key] = 0;
  }

  // Sort results: senior first, then junior, then beginner
  const sorted = results.slice().sort((a, b) => {
    return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
  });

  for (const r of sorted) {
    const key = `${r.category}-${turn}`;
    if (counters[key] === undefined) counters[key] = 0;
    r.teamCode = generateTeamCode(r.category, turn, counters[key]);
    counters[key]++;
  }

  // Return in original order with assigned codes
  return results;
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useEventTeamImport(eventId: string) {
  const queryClient = useQueryClient();

  // Fetch existing imported teams for this event
  const roster = useQuery({
    queryKey: ['event-teams-roster', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_teams')
        .select('*, team:teams(id, name)')
        .eq('event_id', eventId)
        .order('team_code');

      if (error) throw error;
      return data as (EventTeamImportRecord & { team: { id: string; name: string } })[];
    },
    enabled: !!eventId,
  });

  // Fetch all teams for matching
  const allTeams = useQuery({
    queryKey: ['all-teams-for-matching', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;
      return data as Team[];
    },
    enabled: !!eventId,
  });

  // Confirm import mutation
  const confirmImport = useMutation({
    mutationFn: async ({
      matches,
      turn,
      userId,
    }: {
      matches: MatchResult[];
      turn: TeamTurn;
      userId: string;
    }) => {
      const rows = matches
        .filter((m) => m.matchedTeam !== null)
        .map((m) => ({
          event_id: eventId,
          team_id: m.matchedTeam!.id,
          team_code: m.teamCode,
          category: m.category,
          turn,
          csv_team_name: m.csvName,
          match_type: m.matchType!,
          imported_by: userId,
        }));

      if (rows.length === 0) throw new Error('No hay equipos para importar');

      const { error } = await supabase
        .from('event_teams')
        .upsert(rows, { onConflict: 'event_id,team_id' });

      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams-roster', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
    },
  });

  // Clear import mutation
  const clearImport = useMutation({
    mutationFn: async () => {
      // F12: Count before delete for audit trail
      const { count } = await supabase
        .from('event_teams')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId);

      const { error } = await supabase
        .from('event_teams')
        .delete()
        .eq('event_id', eventId);

      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams-roster', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
    },
  });

  const toggleTeamActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('event_teams')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams-roster', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
    },
  });

  // ─── Add Manual Team mutation ────────────────────────────────────
  // One-off insert (or reactivation) of a single team without re-running the CSV
  // importer. Optionally assigns the team to a panel/subsession in one go.
  const addManualTeam = useMutation({
    mutationFn: async ({
      teamId,
      teamName,
      category,
      turn,
      teamCode,
      mode,
      userId,
      panel,
    }: {
      teamId: string;
      teamName: string;
      category: TeamCategory;
      turn: TeamTurn;
      teamCode: string;
      mode: 'insert' | 'reactivate';
      userId: string;
      panel?: { panelId: string; subsession: 1 | 2 };
    }): Promise<{ id: string; teamCode: string }> => {
      // Compute a fresh team_code from a server-side snapshot, used on retry
      // when the optimistic client-side calculation collides with another admin.
      const fetchNextCode = async (): Promise<string> => {
        const { data } = await supabase
          .from('event_teams')
          .select('team_code')
          .eq('event_id', eventId)
          .eq('category', category)
          .eq('turn', turn);
        const re = /^[A-Z][A-Z](\d+)$/;
        const max = (data ?? []).reduce((acc, r) => {
          const m = r.team_code.match(re);
          return m ? Math.max(acc, Number(m[1])) : acc;
        }, 0);
        return generateTeamCode(category, turn, max);
      };

      const isTeamCodeConflict = (err: { code?: string; message?: string }) =>
        err.code === '23505' && (err.message?.includes('team_code') ?? false);

      let attemptCode = teamCode;
      let createdId: string | null = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        if (mode === 'insert') {
          const { data, error } = await supabase
            .from('event_teams')
            .insert({
              event_id: eventId,
              team_id: teamId,
              team_code: attemptCode,
              category,
              turn,
              csv_team_name: teamName,
              match_type: 'manual' as TeamMatchType,
              imported_by: userId,
              is_active: true,
            })
            .select('id')
            .single();
          if (!error) {
            createdId = data!.id;
            break;
          }
          if (isTeamCodeConflict(error) && attempt === 1) {
            attemptCode = await fetchNextCode();
            continue;
          }
          throw error;
        } else {
          const { data, error } = await supabase
            .from('event_teams')
            .update({
              is_active: true,
              match_type: 'manual' as TeamMatchType,
              team_code: attemptCode,
              category,
              turn,
              imported_by: userId,
            })
            .eq('event_id', eventId)
            .eq('team_id', teamId)
            .select('id')
            .single();
          if (!error) {
            createdId = data!.id;
            break;
          }
          if (isTeamCodeConflict(error) && attempt === 1) {
            attemptCode = await fetchNextCode();
            continue;
          }
          throw error;
        }
      }

      if (!createdId) throw new Error('No se pudo añadir el equipo (código duplicado)');

      const rollback = async () => {
        try {
          if (mode === 'insert') {
            await supabase.from('event_teams').delete().eq('id', createdId!);
          } else {
            await supabase
              .from('event_teams')
              .update({ is_active: false })
              .eq('id', createdId!);
          }
        } catch {
          // Don't shadow the original error; surface that one instead.
        }
      };

      if (panel) {
        const { data: orderRows, error: orderErr } = await supabase
          .from('judging_panel_teams')
          .select('display_order')
          .eq('panel_id', panel.panelId)
          .eq('subsession', panel.subsession)
          .eq('is_active', true);
        if (orderErr) {
          await rollback();
          throw orderErr;
        }
        const nextOrder =
          (orderRows ?? []).reduce(
            (max, r) => Math.max(max, r.display_order ?? 0),
            0,
          ) + 1;

        const { error: insertErr } = await supabase
          .from('judging_panel_teams')
          .insert({
            panel_id: panel.panelId,
            team_id: teamId,
            team_code: attemptCode,
            subsession: panel.subsession,
            assignment_type: 'manual',
            assigned_by: userId,
            manual_change_by: userId,
            manual_change_at: new Date().toISOString(),
            display_order: nextOrder,
            is_active: true,
          });

        if (insertErr) {
          await rollback();
          throw insertErr;
        }
      }

      return { id: createdId, teamCode: attemptCode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams-roster', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      // Cross-domain invalidation: the optional panel insert touches state owned
      // by useJudgingAssignment.
      queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['judging-panels-list', eventId] });
    },
  });

  return {
    roster: roster.data ?? [],
    isLoadingRoster: roster.isLoading,
    allTeams: allTeams.data ?? [],
    isLoadingTeams: allTeams.isLoading,
    confirmImport,
    clearImport,
    toggleTeamActive,
    addManualTeam,
  };
}
