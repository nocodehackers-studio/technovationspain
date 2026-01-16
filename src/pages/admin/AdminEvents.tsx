import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Edit, Trash2, Users, GraduationCap, Calendar } from "lucide-react";
import { Event, EventType } from "@/types/database";

export default function AdminEvents() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (event: Omit<Event, "id" | "created_at" | "current_registrations">) => {
      const { error } = await supabase.from("events").insert(event);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Evento creado correctamente");
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({
      eventId,
      updates,
    }: {
      eventId: string;
      updates: Partial<Event>;
    }) => {
      const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", eventId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Evento actualizado correctamente");
      setEditDialogOpen(false);
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
          <span className="text-xs text-muted-foreground">{row.original.location}</span>
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
      header: "Estado",
      cell: ({ row }) => {
        const status = getEventStatus(row.original);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const event = row.original;
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
                  setSelectedEvent(event);
                  setEditDialogOpen(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.location.href = `/admin/events/${event.id}/registrations`}
              >
                <Users className="mr-2 h-4 w-4" />
                Ver Registros
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

  const EventForm = ({
    event,
    onSubmit,
    loading,
  }: {
    event?: Event | null;
    onSubmit: (data: any) => void;
    loading: boolean;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          name: formData.get("name") as string,
          event_type: formData.get("event_type") as EventType,
          date: formData.get("date") as string,
          location: formData.get("location") as string,
          max_capacity: parseInt(formData.get("max_capacity") as string) || null,
          registration_open_date: formData.get("registration_open_date") as string || null,
          registration_close_date: formData.get("registration_close_date") as string || null,
          description: formData.get("description") as string || null,
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del evento *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={event?.name || ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_type">Tipo *</Label>
          <Select name="event_type" defaultValue={event?.event_type || "intermediate"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="intermediate">Evento Intermedio</SelectItem>
              <SelectItem value="regional_final">Final Regional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Fecha *</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={event?.date || ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Ubicación</Label>
          <Input
            id="location"
            name="location"
            defaultValue={event?.location || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_capacity">Aforo Máximo</Label>
          <Input
            id="max_capacity"
            name="max_capacity"
            type="number"
            min="1"
            defaultValue={event?.max_capacity || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registration_open_date">Apertura de Registro</Label>
          <Input
            id="registration_open_date"
            name="registration_open_date"
            type="date"
            defaultValue={event?.registration_open_date || ""}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="registration_close_date">Cierre de Registro</Label>
          <Input
            id="registration_close_date"
            name="registration_close_date"
            type="date"
            defaultValue={event?.registration_close_date || ""}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={event?.description || ""}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : event ? "Actualizar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <AdminLayout title="Gestión de Eventos">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
            <p className="text-muted-foreground">
              Gestiona los eventos de Technovation España
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Evento
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={events || []}
          searchPlaceholder="Buscar eventos..."
          loading={isLoading}
        />
      </div>

      {/* Create Event Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Evento</DialogTitle>
            <DialogDescription>
              Crea un nuevo evento de Technovation
            </DialogDescription>
          </DialogHeader>
          <EventForm
            onSubmit={(data) => createEventMutation.mutate(data)}
            loading={createEventMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
            <DialogDescription>
              Modifica los datos del evento
            </DialogDescription>
          </DialogHeader>
          <EventForm
            event={selectedEvent}
            onSubmit={(data) =>
              selectedEvent &&
              updateEventMutation.mutate({
                eventId: selectedEvent.id,
                updates: data,
              })
            }
            loading={updateEventMutation.isPending}
          />
        </DialogContent>
      </Dialog>

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
