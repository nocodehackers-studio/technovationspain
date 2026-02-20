import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabase-utils";
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
  city?: string | null;
  state?: string | null;
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
      // Fetch profiles (paginated to avoid 1000-row limit)
      const profiles = await fetchAllRows<Record<string, unknown>>(
        "profiles",
        "*, hub:hubs!profiles_hub_id_fkey(name)",
      );

      // Fetch ALL roles for ALL users (paginated)
      const roles = await fetchAllRows<{ user_id: string; role: string }>(
        "user_roles",
        "user_id, role",
      );

      // Fetch team memberships with team names (paginated)
      const teamMembers = await fetchAllRows<{ user_id: string; team: { name: string } | null }>(
        "team_members",
        "user_id, team:teams(name)",
      );

      // Build role lookup map for O(1) access instead of O(n) filter per profile
      const rolesByUserId = new Map<string, AppRole[]>();
      for (const r of roles) {
        const existing = rolesByUserId.get(r.user_id) || [];
        existing.push(r.role as AppRole);
        rolesByUserId.set(r.user_id, existing);
      }

      // Build team lookup map
      const teamByUserId = new Map<string, string>();
      for (const tm of teamMembers) {
        if (tm.team?.name) teamByUserId.set(tm.user_id, tm.team.name);
      }

      // Merge profiles with all related data
      // Note: city, state, school_name, company_name are now directly on profiles after migration
      const usersWithRoles: UserWithRoles[] = profiles.map((profile) => {
        const userRoles = rolesByUserId.get(profile.id as string) || [];
        const profileAny = profile as any;

        return {
          ...profile,
          custom_fields: (profile.custom_fields as Record<string, unknown>) || {},
          roles: userRoles,
          team_name: teamByUserId.get(profile.id as string) || null,
          school_name: profileAny.school_name || profileAny.company_name || null,
          hub_name: (profile.hub as { name: string } | null)?.name || null,
          city: profileAny.city || null,
          state: profileAny.state || null,
        };
      });

      return usersWithRoles;
    },
  });

  // Fetch unregistered count for tab badge (pre-created profiles not yet onboarded)
  const { data: unregisteredCount } = useQuery({
    queryKey: ["admin-unregistered-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("onboarding_completed", false)
        .eq("verification_status", "verified");

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
        `${row.first_name || ""} ${row.last_name || ""} ${row.email || ""} ${row.tg_id || ""} ${row.phone || ""} ${row.team_name || ""} ${row.school_name || ""} ${row.hub_name || ""} ${row.city || ""} ${row.state || ""}`.toLowerCase(),
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
        if (Array.isArray(value)) return value.some((v: string) => roles.includes(v as AppRole));
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
        const v = row.getValue(id);
        if (Array.isArray(value)) return value.includes(v as string);
        return v === value;
      },
      cell: ({ row }) => (
        <StatusBadge status={row.original.verification_status || "pending"} />
      ),
    },
    {
      accessorKey: "team_name",
      header: "Equipo",
      enableHiding: true,
      filterFn: (row, id, value) => {
        const v = row.getValue(id) as string | null;
        const normalized = v || "__empty__";
        if (Array.isArray(value)) return value.includes(normalized);
        return normalized === value;
      },
      cell: ({ row }) => (
        <span className="text-sm">{row.original.team_name || "—"}</span>
      ),
    },
    {
      accessorKey: "school_name",
      header: "Colegio/Empresa",
      enableHiding: true,
      filterFn: (row, id, value) => {
        const v = row.getValue(id) as string | null;
        const normalized = v || "__empty__";
        if (Array.isArray(value)) return value.includes(normalized);
        return normalized === value;
      },
      cell: ({ row }) => (
        <span className="text-sm max-w-[150px] truncate block">{row.original.school_name || "—"}</span>
      ),
    },
    {
      accessorKey: "hub_name",
      header: "Hub",
      enableHiding: true,
      filterFn: (row, id, value) => {
        const v = row.getValue(id) as string | null;
        const normalized = v || "__empty__";
        if (Array.isArray(value)) return value.includes(normalized);
        return normalized === value;
      },
      cell: ({ row }) => (
        <span className="text-sm">{row.original.hub_name || "—"}</span>
      ),
    },
    {
      accessorKey: "city",
      header: "Ciudad",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.city || "—"}</span>
      ),
    },
    {
      accessorKey: "state",
      header: "Comunidad",
      enableHiding: true,
      filterFn: (row, id, value) => {
        const v = row.getValue(id) as string | null;
        const normalized = v || "__empty__";
        if (Array.isArray(value)) return value.includes(normalized);
        return normalized === value;
      },
      cell: ({ row }) => (
        <span className="text-sm max-w-[120px] truncate block">{row.original.state || "—"}</span>
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

  // Filterable columns config - dynamic options from data
  const filterableColumns: FilterableColumn[] = useMemo(() => {
    const hubOptions: FilterableColumn["options"] = [
      { value: "__empty__", label: "Sin Hub" },
    ];
    const teamOptions: FilterableColumn["options"] = [
      { value: "__empty__", label: "Sin equipo" },
    ];
    const stateOptions: FilterableColumn["options"] = [
      { value: "__empty__", label: "Sin comunidad" },
    ];
    const schoolOptions: FilterableColumn["options"] = [
      { value: "__empty__", label: "Sin chapter" },
    ];

    const hubSet = new Set<string>();
    const teamSet = new Set<string>();
    const stateSet = new Set<string>();
    const schoolSet = new Set<string>();

    (users || []).forEach((u) => {
      if (u.hub_name && !hubSet.has(u.hub_name)) {
        hubSet.add(u.hub_name);
        hubOptions.push({ value: u.hub_name, label: u.hub_name });
      }
      if (u.team_name && !teamSet.has(u.team_name)) {
        teamSet.add(u.team_name);
        teamOptions.push({ value: u.team_name, label: u.team_name });
      }
      if (u.state && !stateSet.has(u.state)) {
        stateSet.add(u.state);
        stateOptions.push({ value: u.state, label: u.state });
      }
      if (u.school_name && !schoolSet.has(u.school_name)) {
        schoolSet.add(u.school_name);
        schoolOptions.push({ value: u.school_name, label: u.school_name });
      }
    });

    // Sort alphabetically (after the "Sin..." option)
    const sortOpts = (opts: FilterableColumn["options"]) => {
      const first = opts[0];
      const rest = opts.slice(1).sort((a, b) => a.label.localeCompare(b.label));
      return [first, ...rest];
    };

    return [
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
          { value: "admin", label: "Admin" },
        ],
      },
      {
        key: "hub_name",
        label: "Hub",
        options: sortOpts(hubOptions),
      },
      {
        key: "team_name",
        label: "Equipo",
        options: sortOpts(teamOptions),
      },
      {
        key: "school_name",
        label: "Chapter",
        options: sortOpts(schoolOptions),
      },
      {
        key: "state",
        label: "Comunidad",
        options: sortOpts(stateOptions),
      },
    ];
  }, [users]);

  // Get initial filters from URL params
  const initialFilters = useMemo(() => {
    const filters: Record<string, string[]> = {};
    const status = searchParams.get("status");
    if (status) {
      filters.verification_status = [status];
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
