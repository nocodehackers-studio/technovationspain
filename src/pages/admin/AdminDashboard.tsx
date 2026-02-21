import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabase-utils";
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

  // Fetch registration progress stats from profiles + roles
  const { data: whitelistStats, isLoading: isLoadingWhitelist } = useQuery({
    queryKey: ["admin-registration-progress"],
    queryFn: async () => {
      // 1. Get ALL profiles with type info (paginated to avoid 1000-row limit)
      const allProfiles = await fetchAllRows<{
        id: string;
        verification_status: string | null;
        onboarding_completed: boolean;
        profile_type: string | null;
      }>("profiles", "id, verification_status, onboarding_completed, profile_type");

      // 2. Get ALL user_roles (paginated)
      const allRoles = await fetchAllRows<{ user_id: string; role: string }>(
        "user_roles", "user_id, role",
      );

      if (allProfiles.length === 0) return null;

      // 3. Build role map from user_roles (primary source)
      const roleFromTable = new Map<string, string>();
      allRoles.forEach(r => {
        const displayType =
          r.role === "participant" ? "student" :
          r.role === "mentor" ? "mentor" :
          r.role === "judge" ? "judge" : null;
        if (displayType) roleFromTable.set(r.user_id, displayType);
      });

      // 4. Map profile_type values to display types (fallback for users without user_roles)
      const mapProfileType = (pt: string | null): string | null => {
        if (!pt) return null;
        const lower = pt.toLowerCase().trim();
        if (lower === "student" || lower === "participant") return "student";
        if (lower === "mentor") return "mentor";
        if (lower === "judge") return "judge";
        return null; // admin, chapter_ambassador, etc. excluded
      };

      // 5. Build combined stats: user_roles takes priority, profile_type as fallback
      const stats = {
        total: 0,
        registered: 0,
        byType: {
          student: { total: 0, registered: 0 },
          mentor: { total: 0, registered: 0 },
          judge: { total: 0, registered: 0 },
        },
      };

      for (const p of allProfiles) {
        const type = roleFromTable.get(p.id) ?? mapProfileType(p.profile_type);
        if (!type) continue; // skip admins/unknown/no type

        const key = type as keyof typeof stats.byType;
        stats.total++;
        stats.byType[key].total++;

        const isRegistered = p.onboarding_completed === true;
        if (isRegistered) {
          stats.registered++;
          stats.byType[key].registered++;
        }
      }

      return stats.total > 0 ? stats : null;
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
