import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TeamMemberDetail {
  userId: string;
  name: string;
  email: string;
  memberType: "participant" | "mentor";
  isRegistered: boolean;
  isCancelled: boolean;
}

export interface TeamEventStats {
  teamId: string;
  teamName: string;
  category: string | null;
  validated: boolean;
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
      // 1. Fetch registrations for this event (including cancelled — needed for cancelledUserIds)
      const { data: registrations, error: regError } = await supabase
        .from("event_registrations")
        .select("team_id, user_id, registration_status")
        .eq("event_id", eventId)
        .eq("is_companion", false);

      if (regError) throw regError;
      if (!registrations || registrations.length === 0) return [];

      // 2. Extract team_ids directly from registrations
      const directTeamIds = new Set(
        registrations.map(r => r.team_id).filter((id): id is string => !!id)
      );

      // 3. Fallback: resolve team_ids for registrations with null team_id
      const userIdsWithoutTeam = registrations
        .filter(r => !r.team_id && r.user_id)
        .map(r => r.user_id)
        .filter((id): id is string => !!id);

      if (userIdsWithoutTeam.length > 0) {
        const { data: memberships, error: memError } = await supabase
          .from("team_members")
          .select("team_id")
          .in("user_id", userIdsWithoutTeam)
          .not("team_id", "is", null);

        if (memError) throw memError;
        memberships?.forEach(m => {
          if (m.team_id) directTeamIds.add(m.team_id);
        });
      }

      const allTeamIds = [...directTeamIds];
      if (allTeamIds.length === 0) return [];

      // 4. Fetch scoped team_members (only teams relevant to this event)
      const { data: members, error: membersError } = await supabase
        .from("team_members")
        .select(
          `team_id, user_id, member_type,
           team:teams!team_members_team_id_fkey(id, name, category, validated),
           user:profiles!team_members_user_id_fkey(first_name, last_name, email)`
        )
        .in("team_id", allTeamIds);

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // 5. Build sets of registered and cancelled user_ids (event-wide)
      const registeredUserIds = new Set(
        registrations
          .filter((r) => r.registration_status !== "cancelled")
          .map((r) => r.user_id)
          .filter((id): id is string => !!id)
      );
      const cancelledUserIds = new Set(
        registrations
          .filter((r) => r.registration_status === "cancelled")
          .map((r) => r.user_id)
          .filter((id): id is string => !!id)
      );

      // 6. Build team stats from team_members
      const teamStatsMap = new Map<string, TeamEventStats>();

      members.forEach((m) => {
        if (!m.team_id || !m.user_id) return;

        const team = m.team as {
          id: string;
          name: string;
          category: string | null;
          validated: boolean | null;
        } | null;
        if (!team) return;

        // Initialize team entry if first member
        if (!teamStatsMap.has(m.team_id)) {
          teamStatsMap.set(m.team_id, {
            teamId: m.team_id,
            teamName: team.name,
            category: team.category,
            validated: team.validated ?? false,
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

        const isCancelled = cancelledUserIds.has(m.user_id);
        stats.members.push({ userId: m.user_id, name, email: user?.email || "", memberType, isRegistered, isCancelled });
      });

      // 7. Filter: only teams with at least 1 registered member
      const result = Array.from(teamStatsMap.values()).filter(
        (s) => s.registeredParticipants + s.registeredMentors > 0
      );

      // 8. Calculate completion and sort
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
    enabled: !!eventId,
  });
}
