import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DataTable } from "@/components/admin/DataTable";
import { CapacityBar } from "@/components/admin/CapacityBar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Edit, Trash2, Users, GraduationCap, Eye, EyeOff } from "lucide-react";
import { Event } from "@/types/database";

export default function AdminEvents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch events
  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;
      return data as Event[];
    },
  });

  // Update event mutation (for publish/unpublish)
  const updateEventMutation = useMutation({
    mutationFn: async ({
      eventId,
      updates,
    }: {
      eventId: string;
      updates: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("events")
        .update(updates as any)
        .eq("id", eventId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Evento actualizado correctamente");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Evento eliminado correctamente");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
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

  const columns: ColumnDef<Event>[] = [
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
            current={row.original.current_registrations || 0}
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
    {
      id: "actions",
      cell: ({ row }) => {
        const event = row.original;
        const isPublished = event.status === 'published';
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  updateEventMutation.mutate({
                    eventId: event.id,
                    updates: { status: isPublished ? 'draft' : 'published' },
                  });
                }}
              >
                {isPublished ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Despublicar
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Publicar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/admin/events/${event.id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.location.href = `/admin/events/${event.id}/workshops`}
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Talleres
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setSelectedEvent(event);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
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
        />
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Eliminar evento?"
        description={`Esta acción eliminará permanentemente "${selectedEvent?.name}" y todos sus registros asociados. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => selectedEvent && deleteEventMutation.mutate(selectedEvent.id)}
        loading={deleteEventMutation.isPending}
      />
    </AdminLayout>
  );
}
