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

  // Fetch whitelist stats
  const { data: whitelistStats, isLoading: isLoadingWhitelist } = useQuery({
    queryKey: ["admin-whitelist-stats"],
    queryFn: async () => {
      // Get all authorized_users with their registration status
      const { data: allUsers } = await supabase
        .from("authorized_users")
        .select("profile_type, matched_profile_id");

      if (!allUsers) return null;

      const stats = {
        total: allUsers.length,
        registered: allUsers.filter(u => u.matched_profile_id !== null).length,
        byType: {
          student: { total: 0, registered: 0 },
          mentor: { total: 0, registered: 0 },
          judge: { total: 0, registered: 0 },
        },
      };

      allUsers.forEach((user) => {
        const type = user.profile_type as keyof typeof stats.byType;
        if (type in stats.byType) {
          stats.byType[type].total++;
          if (user.matched_profile_id !== null) {
            stats.byType[type].registered++;
          }
        }
      });

      return stats;
    },
  });

  // Fetch team registration stats
  const { data: teamStats, isLoading: isLoadingTeamStats } = useQuery({
    queryKey: ["admin-team-registration-stats"],
    queryFn: async () => {
      // Get all teams
      const { data: teams } = await supabase.from("teams").select("id, name");
      
      // Get whitelist stats by team
      const { data: whitelist } = await supabase
        .from("authorized_users")
        .select("team_name, matched_profile_id")
        .not("team_name", "is", null);
      
      if (!teams) return null;
      
      // Calculate stats per team
      const teamStatsMap = new Map<string, { whitelist: number; registered: number }>();
      
      whitelist?.forEach(u => {
        const key = u.team_name?.toLowerCase();
        if (!key) return;
        const current = teamStatsMap.get(key) || { whitelist: 0, registered: 0 };
        current.whitelist++;
        if (u.matched_profile_id) current.registered++;
        teamStatsMap.set(key, current);
      });
      
      // Classify teams
      let complete = 0, inProgress = 0, notStarted = 0, noData = 0;
      
      teams.forEach(team => {
        const stats = teamStatsMap.get(team.name.toLowerCase());
        if (!stats || stats.whitelist === 0) {
          noData++;
        } else if (stats.registered === stats.whitelist) {
          complete++;
        } else if (stats.registered > 0) {
          inProgress++;
        } else {
          notStarted++;
        }
      });
      
      return {
        total: teams.length,
        complete,
        inProgress,
        notStarted,
        noData,
        active: complete + inProgress,
      };
    },
  });

  // Fetch upcoming events
  const { data: upcomingEventsList } = useQuery({
    queryKey: ["admin-upcoming-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true })
        .limit(5);
      
      return data || [];
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
                        {event.current_registrations || 0} / {event.max_capacity || "∞"}
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
