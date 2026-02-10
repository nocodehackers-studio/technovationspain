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
import { Download, Users, Calendar, FileText, Database } from "lucide-react";
import { toast } from "sonner";
import { startOfWeek, addWeeks, addDays, format } from "date-fns";
import { es } from "date-fns/locale";

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

  // Fetch user stats - with higher limit to avoid missing recent registrations
  const { data: userStats } = useQuery({
    queryKey: ["admin-reports-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("created_at, verification_status")
        .limit(10000);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .limit(10000);

      // Role distribution
      const roleDistribution: Record<string, number> = {
        participant: 0,
        mentor: 0,
        judge: 0,
        volunteer: 0,
        admin: 0,
      };
      roles?.forEach((r) => {
        if (r.role in roleDistribution) {
          roleDistribution[r.role]++;
        }
      });

      // Verification distribution
      const verificationDistribution: Record<string, number> = {
        verified: 0,
        pending: 0,
        manual_review: 0,
        rejected: 0,
      };
      profiles?.forEach((p) => {
        if (p.verification_status && p.verification_status in verificationDistribution) {
          verificationDistribution[p.verification_status]++;
        }
      });

      // Weekly registrations (last 8 weeks) - Monday-based weeks
      const weeklyData: { week: string; count: number }[] = [];
      const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      for (let i = 7; i >= 0; i--) {
        const wStart = addWeeks(currentWeekStart, -i);
        const wEnd = addDays(wStart, 7);

        const count = profiles?.filter((p) => {
          const created = new Date(p.created_at || "");
          return created >= wStart && created < wEnd;
        }).length || 0;

        weeklyData.push({
          week: format(wStart, "dd MMM", { locale: es }),
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

  // Fetch event stats - using ticket types for role breakdown
  const { data: eventStats } = useQuery({
    queryKey: ["admin-reports-events", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select(`
          id, registration_status, checked_in_at, is_companion,
          ticket_type:event_ticket_types(id, name, allowed_roles)
        `)
        .eq("event_id", selectedEventId)
        .neq("registration_status", "cancelled");

      const mainRegs = registrations?.filter((r) => !r.is_companion) || [];
      const companionRegs = registrations?.filter((r) => r.is_companion) || [];

      // Also count from companions table
      const regIds = mainRegs.map((r) => r.id);
      let companionsCount = companionRegs.length;
      if (regIds.length > 0) {
        const { count } = await supabase
          .from("companions")
          .select("id", { count: "exact", head: true })
          .in("event_registration_id", regIds);
        companionsCount = Math.max(companionsCount, count || 0);
      }

      // Role breakdown from ticket types
      const participants = mainRegs.filter((r) =>
        r.ticket_type?.allowed_roles?.includes("participant")
      ).length;
      const mentors = mainRegs.filter((r) =>
        r.ticket_type?.allowed_roles?.includes("mentor") ||
        r.ticket_type?.allowed_roles?.includes("judge")
      ).length;

      return {
        totalRegistrations: mainRegs.length,
        checkedIn: mainRegs.filter((r) => r.checked_in_at).length,
        roleBreakdown: { participants, mentors, companions: companionsCount },
        companions: companionsCount,
        totalAttendees: mainRegs.length + companionsCount,
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
  };

  const exportTable = async (tableName: string, displayName: string) => {
    const toastId = toast.loading(`Exportación en curso...`);

    const { data, error } = await supabase
      .from(tableName as "profiles" | "user_roles" | "authorized_users" | "teams" | "events" | "event_registrations" | "companions" | "hubs" | "audit_logs")
      .select("*")
      .limit(10000);

    if (error) {
      toast.dismiss(toastId);
      toast.error(`Error al exportar: ${error.message}`);
      return;
    }

    exportToCSV(data || [], displayName);
    toast.dismiss(toastId);
    toast.success(`${displayName} exportado correctamente`);
  };

  const exportTeamMembers = async () => {
    const toastId = toast.loading("Exportación en curso...");

    try {
      // Fetch registered members
      const { data: registeredMembers, error } = await supabase
        .from("team_members")
        .select(`
          member_type, joined_at,
          team:teams(name, category),
          profile:profiles(first_name, last_name, email, phone)
        `)
        .limit(10000);

      if (error) throw error;

      // Fetch whitelist members (pending = no matched_profile_id)
      const { data: whitelistMembers } = await supabase
        .from("authorized_users")
        .select("first_name, last_name, email, phone, team_name, profile_type, matched_profile_id")
        .not("team_name", "is", null)
        .limit(10000);

      const flatData: Record<string, string>[] = [];

      // Add registered members
      registeredMembers?.forEach((tm) => {
        flatData.push({
          Equipo: tm.team?.name || "",
          Categoría: tm.team?.category || "",
          Tipo: tm.member_type === "participant" ? "Estudiante" : "Mentor",
          Nombre: tm.profile?.first_name || "",
          Apellido: tm.profile?.last_name || "",
          Email: tm.profile?.email || "",
          Teléfono: tm.profile?.phone || "",
          Estado: "Registrado",
          "Fecha ingreso": tm.joined_at || "",
        });
      });

      // Add pending whitelist members (not matched to any profile)
      whitelistMembers?.filter(w => !w.matched_profile_id).forEach((w) => {
        flatData.push({
          Equipo: w.team_name || "",
          Categoría: "",
          Tipo: w.profile_type === "student" ? "Estudiante" : w.profile_type === "mentor" ? "Mentor" : w.profile_type || "",
          Nombre: w.first_name || "",
          Apellido: w.last_name || "",
          Email: w.email || "",
          Teléfono: w.phone || "",
          Estado: "Pendiente",
          "Fecha ingreso": "",
        });
      });

      exportToCSV(flatData, "miembros_equipo");
      toast.dismiss(toastId);
      toast.success("Miembros de equipo exportado correctamente");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Error al exportar: ${err.message}`);
    }
  };

  const exportTeamsWithDetails = async () => {
    const toastId = toast.loading("Exportación en curso...");

    try {
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select(`
          id, name, category, tg_team_id, notes,
          hub:hubs(name)
        `)
        .limit(10000);

      if (teamsError) throw teamsError;

      const teamIds = teams?.map((t) => t.id) || [];
      
      // Fetch registered members
      const { data: members } = await supabase
        .from("team_members")
        .select(`
          team_id, member_type,
          profile:profiles(first_name, last_name, email)
        `)
        .in("team_id", teamIds)
        .limit(10000);

      // Fetch whitelist members grouped by team_name
      const { data: whitelistMembers } = await supabase
        .from("authorized_users")
        .select("first_name, last_name, email, team_name, profile_type, matched_profile_id")
        .not("team_name", "is", null)
        .limit(10000);

      const membersByTeam: Record<string, typeof members> = {};
      members?.forEach((m) => {
        if (m.team_id) {
          if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = [];
          membersByTeam[m.team_id]!.push(m);
        }
      });

      // Group whitelist by team_name
      const whitelistByTeam: Record<string, typeof whitelistMembers> = {};
      whitelistMembers?.forEach((w) => {
        const tn = w.team_name || "";
        if (!whitelistByTeam[tn]) whitelistByTeam[tn] = [];
        whitelistByTeam[tn]!.push(w);
      });

      const flatData = teams?.map((t) => {
        const teamMembers = membersByTeam[t.id] || [];
        const regStudents = teamMembers.filter((m) => m.member_type === "participant");
        const regMentors = teamMembers.filter((m) => m.member_type === "mentor");

        const wl = whitelistByTeam[t.name] || [];
        const pendingStudents = wl.filter(w => !w.matched_profile_id && w.profile_type === "student");
        const pendingMentors = wl.filter(w => !w.matched_profile_id && w.profile_type === "mentor");

        return {
          Equipo: t.name,
          Hub: t.hub?.name || "",
          Categoría: t.category || "",
          "TG Team ID": t.tg_team_id || "",
          "Nº Estudiantes registradas": regStudents.length,
          "Nº Estudiantes pendientes": pendingStudents.length,
          "Nº Mentores registrados": regMentors.length,
          "Nº Mentores pendientes": pendingMentors.length,
          "Estudiantes registradas": regStudents.map((s) => `${s.profile?.first_name || ""} ${s.profile?.last_name || ""} (${s.profile?.email || ""})`).join("; "),
          "Estudiantes pendientes": pendingStudents.map((s) => `${s.first_name || ""} ${s.last_name || ""} (${s.email || ""})`).join("; "),
          "Mentores registrados": regMentors.map((m) => `${m.profile?.first_name || ""} ${m.profile?.last_name || ""} (${m.profile?.email || ""})`).join("; "),
          "Mentores pendientes": pendingMentors.map((m) => `${m.first_name || ""} ${m.last_name || ""} (${m.email || ""})`).join("; "),
          Notas: t.notes || "",
        };
      }) || [];

      exportToCSV(flatData, "equipos_detalle");
      toast.dismiss(toastId);
      toast.success("Equipos exportado correctamente");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Error al exportar: ${err.message}`);
    }
  };

  const exportEventRegistrations = async () => {
    if (!selectedEventId) {
      toast.error("Selecciona un evento primero");
      return;
    }

    const toastId = toast.loading("Exportación en curso...");

    try {
      // Only main registrations (not companions)
      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          id,
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
        .eq("event_id", selectedEventId)
        .eq("is_companion", false)
        .neq("registration_status", "cancelled")
        .limit(10000);

      if (error) throw error;

      // Fetch companions for these registrations
      const regIds = data?.map(r => r.id) || [];
      let companionsByReg: Record<string, { first_name: string | null; last_name: string | null; relationship: string | null }[]> = {};
      
      if (regIds.length > 0) {
        const { data: companions } = await supabase
          .from("companions")
          .select("event_registration_id, first_name, last_name, relationship")
          .in("event_registration_id", regIds);

        companions?.forEach(c => {
          if (c.event_registration_id) {
            if (!companionsByReg[c.event_registration_id]) companionsByReg[c.event_registration_id] = [];
            companionsByReg[c.event_registration_id].push(c);
          }
        });
      }

      // Build CSV rows with nested companions
      const csvRows: Record<string, string | number | boolean | null>[] = [];
      data?.forEach(r => {
        csvRows.push({
          "Nº Registro": r.registration_number || "",
          Nombre: r.first_name || "",
          Apellido: r.last_name || "",
          Email: r.email || "",
          Teléfono: r.phone || "",
          Equipo: r.team_name || "",
          "TG Team ID": r.team_id_tg || "",
          "TG Email": r.tg_email || "",
          "Tipo Entrada": r.ticket_type?.name || "",
          Estado: r.registration_status || "",
          "Check-in": r.checked_in_at ? format(new Date(r.checked_in_at), "dd/MM/yyyy HH:mm") : "",
          "Consentimiento imagen": r.image_consent ? "Sí" : "No",
          "Consentimiento datos": r.data_consent ? "Sí" : "No",
          "Fecha registro": r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm") : "",
        });

        // Add companion rows
        const comps = companionsByReg[r.id] || [];
        comps.forEach(c => {
          csvRows.push({
            "Nº Registro": "",
            Nombre: `  ↳ ${c.first_name || ""}`,
            Apellido: c.last_name || "",
            Email: "",
            Teléfono: "",
            Equipo: r.team_name || "",
            "TG Team ID": "",
            "TG Email": "",
            "Tipo Entrada": `Acompañante (${c.relationship || ""})`,
            Estado: "",
            "Check-in": "",
            "Consentimiento imagen": "",
            "Consentimiento datos": "",
            "Fecha registro": "",
          });
        });
      });

      const eventName = events?.find((e) => e.id === selectedEventId)?.name || "evento";
      exportToCSV(csvRows, `registros_${eventName.replace(/\s+/g, "_")}`);
      toast.dismiss(toastId);
      toast.success("Registros exportados correctamente");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Error al exportar: ${err.message}`);
    }
  };

  // Cross-referenced export: profiles + authorized_users + roles + teams
  const exportUsersCrossReferenced = async () => {
    const toastId = toast.loading("Exportación en curso...");

    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, verification_status, hub_id, created_at, tg_id, tg_email, date_of_birth, phone, dni")
        .limit(10000);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .limit(10000);

      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id, team:teams(name)")
        .limit(10000);

      const { data: hubs } = await supabase
        .from("hubs")
        .select("id, name")
        .limit(10000);

      const { data: authorizedUsers } = await supabase
        .from("authorized_users")
        .select("matched_profile_id, email, city, state, school_name, company_name, age, parent_name, parent_email, parental_consent, media_consent, team_name, profile_type, imported_at, tg_id")
        .limit(10000);

      // Build lookup maps
      const roleMap: Record<string, string[]> = {};
      roles?.forEach(r => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      const teamMap: Record<string, string> = {};
      teamMembers?.forEach(tm => {
        if (tm.user_id && tm.team?.name) teamMap[tm.user_id] = tm.team.name;
      });

      const hubMap: Record<string, string> = {};
      hubs?.forEach(h => { hubMap[h.id] = h.name; });

      const auByProfile: Record<string, typeof authorizedUsers extends (infer T)[] | null ? T : never> = {};
      const auByEmail: Record<string, typeof authorizedUsers extends (infer T)[] | null ? T : never> = {};
      authorizedUsers?.forEach(au => {
        if (au.matched_profile_id) auByProfile[au.matched_profile_id] = au;
        auByEmail[au.email.toLowerCase()] = au;
      });

      const csvRows = profiles?.map(p => {
        const au = auByProfile[p.id] || auByEmail[p.email.toLowerCase()];
        return {
          Nombre: p.first_name || "",
          Apellido: p.last_name || "",
          Email: p.email,
          Rol: (roleMap[p.id] || []).join(", "),
          "Estado verificación": p.verification_status || "",
          Hub: p.hub_id ? (hubMap[p.hub_id] || "") : "",
          Equipo: teamMap[p.id] || au?.team_name || "",
          "TG ID": p.tg_id || au?.tg_id || "",
          "TG Email": p.tg_email || "",
          DNI: p.dni || "",
          Teléfono: p.phone || "",
          "Fecha nacimiento": p.date_of_birth || "",
          Ciudad: au?.city || "",
          "Comunidad Autónoma": au?.state || "",
          Colegio: au?.school_name || "",
          Empresa: au?.company_name || "",
          "Edad (CSV)": au?.age ?? "",
          "Nombre padre/madre": au?.parent_name || "",
          "Email padre/madre": au?.parent_email || "",
          "Consentimiento parental": au?.parental_consent || "",
          "Consentimiento media": au?.media_consent || "",
          "Tipo perfil (CSV)": au?.profile_type || "",
          "Fecha registro plataforma": p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy HH:mm") : "",
          "Fecha importación CSV": au?.imported_at ? format(new Date(au.imported_at), "dd/MM/yyyy HH:mm") : "",
        };
      }) || [];

      exportToCSV(csvRows, "usuarios_completo_cruzado");
      toast.dismiss(toastId);
      toast.success("Exportación cruzada completada");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Error al exportar: ${err.message}`);
    }
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
                <Button variant="outline" size="sm" onClick={exportEventRegistrations}>
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Exportar Lista</span>
                </Button>
              )}
            </div>

            {selectedEventId && eventStats ? (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">{eventStats.totalAttendees}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Asistentes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">{eventStats.roleBreakdown.participants}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Participantes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">{eventStats.roleBreakdown.mentors}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Mentores/Jueces</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">{eventStats.companions}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Acompañantes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-xl sm:text-2xl font-bold">
                      {eventStats.totalRegistrations > 0
                        ? Math.round((eventStats.checkedIn / eventStats.totalRegistrations) * 100)
                        : 0}%
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Check-in</p>
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
                      variant="default"
                      onClick={exportUsersCrossReferenced}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      Usuarios Completo (cruzado)
                    </Button>
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
                      onClick={() => exportTable("authorized_users", "usuarios_autorizados")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Usuarios Autorizados
                    </Button>
                  </div>
                </div>

                {/* Equipos */}
                <div className="space-y-2">
                  <h3 className="font-medium">Equipos</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Button
                      variant="outline"
                      onClick={exportTeamsWithDetails}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Equipos (con detalle)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={exportTeamMembers}
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
