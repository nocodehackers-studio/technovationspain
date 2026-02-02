import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DataTable } from "@/components/admin/DataTable";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { MoreHorizontal, Plus, Edit, Trash2, MapPin, Users } from "lucide-react";
import { Hub } from "@/types/database";

export default function AdminHubs() {
  const queryClient = useQueryClient();
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch hubs with team counts
  const { data: hubs, isLoading } = useQuery({
    queryKey: ["admin-hubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hubs")
        .select("*, teams(count)")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as (Hub & { teams: { count: number }[] })[];
    },
  });

  // Create hub mutation
  const createHubMutation = useMutation({
    mutationFn: async (hub: Omit<Hub, "id" | "created_at">) => {
      const { error } = await supabase.from("hubs").insert(hub);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hubs"] });
      toast.success("Hub creado correctamente");
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update hub mutation
  const updateHubMutation = useMutation({
    mutationFn: async ({
      hubId,
      updates,
    }: {
      hubId: string;
      updates: Partial<Hub>;
    }) => {
      const { error } = await supabase
        .from("hubs")
        .update(updates)
        .eq("id", hubId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hubs"] });
      toast.success("Hub actualizado correctamente");
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete hub mutation
  const deleteHubMutation = useMutation({
    mutationFn: async (hubId: string) => {
      const { error } = await supabase.from("hubs").delete().eq("id", hubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hubs"] });
      toast.success("Hub eliminado correctamente");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const columns: ColumnDef<Hub & { teams: { count: number }[] }>[] = [
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "location",
      header: "Ubicación",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.location || "—"}</span>
        </div>
      ),
    },
    {
      accessorKey: "teams",
      header: "Equipos",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.teams?.[0]?.count || 0}</span>
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Creado",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.created_at || "").toLocaleDateString("es-ES")}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const hub = row.original;
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
                  setSelectedHub(hub);
                  setEditDialogOpen(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setSelectedHub(hub);
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

  const HubForm = ({
    hub,
    onSubmit,
    loading,
  }: {
    hub?: Hub | null;
    onSubmit: (data: any) => void;
    loading: boolean;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          name: formData.get("name") as string,
          location: formData.get("location") as string || null,
          notes: formData.get("notes") as string || null,
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del hub *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={hub?.name || ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Ubicación</Label>
          <Input
            id="location"
            name="location"
            placeholder="Ej: Madrid, Barcelona..."
            defaultValue={hub?.location || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notas internas</Label>
          <Input
            id="notes"
            name="notes"
            placeholder="Notas o comentarios internos..."
            defaultValue={hub?.notes || ""}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : hub ? "Actualizar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <AdminLayout title="Gestión de Hubs">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Hubs</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los hubs regionales
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Crear Hub</span>
            <span className="sm:hidden">Crear</span>
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={hubs || []}
          searchPlaceholder="Buscar hubs..."
          loading={isLoading}
        />
      </div>

      {/* Create Hub Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Hub</DialogTitle>
            <DialogDescription>
              Crea un nuevo hub regional
            </DialogDescription>
          </DialogHeader>
          <HubForm
            onSubmit={(data) => createHubMutation.mutate(data)}
            loading={createHubMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Hub Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Hub</DialogTitle>
            <DialogDescription>
              Modifica los datos del hub
            </DialogDescription>
          </DialogHeader>
          <HubForm
            hub={selectedHub}
            onSubmit={(data) =>
              selectedHub &&
              updateHubMutation.mutate({
                hubId: selectedHub.id,
                updates: data,
              })
            }
            loading={updateHubMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Eliminar hub?"
        description={`Esta acción eliminará permanentemente "${selectedHub?.name}". Los equipos asociados quedarán sin hub. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => selectedHub && deleteHubMutation.mutate(selectedHub.id)}
        loading={deleteHubMutation.isPending}
      />
    </AdminLayout>
  );
}
