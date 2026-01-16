import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { Download, Users, Calendar, GraduationCap, FileText } from "lucide-react";
import { toast } from "sonner";

export default function AdminReports() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Fetch events
  const { data: events } = useQuery({
    queryKey: ["admin-events-list-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, date")
        .order("date", { ascending: false });
      return data || [];
    },
  });

  // Fetch user stats
  const { data: userStats } = useQuery({
    queryKey: ["admin-reports-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("created_at, verification_status");
      const { data: roles } = await supabase.from("user_roles").select("role");

      // Role distribution
      const roleDistribution = {
        participant: 0,
        mentor: 0,
        judge: 0,
        volunteer: 0,
        admin: 0,
      };
      roles?.forEach((r) => {
        if (r.role in roleDistribution) {
          roleDistribution[r.role as keyof typeof roleDistribution]++;
        }
      });

      // Verification distribution
      const verificationDistribution = {
        verified: 0,
        pending: 0,
        manual_review: 0,
        rejected: 0,
      };
      profiles?.forEach((p) => {
        if (p.verification_status in verificationDistribution) {
          verificationDistribution[p.verification_status as keyof typeof verificationDistribution]++;
        }
      });

      // Weekly registrations (last 8 weeks)
      const weeklyData: { week: string; count: number }[] = [];
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const count = profiles?.filter((p) => {
          const created = new Date(p.created_at || "");
          return created >= weekStart && created < weekEnd;
        }).length || 0;

        weeklyData.push({
          week: weekStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
          count,
        });
      }

      return {
        total: profiles?.length || 0,
        roleDistribution: Object.entries(roleDistribution).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        })),
        verificationDistribution: Object.entries(verificationDistribution).map(([name, value]) => ({
          name,
          value,
        })),
        weeklyRegistrations: weeklyData,
      };
    },
  });

  // Fetch event stats
  const { data: eventStats } = useQuery({
    queryKey: ["admin-reports-events", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("*, profiles(first_name, last_name), user_roles(role)")
        .eq("event_id", selectedEventId);

      const { data: companions } = await supabase
        .from("companions")
        .select("*, event_registrations!inner(event_id)")
        .eq("event_registrations.event_id", selectedEventId);

      // Role breakdown
      const roleBreakdown = { participants: 0, mentors: 0, companions: companions?.length || 0 };
      
      return {
        totalRegistrations: registrations?.length || 0,
        checkedIn: registrations?.filter((r) => r.checked_in_at).length || 0,
        roleBreakdown,
        companions: companions?.length || 0,
      };
    },
  });

  // Fetch audit logs
  const { data: auditLogs } = useQuery({
    queryKey: ["admin-reports-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const chartConfig = {
    value: { label: "Cantidad" },
    count: { label: "Registros" },
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) {
      toast.error("No hay datos para exportar");
      return;
    }
    
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Archivo exportado correctamente");
  };

  const COLORS = ["hsl(270, 80%, 55%)", "hsl(200, 90%, 50%)", "hsl(175, 80%, 45%)", "hsl(150, 80%, 42%)", "hsl(35, 95%, 55%)"];

  return (
    <AdminLayout title="Reportes">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes y Analytics</h1>
          <p className="text-muted-foreground">
            Visualiza estadísticas y exporta datos de la plataforma
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Calendar className="h-4 w-4" />
              Eventos
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <FileText className="h-4 w-4" />
              Actividad
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() =>
                  exportToCSV(
                    userStats?.roleDistribution || [],
                    "usuarios_por_rol"
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Role Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Rol</CardTitle>
                  <CardDescription>Usuarios activos por tipo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={userStats?.roleDistribution || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {userStats?.roleDistribution?.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
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
                  <CardDescription>Distribución de estados</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={userStats?.verificationDistribution || []} layout="vertical">
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="hsl(270, 80%, 55%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Weekly Registrations */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Registros Semanales</CardTitle>
                  <CardDescription>Nuevos usuarios en las últimas 8 semanas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userStats?.weeklyRegistrations || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="hsl(270, 80%, 55%)"
                          strokeWidth={2}
                          dot={{ fill: "hsl(270, 80%, 55%)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            <div className="flex items-center justify-between">
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Seleccionar evento" />
                </SelectTrigger>
                <SelectContent>
                  {events?.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedEventId && (
                <Button variant="outline" onClick={() => toast.info("Exportación en desarrollo")}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Lista de Asistencia
                </Button>
              )}
            </div>

            {selectedEventId && eventStats ? (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{eventStats.totalRegistrations}</div>
                    <p className="text-sm text-muted-foreground">Total Registrados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{eventStats.checkedIn}</div>
                    <p className="text-sm text-muted-foreground">Check-in Realizados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {eventStats.totalRegistrations > 0
                        ? Math.round((eventStats.checkedIn / eventStats.totalRegistrations) * 100)
                        : 0}%
                    </div>
                    <p className="text-sm text-muted-foreground">Tasa de Asistencia</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{eventStats.companions}</div>
                    <p className="text-sm text-muted-foreground">Acompañantes</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
                  Selecciona un evento para ver las estadísticas
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Logs de Auditoría</CardTitle>
                <CardDescription>Últimas 50 acciones registradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditLogs && auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{log.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {log.entity_type} • {new Date(log.timestamp || "").toLocaleString("es-ES")}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {log.entity_id?.slice(0, 8)}...
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                      No hay logs de auditoría
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
