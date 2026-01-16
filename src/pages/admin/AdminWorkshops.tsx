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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Edit, Trash2, Users } from "lucide-react";
import { Workshop, TeamCategory } from "@/types/database";

export default function AdminWorkshops() {
  const queryClient = useQueryClient();
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch events for dropdown
  const { data: events } = useQuery({
    queryKey: ["admin-events-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, date")
        .order("date", { ascending: false });
      return data || [];
    },
  });

  // Fetch workshops
  const { data: workshops, isLoading } = useQuery({
    queryKey: ["admin-workshops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("*, events(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as (Workshop & { events: { name: string } | null })[];
    },
  });

  // Create workshop mutation
  const createWorkshopMutation = useMutation({
    mutationFn: async (workshop: Omit<Workshop, "id" | "created_at" | "current_registrations">) => {
      const { error } = await supabase.from("workshops").insert(workshop);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-workshops"] });
      toast.success("Taller creado correctamente");
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update workshop mutation
  const updateWorkshopMutation = useMutation({
    mutationFn: async ({
      workshopId,
      updates,
    }: {
      workshopId: string;
      updates: Partial<Workshop>;
    }) => {
      const { error } = await supabase
        .from("workshops")
        .update(updates)
        .eq("id", workshopId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-workshops"] });
      toast.success("Taller actualizado correctamente");
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete workshop mutation
  const deleteWorkshopMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      const { error } = await supabase.from("workshops").delete().eq("id", workshopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-workshops"] });
      toast.success("Taller eliminado correctamente");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const categoryColors: Record<string, string> = {
    beginner: "bg-category-beginner/10 text-category-beginner border-category-beginner/20",
    junior: "bg-category-junior/10 text-category-junior border-category-junior/20",
    senior: "bg-category-senior/10 text-category-senior border-category-senior/20",
    general: "bg-muted text-muted-foreground border-muted-foreground/20",
  };

  const columns: ColumnDef<Workshop & { events: { name: string } | null }>[] = [
    {
      accessorKey: "name",
      header: "Taller",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.events?.name || "Sin evento"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Categoría",
      cell: ({ row }) => {
        const category = row.original.category;
        if (!category) return <span className="text-muted-foreground">—</span>;
        
        const labels: Record<string, string> = {
          beginner: "Beginner",
          junior: "Junior",
          senior: "Senior",
          general: "General",
        };
        
        return (
          <Badge variant="outline" className={categoryColors[category]}>
            {labels[category]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "time_slot",
      header: "Horario",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.time_slot || "—"}
        </span>
      ),
    },
    {
      accessorKey: "location",
      header: "Ubicación",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.location || "—"}</span>
      ),
    },
    {
      accessorKey: "capacity",
      header: "Aforo",
      cell: ({ row }) => (
        <div className="w-32">
          <CapacityBar
            current={row.original.current_registrations || 0}
            max={row.original.max_capacity}
            size="sm"
            showPercentage={false}
          />
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const workshop = row.original;
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
                  setSelectedWorkshop(workshop);
                  setEditDialogOpen(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Users className="mr-2 h-4 w-4" />
                Ver Equipos
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setSelectedWorkshop(workshop);
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

  const WorkshopForm = ({
    workshop,
    onSubmit,
    loading,
  }: {
    workshop?: Workshop | null;
    onSubmit: (data: any) => void;
    loading: boolean;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          name: formData.get("name") as string,
          event_id: formData.get("event_id") as string || null,
          category: formData.get("category") as string || null,
          time_slot: formData.get("time_slot") as string || null,
          max_capacity: parseInt(formData.get("max_capacity") as string) || 20,
          location: formData.get("location") as string || null,
          description: formData.get("description") as string || null,
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del taller *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={workshop?.name || ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_id">Evento</Label>
          <Select name="event_id" defaultValue={workshop?.event_id || ""}>
            <SelectTrigger>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <Select name="category" defaultValue={workshop?.category || ""}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner (8-12)</SelectItem>
              <SelectItem value="junior">Junior (13-15)</SelectItem>
              <SelectItem value="senior">Senior (16-18)</SelectItem>
              <SelectItem value="general">General (todas)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="time_slot">Horario</Label>
          <Input
            id="time_slot"
            name="time_slot"
            placeholder="Ej: 10:00-11:00"
            defaultValue={workshop?.time_slot || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_capacity">Aforo Máximo *</Label>
          <Input
            id="max_capacity"
            name="max_capacity"
            type="number"
            min="1"
            defaultValue={workshop?.max_capacity || 20}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Ubicación</Label>
          <Input
            id="location"
            name="location"
            placeholder="Ej: Sala A, Aula 101..."
            defaultValue={workshop?.location || ""}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={workshop?.description || ""}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : workshop ? "Actualizar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <AdminLayout title="Gestión de Talleres">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Talleres</h1>
            <p className="text-muted-foreground">
              Gestiona los talleres de los eventos
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Taller
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={workshops || []}
          searchPlaceholder="Buscar talleres..."
          loading={isLoading}
        />
      </div>

      {/* Create Workshop Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Taller</DialogTitle>
            <DialogDescription>
              Crea un nuevo taller para un evento
            </DialogDescription>
          </DialogHeader>
          <WorkshopForm
            onSubmit={(data) => createWorkshopMutation.mutate(data)}
            loading={createWorkshopMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Workshop Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Taller</DialogTitle>
            <DialogDescription>
              Modifica los datos del taller
            </DialogDescription>
          </DialogHeader>
          <WorkshopForm
            workshop={selectedWorkshop}
            onSubmit={(data) =>
              selectedWorkshop &&
              updateWorkshopMutation.mutate({
                workshopId: selectedWorkshop.id,
                updates: data,
              })
            }
            loading={updateWorkshopMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Eliminar taller?"
        description={`Esta acción eliminará permanentemente "${selectedWorkshop?.name}" y todas las inscripciones asociadas. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => selectedWorkshop && deleteWorkshopMutation.mutate(selectedWorkshop.id)}
        loading={deleteWorkshopMutation.isPending}
      />
    </AdminLayout>
  );
}
