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
    if (!data || data.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
            if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n")) {
              return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
          })
          .join(",")
      ),
    ];

    const blob = new Blob(["\ufeff" + csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`${filename} exportado correctamente`);
  };

  const exportTable = async (tableName: string, displayName: string) => {
    toast.loading(`Exportando ${displayName}...`, { id: "export" });

    const { data, error } = await supabase
      .from(tableName as "profiles" | "user_roles" | "authorized_students" | "teams" | "team_members" | "events" | "event_registrations" | "companions" | "hubs" | "audit_logs")
      .select("*");

    toast.dismiss("export");

    if (error) {
      toast.error(`Error al exportar: ${error.message}`);
      return;
    }

    exportToCSV(data || [], displayName);
  };

  const exportEventRegistrations = async () => {
    if (!selectedEventId) {
      toast.error("Selecciona un evento primero");
      return;
    }

    toast.loading("Exportando registros del evento...", { id: "export" });

    const { data, error } = await supabase
      .from("event_registrations")
      .select(`
        registration_number,
        first_name,
        last_name,
        email,
        phone,
        team_name,
        team_id_tg,
        tg_email,
        registration_status,
        checked_in_at,
        image_consent,
        data_consent,
        created_at,
        ticket_type:event_ticket_types(name)
      `)
      .eq("event_id", selectedEventId);

    toast.dismiss("export");

    if (error) {
      toast.error(`Error al exportar: ${error.message}`);
      return;
    }

    const flatData = data?.map((r) => ({
      ...r,
      ticket_type: r.ticket_type?.name || "",
    }));

    const eventName = events?.find((e) => e.id === selectedEventId)?.name || "evento";
    exportToCSV(flatData || [], `registros_${eventName.replace(/\s+/g, "_")}`);
  };

  const COLORS = ["hsl(270, 80%, 55%)", "hsl(200, 90%, 50%)", "hsl(175, 80%, 45%)", "hsl(150, 80%, 42%)", "hsl(35, 95%, 55%)"];

  return (
    <AdminLayout title="Reportes">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Reportes y Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Visualiza estadísticas y exporta datos de la plataforma
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="w-full overflow-x-auto justify-start sm:justify-center">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Eventos</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Actividad</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToCSV(
                    userStats?.roleDistribution || [],
                    "usuarios_por_rol"
                  )
                }
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Role Distribution */}
              <Card>
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">Distribución por Rol</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Usuarios activos por tipo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px]">
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
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">Estado de Verificación</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Distribución de estados</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={userStats?.verificationDistribution || []} layout="vertical">
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="hsl(270, 80%, 55%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Weekly Registrations */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">Registros Semanales</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Nuevos usuarios en las últimas 8 semanas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px]">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="w-full sm:w-[300px]">
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
                <Button variant="outline" size="sm" onClick={() => toast.info("Exportación en desarrollo")}>
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Exportar Lista</span>
                </Button>
              )}
            </div>

            {selectedEventId && eventStats ? (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">{eventStats.totalRegistrations}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Registrados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">{eventStats.checkedIn}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Check-in</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">
                      {eventStats.totalRegistrations > 0
                        ? Math.round((eventStats.checkedIn / eventStats.totalRegistrations) * 100)
                        : 0}%
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Asistencia</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">{eventStats.companions}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Acompañantes</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="flex h-32 sm:h-40 items-center justify-center text-muted-foreground text-sm">
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

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Exportar Datos en Bruto</CardTitle>
                <CardDescription>
                  Descarga los datos completos de la plataforma en formato CSV
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Usuarios */}
                <div className="space-y-2">
                  <h3 className="font-medium">Usuarios</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Button
                      variant="outline"
                      onClick={() => exportTable("profiles", "usuarios")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Perfiles (profiles)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportTable("user_roles", "roles_usuario")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Roles de Usuario
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportTable("authorized_students", "estudiantes_autorizados")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Estudiantes Autorizados
                    </Button>
                  </div>
                </div>

                {/* Equipos */}
                <div className="space-y-2">
                  <h3 className="font-medium">Equipos</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Button
                      variant="outline"
                      onClick={() => exportTable("teams", "equipos")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Equipos (teams)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportTable("team_members", "miembros_equipo")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Miembros de Equipo
                    </Button>
                  </div>
                </div>

                {/* Eventos */}
                <div className="space-y-2">
                  <h3 className="font-medium">Eventos</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Button
                      variant="outline"
                      onClick={() => exportTable("events", "eventos")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Eventos
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportTable("event_registrations", "todos_registros_eventos")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Todos los Registros
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportTable("companions", "acompanantes")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Acompañantes
                    </Button>
                  </div>
                </div>

                {/* Evento específico */}
                <div className="space-y-2">
                  <h3 className="font-medium">Registros por Evento</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger className="w-full sm:w-[300px]">
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
                    <Button
                      variant="default"
                      onClick={exportEventRegistrations}
                      disabled={!selectedEventId}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Exportar Registros
                    </Button>
                  </div>
                </div>

                {/* Otros */}
                <div className="space-y-2">
                  <h3 className="font-medium">Otros</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Button
                      variant="outline"
                      onClick={() => exportTable("hubs", "hubs")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Hubs
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportTable("audit_logs", "logs_auditoria")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Logs de Auditoría
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
