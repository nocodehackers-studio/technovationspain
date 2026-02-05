import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AirtableDataTable, FilterableColumn, ExportData } from "@/components/admin/AirtableDataTable";
import { format } from "date-fns";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RoleBadges } from "@/components/admin/RoleBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EditableCell } from "@/components/admin/EditableCell";
import { UserEditSheet } from "@/components/admin/UserEditSheet";
import { UnregisteredUsersTable } from "@/components/admin/users/UnregisteredUsersTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, MoreVertical, Trash2, Users, UserPlus } from "lucide-react";
import { Profile, AppRole, TableCustomColumn } from "@/types/database";

type UserWithRoles = Profile & { 
  roles: AppRole[];
  team_name?: string | null;
  school_name?: string | null;
  hub_name?: string | null;
  is_in_whitelist?: boolean;
};

// Slugify column label to create a key
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function AdminUsers() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addFieldDialogOpen, setAddFieldDialogOpen] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("registered");

  // Fetch users with roles, teams, and hub info
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          *,
          hub:hubs!profiles_hub_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch ALL roles for ALL users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Fetch team memberships with team names
      const { data: teamMembers, error: teamError } = await supabase
        .from("team_members")
        .select(`
          user_id,
          team:teams(name)
        `);

      if (teamError) throw teamError;

      // Fetch authorized_users for school_name and whitelist check
      const { data: authorizedUsers, error: authUsersError } = await supabase
        .from("authorized_users")
        .select("email, school_name, company_name");

      if (authUsersError) throw authUsersError;

      // Create a set of whitelisted emails for quick lookup
      const whitelistEmails = new Set(
        (authorizedUsers || []).map((au) => au.email?.toLowerCase())
      );

      // Merge profiles with all related data
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => {
        // Get ALL roles for this user
        const userRoles = roles
          ?.filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole) || [];
        
        const teamMember = teamMembers?.find((tm) => tm.user_id === profile.id);
        const authorizedUser = authorizedUsers?.find(
          (au) => au.email?.toLowerCase() === profile.email?.toLowerCase()
        );
        
        return {
          ...profile,
          custom_fields: (profile.custom_fields as Record<string, unknown>) || {},
          roles: userRoles,
          team_name: (teamMember?.team as { name: string } | null)?.name || null,
          school_name: authorizedUser?.school_name || authorizedUser?.company_name || null,
          hub_name: (profile.hub as { name: string } | null)?.name || null,
          is_in_whitelist: whitelistEmails.has(profile.email?.toLowerCase()),
        };
      });

      return usersWithRoles;
    },
  });

  // Fetch unregistered count for tab badge
  const { data: unregisteredCount } = useQuery({
    queryKey: ["admin-unregistered-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("authorized_users")
        .select("*", { count: "exact", head: true })
        .is("matched_profile_id", null);

      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch custom columns
  const { data: customColumns } = useQuery({
    queryKey: ["table-custom-columns", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_custom_columns")
        .select("*")
        .eq("table_name", "profiles")
        .order("sort_order");

      if (error) throw error;
      return (data || []) as TableCustomColumn[];
    },
  });

  // Update custom field mutation (for inline editing in table)
  const updateCustomFieldMutation = useMutation({
    mutationFn: async ({
      userId,
      fieldKey,
      value,
      currentCustomFields,
    }: {
      userId: string;
      fieldKey: string;
      value: string;
      currentCustomFields: Record<string, unknown>;
    }) => {
      const updatedFields = {
        ...currentCustomFields,
        [fieldKey]: value,
      };

      const { error } = await supabase
        .from("profiles")
        .update({ custom_fields: updatedFields as unknown as Record<string, never> })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuario eliminado correctamente");
      setDeleteDialogOpen(false);
      setEditSheetOpen(false);
    },
    onError: (error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  // Add custom column mutation
  const addColumnMutation = useMutation({
    mutationFn: async (label: string) => {
      const columnKey = slugify(label);
      const { error } = await supabase.from("table_custom_columns").insert({
        table_name: "profiles",
        column_key: columnKey,
        column_label: label,
        column_type: "text",
        sort_order: (customColumns?.length || 0) + 1,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-custom-columns", "profiles"] });
      toast.success("Campo creado correctamente");
      setAddFieldDialogOpen(false);
      setNewFieldLabel("");
    },
    onError: (error) => {
      toast.error(`Error al crear campo: ${error.message}`);
    },
  });

  // Delete custom column mutation
  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const { error } = await supabase
        .from("table_custom_columns")
        .delete()
        .eq("id", columnId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-custom-columns", "profiles"] });
      toast.success("Campo eliminado correctamente");
    },
    onError: (error) => {
      toast.error(`Error al eliminar campo: ${error.message}`);
    },
  });

  // Check if user can be deleted - admins can delete any user
  const canDeleteUser = useCallback((_user: UserWithRoles): boolean => {
    return true;
  }, []);

  // Static columns - memoized to prevent re-renders
  const staticColumns: ColumnDef<UserWithRoles>[] = useMemo(() => [
    {
      id: "name",
      accessorFn: (row) => 
        `${row.first_name || ""} ${row.last_name || ""} ${row.email || ""} ${row.tg_id || ""} ${row.phone || ""} ${row.team_name || ""} ${row.school_name || ""} ${row.hub_name || ""}`.toLowerCase(),
      header: "Nombre",
      enableHiding: true,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.original.email}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "tg_id",
      header: "TG ID",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.tg_id || "—"}</span>
      ),
    },
    {
      accessorKey: "roles",
      header: "Roles",
      enableHiding: true,
      filterFn: (row, id, value) => {
        const roles = row.original.roles;
        return roles.includes(value as AppRole);
      },
      cell: ({ row }) =>
        row.original.roles.length > 0 ? (
          <RoleBadges roles={row.original.roles} size="sm" />
        ) : (
          <span className="text-muted-foreground text-sm">Sin rol</span>
        ),
    },
    {
      accessorKey: "verification_status",
      header: "Estado",
      enableHiding: true,
      filterFn: (row, id, value) => {
        return row.getValue(id) === value;
      },
      cell: ({ row }) => (
        <StatusBadge status={row.original.verification_status || "pending"} />
      ),
    },
    {
      accessorKey: "team_name",
      header: "Equipo",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.team_name || "—"}</span>
      ),
    },
    {
      accessorKey: "school_name",
      header: "Colegio/Empresa",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="text-sm max-w-[150px] truncate block">{row.original.school_name || "—"}</span>
      ),
    },
    {
      accessorKey: "hub_name",
      header: "Hub",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.hub_name || "—"}</span>
      ),
    },
    {
      accessorKey: "date_of_birth",
      header: "Edad",
      enableHiding: true,
      cell: ({ row }) => {
        const dob = row.original.date_of_birth;
        if (!dob) return <span className="text-muted-foreground">—</span>;
        
        const today = new Date();
        const birth = new Date(dob);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        
        // Highlight ages outside typical participant range (8-18)
        const isOutOfRange = age < 8 || age > 18;
        return (
          <span className={isOutOfRange ? "text-orange-600 font-medium" : "text-sm"}>
            {age}
          </span>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Teléfono",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.phone || "—"}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Registro",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.created_at || "").toLocaleDateString("es-ES")}
        </span>
      ),
    },
  ], []);

  // Stable callback for saving custom fields
  const handleSaveCustomField = useCallback(
    (userId: string, fieldKey: string, value: string, currentCustomFields: Record<string, unknown>) => {
      updateCustomFieldMutation.mutate({
        userId,
        fieldKey,
        value,
        currentCustomFields,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Stable callback for deleting custom columns
  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      deleteColumnMutation.mutate(columnId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Dynamic columns from custom fields
  const dynamicColumns: ColumnDef<UserWithRoles>[] = useMemo(() => {
    return (customColumns || []).map((col) => ({
      id: `custom_${col.column_key}`,
      accessorKey: `custom_fields.${col.column_key}`,
      header: () => (
        <div className="flex items-center justify-between gap-2">
          <span>{col.column_label}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteColumn(col.id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar campo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      enableHiding: true,
      cell: ({ row }) => {
        const customFields = (row.original.custom_fields || {}) as Record<string, unknown>;
        const value = (customFields[col.column_key] as string) || "";

        return (
          <EditableCell
            value={value}
            onSave={(newValue) => {
              handleSaveCustomField(
                row.original.id,
                col.column_key,
                newValue,
                customFields
              );
            }}
          />
        );
      },
    }));
  }, [customColumns, handleSaveCustomField, handleDeleteColumn]);

  // Combine all columns
  const columns = useMemo(
    () => [...staticColumns, ...dynamicColumns],
    [staticColumns, dynamicColumns]
  );

  // Filterable columns config
  const filterableColumns: FilterableColumn[] = [
    {
      key: "verification_status",
      label: "Estado",
      options: [
        { value: "pending", label: "Pendiente" },
        { value: "verified", label: "Verificado" },
        { value: "manual_review", label: "Revisión Manual" },
        { value: "rejected", label: "Rechazado" },
      ],
    },
    {
      key: "roles",
      label: "Rol",
      options: [
        { value: "participant", label: "Participante" },
        { value: "mentor", label: "Mentor" },
        { value: "judge", label: "Juez" },
        { value: "chapter_ambassador", label: "Embajador" },
        { value: "volunteer", label: "Voluntario" },
        { value: "admin", label: "Admin" },
      ],
    },
  ];

  // Get initial filters from URL params
  const initialFilters = useMemo(() => {
    const filters: Record<string, string> = {};
    const status = searchParams.get("status");
    if (status) {
      filters.verification_status = status;
    }
    return filters;
  }, [searchParams]);

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;
    addColumnMutation.mutate(newFieldLabel.trim());
  };

  // Export handler - exports only visible columns and filtered rows
  const handleExport = useCallback((exportData: ExportData<UserWithRoles>) => {
    const { rows, visibleColumns } = exportData;

    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    // Map column ID to value extractor
    const getColumnValue = (row: UserWithRoles, colId: string): string => {
      switch (colId) {
        case "name":
          return `${row.first_name || ""} ${row.last_name || ""}`.trim();
        case "tg_id":
          return row.tg_id || "";
        case "roles":
          return row.roles.join(", ");
        case "verification_status":
          return row.verification_status || "";
        case "team_name":
          return row.team_name || "";
        case "school_name":
          return row.school_name || "";
        case "hub_name":
          return row.hub_name || "";
        case "phone":
          return row.phone || "";
        case "created_at":
          return row.created_at ? format(new Date(row.created_at), "dd/MM/yyyy") : "";
        default:
          if (colId.startsWith("custom_")) {
            const key = colId.replace("custom_", "");
            return (row.custom_fields?.[key] as string) || "";
          }
          return "";
      }
    };

    // Escape CSV value
    const escapeCSV = (val: string): string => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    // Generate CSV
    const headers = visibleColumns.map(c => escapeCSV(c.header));
    const csvRows = [
      headers.join(","),
      ...rows.map(row =>
        visibleColumns.map(col => escapeCSV(getColumnValue(row, col.id))).join(",")
      ),
    ];

    // Download
    const blob = new Blob(["\ufeff" + csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exportados ${rows.length} usuarios`);
  }, []);

  const handleDeleteUser = useCallback(() => {
    if (!selectedUser) return;
    if (!canDeleteUser(selectedUser)) {
      toast.error("No se puede eliminar este usuario. Está verificado o existe en la whitelist.");
      return;
    }
    setDeleteDialogOpen(true);
  }, [selectedUser, canDeleteUser]);

  return (
    <AdminLayout title="Gestión de Usuarios">
      <div className="space-y-4 min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los usuarios de la plataforma
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Invitar Usuario</span>
            <span className="sm:hidden">Invitar</span>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="registered" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Registrados
              {users && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {users.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="unregistered" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Sin Registrar
              {unregisteredCount !== undefined && unregisteredCount > 0 && (
                <span className="ml-1 text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">
                  {unregisteredCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registered" className="mt-4">
            <AirtableDataTable
              columns={columns}
              data={users || []}
              searchPlaceholder="Buscar por nombre, email, equipo, hub..."
              loading={isLoading}
              filterableColumns={filterableColumns}
              initialFilters={initialFilters}
              hiddenColumns={hiddenColumns}
              onHiddenColumnsChange={setHiddenColumns}
              onAddColumn={() => setAddFieldDialogOpen(true)}
              onRowClick={(user) => {
                setSelectedUser(user as UserWithRoles);
                setEditSheetOpen(true);
              }}
              onExport={handleExport}
            />
          </TabsContent>

          <TabsContent value="unregistered" className="mt-4">
            <UnregisteredUsersTable />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Field Dialog */}
      <Dialog open={addFieldDialogOpen} onOpenChange={setAddFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Campo Personalizado</DialogTitle>
            <DialogDescription>
              Crea un nuevo campo de texto para almacenar información adicional
              de los usuarios
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddField} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field_label">Nombre del campo</Label>
              <Input
                id="field_label"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="Ej: Notas, Empresa, Origen..."
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddFieldDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={addColumnMutation.isPending}>
                {addColumnMutation.isPending ? "Creando..." : "Crear Campo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Edit Sheet */}
      <UserEditSheet
        user={selectedUser}
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        customColumns={customColumns}
        onDelete={handleDeleteUser}
        canDelete={selectedUser ? canDeleteUser(selectedUser) : false}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Eliminar usuario?"
        description={`Esta acción eliminará permanentemente a ${selectedUser?.first_name} ${selectedUser?.last_name}. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() =>
          selectedUser && deleteUserMutation.mutate(selectedUser.id)
        }
        loading={deleteUserMutation.isPending}
      />

      {/* Invite User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Usuario</DialogTitle>
            <DialogDescription>
              Se enviará un Magic Link al email indicado
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const email = formData.get("email") as string;

              const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                  emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
              });

              if (error) {
                toast.error(`Error: ${error.message}`);
              } else {
                toast.success(`Se ha enviado un Magic Link a ${email}`);
                setCreateDialogOpen(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new_email">Email</Label>
              <Input
                id="new_email"
                name="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Enviar Magic Link</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
