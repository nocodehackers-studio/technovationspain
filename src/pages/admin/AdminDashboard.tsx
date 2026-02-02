import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { WhitelistProgressCard } from "@/components/admin/WhitelistProgressCard";
import { TeamProgressCard } from "@/components/admin/TeamProgressCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, UsersRound } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

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

  const { data: roleDistribution } = useQuery({
    queryKey: ["admin-role-distribution"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role");
      
      const counts: Record<string, number> = {
        participant: 0,
        mentor: 0,
        judge: 0,
        volunteer: 0,
        admin: 0,
      };

      data?.forEach((row) => {
        if (row.role in counts) {
          counts[row.role]++;
        }
      });

      return [
        { name: "Participantes", value: counts.participant, color: "hsl(270 80% 55%)" },
        { name: "Mentores", value: counts.mentor, color: "hsl(200 90% 50%)" },
        { name: "Jueces", value: counts.judge, color: "hsl(175 80% 45%)" },
        { name: "Voluntarios", value: counts.volunteer, color: "hsl(150 80% 42%)" },
        { name: "Admins", value: counts.admin, color: "hsl(35 95% 55%)" },
      ];
    },
  });

  // Fetch verification status distribution
  const { data: verificationDistribution } = useQuery({
    queryKey: ["admin-verification-distribution"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("verification_status");
      
      const counts: Record<string, number> = {
        verified: 0,
        pending: 0,
        manual_review: 0,
        rejected: 0,
      };

      data?.forEach((row) => {
        if (row.verification_status in counts) {
          counts[row.verification_status]++;
        }
      });

      return [
        { name: "Verificados", value: counts.verified, fill: "hsl(150 80% 42%)" },
        { name: "Pendientes", value: counts.pending, fill: "hsl(35 95% 55%)" },
        { name: "Revisión Manual", value: counts.manual_review, fill: "hsl(25 90% 50%)" },
        { name: "Rechazados", value: counts.rejected, fill: "hsl(0 84% 60%)" },
      ];
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

  const chartConfig = {
    value: {
      label: "Cantidad",
    },
  };

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

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Role Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Rol</CardTitle>
              <CardDescription>Usuarios activos por tipo de rol</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                      className="[&_.recharts-pie-label-text]:hidden sm:[&_.recharts-pie-label-text]:block"
                    >
                      {roleDistribution?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Verification Status */}
          <Card>
            <CardHeader>
              <CardTitle>Estado de Verificación</CardTitle>
              <CardDescription>Distribución de estados de verificación</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={verificationDistribution || []} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
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
