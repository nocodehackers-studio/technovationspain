import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/admin/MetricCard";
import { AirtableDataTable, FilterableColumn, ExportData } from "@/components/admin/AirtableDataTable";
import { RegistrationStatusBadge } from "@/components/events/RegistrationStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminCancelRegistration } from "@/hooks/useAdminCancelRegistration";
import { Users, UserPlus, GraduationCap, Ticket, UsersRound, XCircle, FileCheck } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EventStatsViewProps {
  eventId: string;
}

interface RegistrationWithCompanions {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dni: string | null;
  registration_status: string | null;
  checked_in_at: string | null;
  created_at: string | null;
  registration_number: string | null;
  team_name: string | null;
  ticket_type: {
    id: string;
    name: string;
    allowed_roles: string[] | null;
  } | null;
  companions_count: number;
  companions_details: {
    first_name: string | null;
    last_name: string | null;
    relationship: string | null;
    dni: string | null;
    checked_in_at: string | null;
  }[];
  has_consent: boolean;
  consent_signed_at: string | null;
  // Derived fields for filtering
  ticket_type_name: string;
  consent_status: string;
}

export function EventStatsView({ eventId }: EventStatsViewProps) {
  const [registrationToCancel, setRegistrationToCancel] = useState<RegistrationWithCompanions | null>(null);
  const [hiddenColumns] = useState<string[]>(["dni", "phone"]);
  const cancelMutation = useAdminCancelRegistration();

  // Fetch event data
  const { data: event } = useQuery({
    queryKey: ["event-stats", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("max_capacity, current_registrations")
        .eq("id", eventId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch registrations with ticket types and consent
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["event-registrations-stats", eventId],
    queryFn: async () => {
      const { data: regs, error } = await supabase
        .from("event_registrations")
        .select(`
          id, first_name, last_name, email, phone, dni, registration_status,
          checked_in_at, created_at, registration_number, team_name,
          ticket_type:event_ticket_types(id, name, allowed_roles),
          consent:event_ticket_consents(id, signed_at)
        `)
        .eq("event_id", eventId)
        .eq("is_companion", false)
        .neq("registration_status", "cancelled")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get companion details
      const regIds = regs?.map((r) => r.id) || [];
      if (regIds.length === 0) return [];

      const { data: companions } = await supabase
        .from("companions")
        .select("event_registration_id, first_name, last_name, relationship, dni, checked_in_at")
        .in("event_registration_id", regIds);

      const companionCounts: Record<string, number> = {};
      const companionDetails: Record<string, RegistrationWithCompanions["companions_details"]> = {};
      companions?.forEach((c) => {
        if (c.event_registration_id) {
          companionCounts[c.event_registration_id] = (companionCounts[c.event_registration_id] || 0) + 1;
          if (!companionDetails[c.event_registration_id]) companionDetails[c.event_registration_id] = [];
          companionDetails[c.event_registration_id].push({
            first_name: c.first_name,
            last_name: c.last_name,
            relationship: c.relationship,
            dni: c.dni,
            checked_in_at: c.checked_in_at,
          });
        }
      });

      return regs?.map((r) => {
        // Supabase returns one-to-one relations as object, one-to-many as array
        const raw = r.consent as unknown;
        const consentRecord = raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as { id: string; signed_at: string })
          : Array.isArray(raw) && raw.length > 0
            ? (raw[0] as { id: string; signed_at: string })
            : null;

        return {
          ...r,
          companions_count: companionCounts[r.id] || 0,
          companions_details: companionDetails[r.id] || [],
          has_consent: !!consentRecord,
          consent_signed_at: consentRecord?.signed_at || null,
          ticket_type_name: r.ticket_type?.name || "",
          consent_status: consentRecord ? "signed" : "pending",
        };
      }) as RegistrationWithCompanions[];
    },
  });

  // Fetch total companions count for metrics
  const { data: allCompanions } = useQuery({
    queryKey: ["event-companions-count", eventId],
    queryFn: async () => {
      const { data: regIds } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("is_companion", false)
        .neq("registration_status", "cancelled");

      if (!regIds || regIds.length === 0) return [];

      const { data, error } = await supabase
        .from("companions")
        .select("id")
        .in(
          "event_registration_id",
          regIds.map((r) => r.id)
        );

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const regs = registrations || [];

    const participantsCount = regs.filter((r) =>
      r.ticket_type?.allowed_roles?.includes("participant")
    ).length;

    const mentorsCount = regs.filter(
      (r) =>
        r.ticket_type?.allowed_roles?.includes("mentor") ||
        r.ticket_type?.allowed_roles?.includes("judge")
    ).length;

    const companionsCount = allCompanions?.length || 0;
    const mainRegistrations = regs.length;
    const totalAttendees = mainRegistrations + companionsCount;

    const remainingTickets = Math.max(
      0,
      (event?.max_capacity || 0) - totalAttendees
    );

    const consentsTotal = regs.length;
    const consentsSigned = regs.filter((r) => r.has_consent).length;

    return {
      participantsCount,
      mentorsCount,
      companionsCount,
      mainRegistrations,
      totalAttendees,
      remainingTickets,
      consentsTotal,
      consentsSigned,
    };
  }, [registrations, allCompanions, event]);

  // Filterable columns
  const filterableColumns: FilterableColumn[] = useMemo(() => {
    const regs = registrations || [];
    const ticketTypes = [...new Set(regs.map((r) => r.ticket_type?.name).filter(Boolean))];
    const teams = [...new Set(regs.map((r) => r.team_name).filter(Boolean))].sort();

    return [
      {
        key: "ticket_type_name",
        label: "Tipo Entrada",
        options: ticketTypes.map((t) => ({ value: t!, label: t! })),
      },
      {
        key: "registration_status",
        label: "Estado",
        options: [
          { value: "confirmed", label: "Confirmado" },
          { value: "waitlisted", label: "En lista de espera" },
        ],
      },
      {
        key: "consent_status",
        label: "Consentimiento",
        options: [
          { value: "signed", label: "Firmado" },
          { value: "pending", label: "Pendiente" },
        ],
      },
      ...(teams.length > 0
        ? [
            {
              key: "team_name",
              label: "Equipo",
              options: [
                ...teams.map((t) => ({ value: t!, label: t! })),
                { value: "__empty__", label: "Sin equipo" },
              ],
            },
          ]
        : []),
    ];
  }, [registrations]);

  // Table columns
  const columns: ColumnDef<RegistrationWithCompanions>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Nombre",
        accessorFn: (row) =>
          `${row.first_name || ""} ${row.last_name || ""} ${row.email || ""}`.trim().toLowerCase(),
        cell: ({ row }) => {
          const name = `${row.original.first_name || ""} ${row.original.last_name || ""}`.trim();
          return (
            <div>
              <p className="font-medium">{name || "-"}</p>
              <p className="text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "dni",
        header: "DNI",
        cell: ({ row }) => (
          <span className="text-sm font-mono">{row.original.dni || "-"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Teléfono",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.phone || "-"}</span>
        ),
      },
      {
        accessorKey: "team_name",
        header: "Equipo",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          const value = row.original.team_name;
          if (filterValues.includes("__empty__") && !value) return true;
          return filterValues.includes(value || "");
        },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.team_name || "-"}</span>
        ),
      },
      {
        accessorKey: "ticket_type_name",
        header: "Tipo Entrada",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          return filterValues.includes(row.original.ticket_type_name);
        },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.ticket_type?.name || "-"}</span>
        ),
      },
      {
        accessorKey: "companions_count",
        header: "Acomp.",
        cell: ({ row }) => {
          const count = row.original.companions_count;
          if (count === 0) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <Badge variant="secondary" className="font-mono">
              +{count}
            </Badge>
          );
        },
      },
      {
        accessorKey: "consent_status",
        header: "Consentimiento",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          return filterValues.includes(row.original.consent_status);
        },
        cell: ({ row }) => {
          if (row.original.has_consent) {
            return (
              <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20" variant="outline">
                Firmado
              </Badge>
            );
          }
          return (
            <Badge className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20" variant="outline">
              Pendiente
            </Badge>
          );
        },
      },
      {
        accessorKey: "registration_status",
        header: "Estado",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          return filterValues.includes(row.original.registration_status || "");
        },
        cell: ({ row }) => (
          <RegistrationStatusBadge status={row.original.registration_status || "confirmed"} />
        ),
      },
      {
        accessorKey: "checked_in_at",
        header: "Check-in",
        cell: ({ row }) => {
          const checkedIn = row.original.checked_in_at;
          if (!checkedIn) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <span className="text-sm">
              {format(new Date(checkedIn), "HH:mm", { locale: es })}
            </span>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Fecha registro",
        cell: ({ row }) => {
          const date = row.original.created_at;
          if (!date) return "-";
          return (
            <span className="text-sm text-muted-foreground">
              {format(new Date(date), "dd/MM/yy", { locale: es })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setRegistrationToCancel(row.original);
            }}
            title="Cancelar inscripción"
          >
            <XCircle className="h-4 w-4 text-destructive" />
          </Button>
        ),
      },
    ],
    []
  );

  // Export CSV
  const handleExport = (exportData: ExportData<RegistrationWithCompanions>) => {
    const rows = exportData.rows;
    if (rows.length === 0) return;

    const csvRows: Record<string, string | number>[] = [];

    rows.forEach((r) => {
      csvRows.push({
        Nombre: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        Email: r.email || "",
        DNI: r.dni || "",
        Teléfono: r.phone || "",
        Equipo: r.team_name || "",
        "Tipo Entrada": r.ticket_type?.name || "",
        Acompañantes: r.companions_count,
        Consentimiento: r.has_consent ? "Sí" : "No",
        Estado: r.registration_status || "",
        "Check-in": r.checked_in_at
          ? format(new Date(r.checked_in_at), "dd/MM/yyyy HH:mm")
          : "No",
        "Fecha registro": r.created_at
          ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm")
          : "",
      });

      // Add companion rows
      r.companions_details.forEach((comp) => {
        csvRows.push({
          Nombre: `  ↳ ${comp.first_name || ""} ${comp.last_name || ""}`.trim(),
          Email: "",
          DNI: comp.dni || "",
          Teléfono: "",
          Equipo: r.team_name || "",
          "Tipo Entrada": `Acompañante (${comp.relationship || ""})`,
          Acompañantes: "",
          Consentimiento: "",
          Estado: "",
          "Check-in": comp.checked_in_at
            ? format(new Date(comp.checked_in_at), "dd/MM/yyyy HH:mm")
            : "No",
          "Fecha registro": "",
        });
      });
    });

    const headers = Object.keys(csvRows[0]);
    const csvContent =
      "\uFEFF" +
      headers.join(";") +
      "\n" +
      csvRows.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(";")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inscripciones-evento-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Total Attendees Summary */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-full">
              <UsersRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-primary">{metrics.totalAttendees}</h3>
              <p className="text-sm text-muted-foreground">Total asistentes confirmados</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{metrics.mainRegistrations}</span> registros
              {metrics.companionsCount > 0 && (
                <>
                  {" + "}
                  <span className="font-medium text-foreground">{metrics.companionsCount}</span> acompañantes
                </>
              )}
            </p>
            {event?.max_capacity && (
              <p className="text-muted-foreground mt-1">
                Capacidad: {metrics.totalAttendees} / {event.max_capacity}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Participantes"
          value={metrics.participantsCount}
          icon={<Users />}
          color="primary"
        />
        <MetricCard
          title="Acompañantes"
          value={metrics.companionsCount}
          icon={<UserPlus />}
          color="info"
        />
        <MetricCard
          title="Mentores / Jueces"
          value={metrics.mentorsCount}
          icon={<GraduationCap />}
          color="success"
        />
        <MetricCard
          title="Consentimientos"
          value={`${metrics.consentsSigned} / ${metrics.consentsTotal}`}
          icon={<FileCheck />}
          color={metrics.consentsSigned === metrics.consentsTotal ? "success" : "warning"}
        />
        <MetricCard
          title="Entradas restantes"
          value={event?.max_capacity ? metrics.remainingTickets : "∞"}
          icon={<Ticket />}
          color={metrics.remainingTickets < 20 ? "warning" : "accent"}
        />
      </div>

      {/* Registrations Table */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Listado de Inscripciones</h3>
        <AirtableDataTable
          columns={columns}
          data={registrations || []}
          loading={isLoading}
          searchPlaceholder="Buscar por nombre o email..."
          filterableColumns={filterableColumns}
          hiddenColumns={hiddenColumns}
          onExport={handleExport}
        />
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!registrationToCancel}
        onOpenChange={(open) => !open && setRegistrationToCancel(null)}
        title="¿Cancelar esta inscripción?"
        description={
          registrationToCancel
            ? `Se cancelará la inscripción de ${registrationToCancel.first_name || ""} ${registrationToCancel.last_name || ""}${registrationToCancel.companions_count > 0 ? ` y sus ${registrationToCancel.companions_count} acompañante(s)` : ""}. Esta acción liberará las plazas correspondientes.`
            : ""
        }
        confirmText="Cancelar inscripción"
        variant="danger"
        loading={cancelMutation.isPending}
        onConfirm={async () => {
          if (!registrationToCancel) return;
          await cancelMutation.mutateAsync({
            registrationId: registrationToCancel.id,
            eventId: eventId,
            ticketTypeId: registrationToCancel.ticket_type?.id || "",
            companionsCount: registrationToCancel.companions_count,
            registrationStatus: registrationToCancel.registration_status || "confirmed",
          });
          setRegistrationToCancel(null);
        }}
      />
    </div>
  );
}
