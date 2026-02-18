import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TeamMemberDetail {
  userId: string;
  name: string;
  memberType: "participant" | "mentor";
  isRegistered: boolean;
}

export interface TeamEventStats {
  teamId: string;
  teamName: string;
  category: string | null;
  totalParticipants: number;
  registeredParticipants: number;
  totalMentors: number;
  registeredMentors: number;
  completionPercentage: number;
  members: TeamMemberDetail[];
}

export function useEventTeamStats(eventId: string) {
  return useQuery({
    queryKey: ["event-team-stats", eventId],
    queryFn: async (): Promise<TeamEventStats[]> => {
      // 1. Get registrations for this event that have a team_id
      const { data: registrations, error: regError } = await supabase
        .from("event_registrations")
        .select("team_id, user_id")
        .eq("event_id", eventId)
        .eq("is_companion", false)
        .neq("registration_status", "cancelled")
        .not("team_id", "is", null);

      if (regError) throw regError;
      if (!registrations || registrations.length === 0) return [];

      // 2. Get unique team IDs
      const teamIds = [
        ...new Set(
          registrations.map((r) => r.team_id).filter((id): id is string => !!id)
        ),
      ];
      if (teamIds.length === 0) return [];

      // 3. Get team info + all team_members in parallel
      const [teamsResult, membersResult] = await Promise.all([
        supabase.from("teams").select("id, name, category").in("id", teamIds),
        supabase
          .from("team_members")
          .select(
            `team_id, user_id, member_type,
             user:profiles!team_members_user_id_fkey(first_name, last_name, email)`
          )
          .in("team_id", teamIds),
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (membersResult.error) throw membersResult.error;

      // 4. Build set of registered user_ids per team
      const registeredByTeam = new Map<string, Set<string>>();
      registrations.forEach((r) => {
        if (!r.team_id || !r.user_id) return;
        if (!registeredByTeam.has(r.team_id)) {
          registeredByTeam.set(r.team_id, new Set());
        }
        registeredByTeam.get(r.team_id)!.add(r.user_id);
      });

      // 5. Build team stats
      const teamsMap = new Map(
        teamsResult.data?.map((t) => [t.id, t]) || []
      );

      const teamStatsMap = new Map<string, TeamEventStats>();
      teamIds.forEach((teamId) => {
        const team = teamsMap.get(teamId);
        if (!team) return;
        teamStatsMap.set(teamId, {
          teamId,
          teamName: team.name,
          category: team.category,
          totalParticipants: 0,
          registeredParticipants: 0,
          totalMentors: 0,
          registeredMentors: 0,
          completionPercentage: 0,
          members: [],
        });
      });

      // 6. Populate from team_members
      membersResult.data?.forEach((m) => {
        if (!m.team_id || !m.user_id) return;
        const stats = teamStatsMap.get(m.team_id);
        if (!stats) return;

        const user = m.user as {
          first_name: string | null;
          last_name: string | null;
          email: string;
        } | null;
        const isRegistered =
          registeredByTeam.get(m.team_id)?.has(m.user_id) || false;
        const memberType: "participant" | "mentor" =
          m.member_type === "mentor" ? "mentor" : "participant";

        if (memberType === "participant") {
          stats.totalParticipants++;
          if (isRegistered) stats.registeredParticipants++;
        } else {
          stats.totalMentors++;
          if (isRegistered) stats.registeredMentors++;
        }

        const name =
          user?.first_name && user?.last_name
            ? `${user.first_name} ${user.last_name}`
            : user?.email || "Desconocido";

        stats.members.push({ userId: m.user_id, name, memberType, isRegistered });
      });

      // 7. Calculate completion and sort
      const result = Array.from(teamStatsMap.values());
      result.forEach((s) => {
        const total = s.totalParticipants + s.totalMentors;
        const registered = s.registeredParticipants + s.registeredMentors;
        s.completionPercentage = total > 0 ? Math.round((registered / total) * 100) : 0;
      });

      // Incomplete first, then alphabetically
      result.sort((a, b) => {
        if (a.completionPercentage === 100 && b.completionPercentage !== 100) return 1;
        if (a.completionPercentage !== 100 && b.completionPercentage === 100) return -1;
        return a.teamName.localeCompare(b.teamName);
      });

      return result;
    },
  });
}
