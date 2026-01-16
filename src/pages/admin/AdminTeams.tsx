import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DataTable } from "@/components/admin/DataTable";
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
import { toast } from "sonner";
import { MoreHorizontal, Plus, Edit, Trash2, Users } from "lucide-react";
import { Team, TeamCategory } from "@/types/database";

export default function AdminTeams() {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch teams with member counts
  const { data: teams, isLoading } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: async () => {
      const { data: teamsData, error } = await supabase
        .from("teams")
        .select("*, team_members(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return teamsData as (Team & { team_members: { count: number }[] })[];
    },
  });

  // Fetch hubs for dropdown
  const { data: hubs } = useQuery({
    queryKey: ["admin-hubs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("hubs").select("id, name");
      return data || [];
    },
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (team: Omit<Team, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("teams").insert(team);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      toast.success("Equipo creado correctamente");
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({
      teamId,
      updates,
    }: {
      teamId: string;
      updates: Partial<Team>;
    }) => {
      const { error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", teamId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      toast.success("Equipo actualizado correctamente");
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      toast.success("Equipo eliminado correctamente");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const categoryColors: Record<TeamCategory, string> = {
    beginner: "bg-category-beginner/10 text-category-beginner border-category-beginner/20",
    junior: "bg-category-junior/10 text-category-junior border-category-junior/20",
    senior: "bg-category-senior/10 text-category-senior border-category-senior/20",
  };

  const columns: ColumnDef<Team & { team_members: { count: number }[] }>[] = [
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.tg_team_id && (
            <span className="text-xs text-muted-foreground font-mono">
              TG: {row.original.tg_team_id}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Categoría",
      cell: ({ row }) => {
        const category = row.original.category;
        if (!category) return <span className="text-muted-foreground">—</span>;
        
        const labels: Record<TeamCategory, string> = {
          beginner: "Beginner (8-12)",
          junior: "Junior (13-15)",
          senior: "Senior (16-18)",
        };
        
        return (
          <Badge variant="outline" className={categoryColors[category]}>
            {labels[category]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "team_members",
      header: "Miembros",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.team_members?.[0]?.count || 0}</span>
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
        const team = row.original;
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
                  setSelectedTeam(team);
                  setEditDialogOpen(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Users className="mr-2 h-4 w-4" />
                Ver Miembros
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setSelectedTeam(team);
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

  const TeamForm = ({
    team,
    onSubmit,
    loading,
  }: {
    team?: Team | null;
    onSubmit: (data: any) => void;
    loading: boolean;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          name: formData.get("name") as string,
          category: formData.get("category") as TeamCategory || null,
          tg_team_id: formData.get("tg_team_id") as string || null,
          hub_id: formData.get("hub_id") as string || null,
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del equipo *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={team?.name || ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <select
            id="category"
            name="category"
            defaultValue={team?.category || ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Sin categoría</option>
            <option value="beginner">Beginner (8-12 años)</option>
            <option value="junior">Junior (13-15 años)</option>
            <option value="senior">Senior (16-18 años)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tg_team_id">TG Team ID</Label>
          <Input
            id="tg_team_id"
            name="tg_team_id"
            defaultValue={team?.tg_team_id || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hub_id">Hub</Label>
          <select
            id="hub_id"
            name="hub_id"
            defaultValue={team?.hub_id || ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Sin hub</option>
            {hubs?.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : team ? "Actualizar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <AdminLayout title="Gestión de Equipos">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Equipos</h1>
            <p className="text-muted-foreground">
              Gestiona los equipos de participantes
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Equipo
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={teams || []}
          searchPlaceholder="Buscar equipos..."
          loading={isLoading}
        />
      </div>

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Equipo</DialogTitle>
            <DialogDescription>
              Crea un nuevo equipo de participantes
            </DialogDescription>
          </DialogHeader>
          <TeamForm
            onSubmit={(data) => createTeamMutation.mutate(data)}
            loading={createTeamMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Equipo</DialogTitle>
            <DialogDescription>
              Modifica los datos del equipo
            </DialogDescription>
          </DialogHeader>
          <TeamForm
            team={selectedTeam}
            onSubmit={(data) =>
              selectedTeam &&
              updateTeamMutation.mutate({
                teamId: selectedTeam.id,
                updates: data,
              })
            }
            loading={updateTeamMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Eliminar equipo?"
        description={`Esta acción eliminará permanentemente "${selectedTeam?.name}" y desvinculará a todos sus miembros. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => selectedTeam && deleteTeamMutation.mutate(selectedTeam.id)}
        loading={deleteTeamMutation.isPending}
      />
    </AdminLayout>
  );
}
