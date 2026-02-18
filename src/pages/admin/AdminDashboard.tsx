import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { WhitelistProgressCard } from "@/components/admin/WhitelistProgressCard";
import { TeamProgressCard } from "@/components/admin/TeamProgressCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, UsersRound } from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();
  // Fetch dashboard metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-dashboard-metrics"],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: verifiedUsers },
        { count: pendingUsers },
        { count: totalTeams },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("verification_status", "verified"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("verification_status", "pending"),
        supabase.from("teams").select("*", { count: "exact", head: true }),
      ]);

      return {
        totalUsers: totalUsers || 0,
        verifiedUsers: verifiedUsers || 0,
        pendingUsers: pendingUsers || 0,
        totalTeams: totalTeams || 0,
      };
    },
  });

  // Fetch registration progress stats from real profiles + roles
  const { data: whitelistStats, isLoading: isLoadingWhitelist } = useQuery({
    queryKey: ["admin-registration-progress"],
    queryFn: async () => {
      // Get all profiles with their verification status
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, verification_status");

      // Get all user roles to determine type breakdown
      const { data: allRoles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (!allProfiles) return null;

      const verifiedIds = new Set(
        allProfiles.filter(p => p.verification_status === "verified").map(p => p.id)
      );

      // Build a map of user_id -> role for breakdown
      const roleMap = new Map<string, string>();
      allRoles?.forEach(r => {
        // Map app_role to display type
        const displayType =
          r.role === "participant" ? "student" :
          r.role === "mentor" ? "mentor" :
          r.role === "judge" ? "judge" : null;
        if (displayType) roleMap.set(r.user_id, displayType);
      });

      const stats = {
        total: allProfiles.length,
        registered: verifiedIds.size,
        byType: {
          student: { total: 0, registered: 0 },
          mentor: { total: 0, registered: 0 },
          judge: { total: 0, registered: 0 },
        },
      };

      // Count by role (only verified users have roles assigned)
      roleMap.forEach((type, userId) => {
        if (type in stats.byType) {
          const key = type as keyof typeof stats.byType;
          stats.byType[key].total++;
          if (verifiedIds.has(userId)) {
            stats.byType[key].registered++;
          }
        }
      });

      return stats;
    },
  });

  // Fetch team registration stats (based on real team_members, not whitelist)
  const { data: teamStats, isLoading: isLoadingTeamStats } = useQuery({
    queryKey: ["admin-team-registration-stats"],
    queryFn: async () => {
      // Total teams
      const { count: totalTeams } = await supabase
        .from("teams")
        .select("*", { count: "exact", head: true });

      // Teams with at least 1 registered participant (in team_members)
      const { data: teamsWithMembers } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("member_type", "participant");

      const uniqueTeamIds = new Set(teamsWithMembers?.map(tm => tm.team_id) || []);

      // Breakdown by category
      const { data: allTeams } = await supabase
        .from("teams")
        .select("id, category");

      const byCategory = {
        beginner: { total: 0, active: 0 },
        junior: { total: 0, active: 0 },
        senior: { total: 0, active: 0 },
      };

      allTeams?.forEach(team => {
        const cat = team.category as keyof typeof byCategory;
        if (cat && byCategory[cat]) {
          byCategory[cat].total++;
          if (uniqueTeamIds.has(team.id)) byCategory[cat].active++;
        }
      });

      return {
        total: totalTeams || 0,
        withParticipants: uniqueTeamIds.size,
        byCategory,
      };
    },
  });

  // Fetch upcoming events with real registration counts
  const { data: upcomingEventsList } = useQuery({
    queryKey: ["admin-upcoming-events"],
    queryFn: async () => {
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true })
        .limit(5);

      if (!eventsData || eventsData.length === 0) return [];

      const eventIds = eventsData.map(e => e.id);

      // Get non-cancelled, non-companion registrations for these events
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("id, event_id")
        .in("event_id", eventIds)
        .neq("registration_status", "cancelled")
        .eq("is_companion", false);

      // Get companions for those registrations
      const regIds = registrations?.map(r => r.id) || [];
      const { data: companions } = regIds.length > 0
        ? await supabase
            .from("companions")
            .select("event_registration_id")
            .in("event_registration_id", regIds)
        : { data: [] };

      // Build count maps
      const regCounts = new Map<string, number>();
      registrations?.forEach(r => {
        regCounts.set(r.event_id!, (regCounts.get(r.event_id!) || 0) + 1);
      });

      const regToEvent = new Map<string, string>();
      registrations?.forEach(r => regToEvent.set(r.id, r.event_id!));

      const companionCounts = new Map<string, number>();
      companions?.forEach(c => {
        const eventId = regToEvent.get(c.event_registration_id!);
        if (eventId) {
          companionCounts.set(eventId, (companionCounts.get(eventId) || 0) + 1);
        }
      });

      return eventsData.map(event => ({
        ...event,
        real_registrations: (regCounts.get(event.id) || 0) + (companionCounts.get(event.id) || 0),
      }));
    },
  });

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Usuarios"
            value={metrics?.totalUsers || 0}
            icon={<Users className="h-6 w-6" />}
            color="primary"
          />
          <MetricCard
            title="Verificados"
            value={metrics?.verifiedUsers || 0}
            icon={<UserCheck className="h-6 w-6" />}
            color="success"
          />
          <MetricCard
            title="Pendientes"
            value={metrics?.pendingUsers || 0}
            icon={<Clock className="h-6 w-6" />}
            color="warning"
            onClick={() => navigate("/admin/users?status=pending")}
          />
          <MetricCard
            title="Equipos"
            value={metrics?.totalTeams || 0}
            icon={<UsersRound className="h-6 w-6" />}
            color="info"
          />
        </div>

        {/* Progress Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <WhitelistProgressCard stats={whitelistStats} isLoading={isLoadingWhitelist} />
          <TeamProgressCard stats={teamStats} isLoading={isLoadingTeamStats} />
        </div>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos Próximos</CardTitle>
            <CardDescription>Próximos eventos programados</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingEventsList && upcomingEventsList.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {upcomingEventsList.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-3 sm:p-4"
                  >
                    <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                      <span className="font-medium truncate">{event.name}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground truncate">
                        {event.location_name || event.location} • {new Date(event.date).toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                      <span className="text-sm font-medium">
                        {event.real_registrations || 0} / {event.max_capacity || "∞"}
                      </span>
                      <span className="text-xs text-muted-foreground">registrados</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-24 sm:h-32 items-center justify-center text-muted-foreground text-sm">
                No hay eventos próximos programados
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
