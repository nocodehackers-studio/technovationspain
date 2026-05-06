import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DataTable } from "@/components/admin/DataTable";
import { CapacityBar } from "@/components/admin/CapacityBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Event } from "@/types/database";

interface EventWithRealCount extends Event {
  realAttendees: number;
}

export default function AdminEvents() {
  const navigate = useNavigate();

  // Fetch events with real attendee counts
  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });

      if (eventsError) throw eventsError;

      // Per-event count queries — head:true returns only Content-Range count,
      // sidestepping PostgREST's 1000-row default cap that previously truncated totals.
      const counts = await Promise.all(
        (eventsData as Event[]).map(async (event) => {
          const [{ count: regCount }, { count: companionCount }] = await Promise.all([
            supabase
              .from("event_registrations")
              .select("*", { count: "exact", head: true })
              .eq("event_id", event.id)
              .neq("registration_status", "cancelled")
              .eq("is_companion", false),
            supabase
              .from("companions")
              .select(
                "event_registration_id, event_registrations!inner(event_id, registration_status, is_companion)",
                { count: "exact", head: true }
              )
              .eq("event_registrations.event_id", event.id)
              .neq("event_registrations.registration_status", "cancelled")
              .eq("event_registrations.is_companion", false),
          ]);
          return { eventId: event.id, total: (regCount ?? 0) + (companionCount ?? 0) };
        })
      );

      const totals = new Map(counts.map(c => [c.eventId, c.total]));

      return (eventsData as Event[]).map(event => ({
        ...event,
        realAttendees: totals.get(event.id) ?? 0,
      })) as EventWithRealCount[];
    },
  });

  const getEventStatus = (event: Event) => {
    const today = new Date();
    const eventDate = new Date(event.date);
    const openDate = event.registration_open_date ? new Date(event.registration_open_date) : null;
    const closeDate = event.registration_close_date ? new Date(event.registration_close_date) : null;

    if (eventDate < today) return { label: "Finalizado", variant: "secondary" as const };
    if (closeDate && closeDate < today) return { label: "Registro Cerrado", variant: "destructive" as const };
    if (openDate && openDate > today) return { label: "Próximo", variant: "outline" as const };
    return { label: "Registro Abierto", variant: "default" as const };
  };

  const columns: ColumnDef<EventWithRealCount>[] = [
    {
      accessorKey: "name",
      header: "Evento",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.location_name || row.original.location}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "event_type",
      header: "Tipo",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.event_type === "intermediate" ? "Intermedio" : "Final Regional"}
        </Badge>
      ),
    },
    {
      accessorKey: "date",
      header: "Fecha",
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.date).toLocaleDateString("es-ES", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      accessorKey: "capacity",
      header: "Aforo",
      cell: ({ row }) => (
        <div className="w-40">
          <CapacityBar
            current={row.original.realAttendees}
            max={row.original.max_capacity || 0}
            size="sm"
          />
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Publicación",
      cell: ({ row }) => {
        const isPublished = row.original.status === 'published';
        return (
          <Badge variant={isPublished ? 'default' : 'secondary'}>
            {isPublished ? 'Publicado' : 'Borrador'}
          </Badge>
        );
      },
    },
    {
      id: "registration_status",
      header: "Registro",
      cell: ({ row }) => {
        const status = getEventStatus(row.original);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];

  return (
    <AdminLayout title="Gestión de Eventos">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Eventos</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los eventos de Technovation España
            </p>
          </div>
          <Button onClick={() => navigate("/admin/events/new")} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Crear Evento</span>
            <span className="sm:hidden">Crear</span>
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={events || []}
          searchPlaceholder="Buscar eventos..."
          loading={isLoading}
          onRowClick={(event) => navigate(`/admin/events/${event.id}/edit`)}
        />
      </div>
    </AdminLayout>
  );
}
