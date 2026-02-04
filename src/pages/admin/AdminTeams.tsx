import { useState, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MoreHorizontal, Edit, Trash2, Users, Upload, Mail, UserCircle, MapPin, CheckCircle2, Building2 } from "lucide-react";
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
  city?: string;
  notes?: string | null;
}

type CompletionFilter = "all" | "complete" | "incomplete" | "empty";

interface MentorOption {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export default function AdminTeams() {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<TeamWithStats | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Filters
  const [hubFilter, setHubFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
  
  // Edit form state
  const [editHubId, setEditHubId] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editMentorId, setEditMentorId] = useState<string>("");
  const [currentMentorId, setCurrentMentorId] = useState<string | null>(null);

  // Fetch teams with member counts, hub info, whitelist stats, and city
  const { data: teams, isLoading } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: async () => {
      // First get teams with basic info
      const { data: teamsData, error } = await supabase
        .from("teams")
        .select("*, team_members(count), hub:hubs(id, name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Get whitelist stats and city for all teams
      const { data: whitelistStats } = await supabase
        .from("authorized_users")
        .select("team_name, matched_profile_id, city");
      
      // Calculate stats per team and get most common city
      const statsMap = new Map<string, { 
        whitelist_count: number; 
        registered_count: number; 
        cities: Map<string, number>;
      }>();
      
      whitelistStats?.forEach(record => {
        if (record.team_name) {
          const key = record.team_name.toLowerCase();
          const current = statsMap.get(key) || { 
            whitelist_count: 0, 
            registered_count: 0, 
            cities: new Map() 
          };
          current.whitelist_count++;
          if (record.matched_profile_id) current.registered_count++;
          if (record.city) {
            current.cities.set(record.city, (current.cities.get(record.city) || 0) + 1);
          }
          statsMap.set(key, current);
        }
      });
      
      // Get most common city for each team
      const getCityFromStats = (stats: { cities: Map<string, number> } | undefined): string => {
        if (!stats || stats.cities.size === 0) return "";
        let maxCity = "";
        let maxCount = 0;
        stats.cities.forEach((count, city) => {
          if (count > maxCount) {
            maxCount = count;
            maxCity = city;
          }
        });
        return maxCity;
      };
      
      // Merge stats with teams
      return teamsData?.map(team => {
        const stats = statsMap.get(team.name.toLowerCase());
        return {
          ...team,
          whitelist_count: stats?.whitelist_count || 0,
          registered_count: stats?.registered_count || 0,
          city: getCityFromStats(stats),
        };
      }) as TeamWithStats[];
    },
  });

  // Function to filter by completion status
  const filterByCompletionStatus = (team: TeamWithStats, status: CompletionFilter): boolean => {
    if (status === "all") return true;
    if (status === "complete") return team.registered_count === team.whitelist_count && team.whitelist_count > 0;
    if (status === "incomplete") return team.registered_count < team.whitelist_count && team.whitelist_count > 0;
    if (status === "empty") return team.whitelist_count === 0;
    return true;
  };

  // Filtered teams based on all filters
  const filteredTeams = useMemo(() => {
    return teams?.filter((team) => {
      // Hub filter
      if (hubFilter !== "all") {
        if (hubFilter === "none" && team.hub_id) return false;
        if (hubFilter !== "none" && team.hub_id !== hubFilter) return false;
      }
      // Category filter
      if (categoryFilter !== "all" && team.category !== categoryFilter) return false;
      // Completion filter
      if (!filterByCompletionStatus(team, completionFilter)) return false;
      return true;
    }) || [];
  }, [teams, hubFilter, categoryFilter, completionFilter]);

  // Function to open team members dialog
  const openTeamMembers = async (team: TeamWithStats) => {
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

  // Fetch mentors (users with mentor role) for dropdown
  const { data: mentors } = useQuery({
    queryKey: ["admin-mentors-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mentor");
      
      if (!data || data.length === 0) return [];
      
      const mentorIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", mentorIds)
        .order("first_name");
      
      return (profiles || []) as MentorOption[];
    },
  });

  // Update team mutation (hub, notes, and mentor)
  const updateTeamMutation = useMutation({
    mutationFn: async ({
      teamId,
      hub_id,
      notes,
      mentorId,
      previousMentorId,
    }: {
      teamId: string;
      hub_id: string | null;
      notes: string | null;
      mentorId: string | null;
      previousMentorId: string | null;
    }) => {
      // Update team basic info
      const { error } = await supabase
        .from("teams")
        .update({ hub_id, notes })
        .eq("id", teamId);
      
      if (error) throw error;

      // Handle mentor assignment
      if (mentorId !== previousMentorId) {
        // Remove previous mentor if exists
        if (previousMentorId) {
          await supabase
            .from("team_members")
            .delete()
            .eq("team_id", teamId)
            .eq("user_id", previousMentorId)
            .eq("member_type", "mentor");
        }
        
        // Add new mentor if selected
        if (mentorId) {
          const { error: insertError } = await supabase
            .from("team_members")
            .upsert({
              team_id: teamId,
              user_id: mentorId,
              member_type: "mentor",
            }, {
              onConflict: "team_id,user_id",
            });
          
          if (insertError) throw insertError;
        }
      }
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

  // Open edit dialog with current values
  const openEditDialog = async (team: TeamWithStats) => {
    setSelectedTeam(team);
    setEditHubId(team.hub_id || "");
    setEditNotes(team.notes || "");
    
    // Fetch current mentor for this team
    const { data: mentorMember } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", team.id)
      .eq("member_type", "mentor")
      .maybeSingle();
    
    const mentorId = mentorMember?.user_id || "";
    setEditMentorId(mentorId);
    setCurrentMentorId(mentorId || null);
    setEditDialogOpen(true);
  };

  // Handle edit form submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    updateTeamMutation.mutate({
      teamId: selectedTeam.id,
      hub_id: editHubId || null,
      notes: editNotes || null,
      mentorId: editMentorId || null,
      previousMentorId: currentMentorId,
    });
  };

  const categoryColors: Record<TeamCategory, string> = {
    beginner: "bg-category-beginner/10 text-category-beginner border-category-beginner/20",
    junior: "bg-category-junior/10 text-category-junior border-category-junior/20",
    senior: "bg-category-senior/10 text-category-senior border-category-senior/20",
  };

  const categoryLabels: Record<TeamCategory, string> = {
    beginner: "Beginner (8-12)",
    junior: "Junior (13-15)",
    senior: "Senior (16-18)",
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
        const category = row.original.category as TeamCategory | null;
        if (!category) return <span className="text-muted-foreground">—</span>;
        
        return (
          <Badge variant="outline" className={categoryColors[category]}>
            {categoryLabels[category]}
          </Badge>
        );
      },
    },
    {
      id: "city",
      header: "Ciudad",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.city ? (
            <>
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{row.original.city}</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
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
                  openEditDialog(team);
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

  return (
    <AdminLayout title="Gestión de Equipos">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Equipos</h1>
            <p className="text-sm text-muted-foreground">
              Equipos importados desde Technovation Global
            </p>
          </div>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Importar CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={filteredTeams}
          searchPlaceholder="Buscar equipos..."
          loading={isLoading}
          onRowClick={(team) => openTeamMembers(team as TeamWithStats)}
          toolbarContent={
            <div className="flex flex-wrap gap-2">
              {/* Category filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>

              {/* Hub filter */}
              <Select value={hubFilter} onValueChange={setHubFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Hub" />
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

              {/* Completion status filter */}
              <Select value={completionFilter} onValueChange={(v) => setCompletionFilter(v as CompletionFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="complete">Completos</SelectItem>
                  <SelectItem value="incomplete">Incompletos</SelectItem>
                  <SelectItem value="empty">Sin miembros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </div>

      {/* Edit Team Dialog - Only Hub and Notes editable */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Equipo</DialogTitle>
            <DialogDescription>
              Configura el hub y añade notas internas
            </DialogDescription>
          </DialogHeader>
          
          {/* Read-only CSV data section */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium text-muted-foreground">Datos importados (solo lectura)</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Nombre:</span>
                <p className="font-medium">{selectedTeam?.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Categoría:</span>
                <p className="font-medium">
                  {selectedTeam?.category 
                    ? categoryLabels[selectedTeam.category as TeamCategory] 
                    : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">TG Team ID:</span>
                <p className="font-medium font-mono">{selectedTeam?.tg_team_id || "—"}</p>
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-hub">Hub</Label>
              <Select value={editHubId || "none"} onValueChange={(v) => setEditHubId(v === "none" ? "" : v)}>
                <SelectTrigger id="edit-hub">
                  <SelectValue placeholder="Seleccionar hub" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin hub</SelectItem>
                  {hubs?.map((hub) => (
                    <SelectItem key={hub.id} value={hub.id}>
                      {hub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mentor">Mentor</Label>
              <Select value={editMentorId || "none"} onValueChange={(v) => setEditMentorId(v === "none" ? "" : v)}>
                <SelectTrigger id="edit-mentor">
                  <SelectValue placeholder="Seleccionar mentor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin mentor asignado</SelectItem>
                  {mentors?.map((mentor) => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      {mentor.first_name && mentor.last_name
                        ? `${mentor.first_name} ${mentor.last_name}`
                        : mentor.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El mentor seleccionado será vinculado al equipo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notas internas</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Añade notas o comentarios sobre este equipo..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Estas notas son solo visibles para administradores
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateTeamMutation.isPending}>
                {updateTeamMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
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

      {/* Team Members Dialog - Read Only */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Miembros de {selectedTeam?.name}
            </DialogTitle>
            <DialogDescription>
              {teamMembers.length} miembro{teamMembers.length !== 1 ? "s" : ""} en el equipo
              <span className="block text-xs mt-1">
                Los miembros se gestionan automáticamente vía importación CSV
              </span>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {teamMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Este equipo no tiene miembros</p>
                <p className="text-xs mt-1">Los miembros se asignarán al importar el CSV de equipos</p>
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
