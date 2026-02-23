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
      // 1. Fetch ALL teams with their members (source of truth for roster)
      const [membersResult, registrationsResult] = await Promise.all([
        supabase
          .from("team_members")
          .select(
            `team_id, user_id, member_type,
             team:teams!team_members_team_id_fkey(id, name, category),
             user:profiles!team_members_user_id_fkey(first_name, last_name, email)`
          ),
        // 2. Fetch ALL active registrations for this event (no team_id filter)
        supabase
          .from("event_registrations")
          .select("user_id")
          .eq("event_id", eventId)
          .eq("is_companion", false)
          .neq("registration_status", "cancelled"),
      ]);

      if (membersResult.error) throw membersResult.error;
      if (registrationsResult.error) throw registrationsResult.error;

      const members = membersResult.data || [];
      const registrations = registrationsResult.data || [];

      if (members.length === 0) return [];

      // 3. Build set of registered user_ids (event-wide, not per-team)
      const registeredUserIds = new Set(
        registrations
          .map((r) => r.user_id)
          .filter((id): id is string => !!id)
      );

      // 4. Build team stats from team_members
      const teamStatsMap = new Map<string, TeamEventStats>();

      members.forEach((m) => {
        if (!m.team_id || !m.user_id) return;

        const team = m.team as {
          id: string;
          name: string;
          category: string | null;
        } | null;
        if (!team) return;

        // Initialize team entry if first member
        if (!teamStatsMap.has(m.team_id)) {
          teamStatsMap.set(m.team_id, {
            teamId: m.team_id,
            teamName: team.name,
            category: team.category,
            totalParticipants: 0,
            registeredParticipants: 0,
            totalMentors: 0,
            registeredMentors: 0,
            completionPercentage: 0,
            members: [],
          });
        }

        const stats = teamStatsMap.get(m.team_id)!;
        const isRegistered = registeredUserIds.has(m.user_id);
        const memberType: "participant" | "mentor" =
          m.member_type === "mentor" ? "mentor" : "participant";

        if (memberType === "participant") {
          stats.totalParticipants++;
          if (isRegistered) stats.registeredParticipants++;
        } else {
          stats.totalMentors++;
          if (isRegistered) stats.registeredMentors++;
        }

        const user = m.user as {
          first_name: string | null;
          last_name: string | null;
          email: string;
        } | null;
        const name =
          user?.first_name && user?.last_name
            ? `${user.first_name} ${user.last_name}`
            : user?.email || "Desconocido";

        stats.members.push({ userId: m.user_id, name, memberType, isRegistered });
      });

      // 5. Calculate completion and sort
      const result = Array.from(teamStatsMap.values());
      result.forEach((s) => {
        const total = s.totalParticipants + s.totalMentors;
        const registered = s.registeredParticipants + s.registeredMentors;
        s.completionPercentage =
          total > 0 ? Math.round((registered / total) * 100) : 0;
      });

      // Incomplete first, then alphabetically
      result.sort((a, b) => {
        if (a.completionPercentage === 100 && b.completionPercentage !== 100)
          return 1;
        if (a.completionPercentage !== 100 && b.completionPercentage === 100)
          return -1;
        return a.teamName.localeCompare(b.teamName);
      });

      return result;
    },
  });
}
