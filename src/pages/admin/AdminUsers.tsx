import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AirtableDataTable, FilterableColumn } from "@/components/admin/AirtableDataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EditableCell } from "@/components/admin/EditableCell";
import { UserEditSheet } from "@/components/admin/UserEditSheet";
import { Button } from "@/components/ui/button";
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
import { Plus, MoreVertical, Trash2 } from "lucide-react";
import { Profile, AppRole, TableCustomColumn } from "@/types/database";

type UserWithRole = Profile & { 
  role?: AppRole;
  team_name?: string | null;
  school_name?: string | null;
  hub_name?: string | null;
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
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addFieldDialogOpen, setAddFieldDialogOpen] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);

  // Fetch users with roles, teams, and hub info
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          *,
          hub:hubs(name)
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
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

      // Fetch authorized_students for school_name
      const { data: authorizedStudents, error: authStudentsError } = await supabase
        .from("authorized_students")
        .select("email, school_name");

      if (authStudentsError) throw authStudentsError;

      // Merge profiles with all related data
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        const teamMember = teamMembers?.find((tm) => tm.user_id === profile.id);
        const authorizedStudent = authorizedStudents?.find(
          (as) => as.email?.toLowerCase() === profile.email?.toLowerCase()
        );
        
        return {
          ...profile,
          custom_fields: (profile.custom_fields as Record<string, unknown>) || {},
          role: userRole?.role as AppRole | undefined,
          team_name: (teamMember?.team as { name: string } | null)?.name || null,
          school_name: authorizedStudent?.school_name || null,
          hub_name: (profile.hub as { name: string } | null)?.name || null,
        };
      });

      return usersWithRoles;
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

  // Static columns - memoized to prevent re-renders
  const staticColumns: ColumnDef<UserWithRole>[] = useMemo(() => [
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
      accessorKey: "role",
      header: "Rol",
      enableHiding: true,
      cell: ({ row }) =>
        row.original.role ? (
          <RoleBadge role={row.original.role} />
        ) : (
          <span className="text-muted-foreground">—</span>
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
  const dynamicColumns: ColumnDef<UserWithRole>[] = useMemo(() => {
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
      key: "role",
      label: "Rol",
      options: [
        { value: "participant", label: "Participante" },
        { value: "mentor", label: "Mentor" },
        { value: "judge", label: "Juez" },
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
            <span className="hidden sm:inline">Crear Usuario</span>
            <span className="sm:hidden">Crear</span>
          </Button>
        </div>

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
            setSelectedUser(user as UserWithRole);
            setEditSheetOpen(true);
          }}
          onExport={() => {
            // TODO: Implement CSV export
            toast.info("Exportación en desarrollo");
          }}
        />
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
        onDelete={(user) => {
          setDeleteDialogOpen(true);
        }}
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

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Usuario</DialogTitle>
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
