import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DataTable } from "@/components/admin/DataTable";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { TeamCSVImport } from "@/components/admin/TeamCSVImport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { MoreHorizontal, Plus, Edit, Trash2, Users, Upload, Mail, UserCircle, MapPin, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Team, TeamCategory } from "@/types/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TeamMember {
  id: string;
  member_type: string | null;
  joined_at: string | null;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface TeamWithStats extends Team {
  team_members: { count: number }[];
  hub: { id: string; name: string } | null;
  whitelist_count: number;
  registered_count: number;
}

export default function AdminTeams() {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [hubFilter, setHubFilter] = useState<string>("all");

  // Fetch teams with member counts, hub info, and whitelist stats
  const { data: teams, isLoading } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: async () => {
      // First get teams with basic info
      const { data: teamsData, error } = await supabase
        .from("teams")
        .select("*, team_members(count), hub:hubs(id, name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Get whitelist stats for all teams
      const teamNames = teamsData?.map(t => t.name) || [];
      const { data: whitelistStats } = await supabase
        .from("authorized_users")
        .select("team_name, matched_profile_id");
      
      // Calculate stats per team
      const statsMap = new Map<string, { whitelist_count: number; registered_count: number }>();
      whitelistStats?.forEach(record => {
        if (record.team_name) {
          const key = record.team_name.toLowerCase();
          const current = statsMap.get(key) || { whitelist_count: 0, registered_count: 0 };
          current.whitelist_count++;
          if (record.matched_profile_id) current.registered_count++;
          statsMap.set(key, current);
        }
      });
      
      // Merge stats with teams
      return teamsData?.map(team => ({
        ...team,
        whitelist_count: statsMap.get(team.name.toLowerCase())?.whitelist_count || 0,
        registered_count: statsMap.get(team.name.toLowerCase())?.registered_count || 0,
      })) as TeamWithStats[];
    },
  });

  // Filtered teams based on hub selection
  const filteredTeams = teams?.filter((team) => {
    if (hubFilter === "all") return true;
    if (hubFilter === "none") return !team.hub_id;
    return team.hub_id === hubFilter;
  }) || [];

  // Function to open team members dialog
  const openTeamMembers = async (team: Team) => {
    setSelectedTeam(team);
    const { data: members } = await supabase
      .from("team_members")
      .select(`
        id,
        member_type,
        joined_at,
        user:profiles!team_members_user_id_fkey(id, email, first_name, last_name)
      `)
      .eq("team_id", team.id);
    setTeamMembers(members as TeamMember[] || []);
    setMembersDialogOpen(true);
  };

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

  const columns: ColumnDef<TeamWithStats>[] = [
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
      cell: ({ row }) => {
        const actualMembers = row.original.team_members?.[0]?.count || 0;
        const whitelistCount = row.original.whitelist_count || 0;
        const registeredCount = row.original.registered_count || 0;
        const percentage = whitelistCount > 0 ? Math.round((registeredCount / whitelistCount) * 100) : 0;
        const isComplete = whitelistCount > 0 && registeredCount === whitelistCount;
        
        // If no whitelist, show only actual members
        if (whitelistCount === 0) {
          return (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{actualMembers}</span>
            </div>
          );
        }
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col gap-1 min-w-[80px]">
                  <div className="flex items-center gap-2">
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-secondary" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={isComplete ? "text-secondary font-medium" : ""}>
                      {registeredCount}/{whitelistCount}
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-1.5"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{registeredCount} de {whitelistCount} miembros registrados</p>
                {actualMembers !== registeredCount && (
                  <p className="text-xs text-muted-foreground">
                    ({actualMembers} miembros vinculados actualmente)
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      id: "hub",
      header: "Hub",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.hub ? (
            <>
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{row.original.hub.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
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
              <Button 
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTeam(team);
                  setEditDialogOpen(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openTeamMembers(team);
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Ver Miembros
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Equipos</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los equipos de participantes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="flex-1 sm:flex-none">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Importar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Crear Equipo</span>
              <span className="sm:hidden">Crear</span>
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredTeams}
          searchPlaceholder="Buscar equipos..."
          loading={isLoading}
          onRowClick={(team) => openTeamMembers(team as Team)}
          toolbarContent={
            <Select value={hubFilter} onValueChange={setHubFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filtrar por hub" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los hubs</SelectItem>
                <SelectItem value="none">Sin hub</SelectItem>
                {hubs?.map((hub) => (
                  <SelectItem key={hub.id} value={hub.id}>
                    {hub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
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

      {/* CSV Import Dialog */}
      <TeamCSVImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
          toast.success("Importación completada");
        }}
      />

      {/* Team Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Miembros de {selectedTeam?.name}
            </DialogTitle>
            <DialogDescription>
              {teamMembers.length} miembro{teamMembers.length !== 1 ? "s" : ""} en el equipo
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {teamMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Este equipo no tiene miembros</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {member.user?.first_name?.[0] || member.user?.email?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {member.user?.first_name && member.user?.last_name
                          ? `${member.user.first_name} ${member.user.last_name}`
                          : member.user?.email || "Usuario desconocido"}
                      </p>
                      {member.user?.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {member.user.email}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        member.member_type === "mentor"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-secondary text-secondary-foreground"
                      }
                    >
                      {member.member_type === "mentor" ? "Mentor" : "Estudiante"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
