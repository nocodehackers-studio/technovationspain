import { useCallback, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { TeamLinkSection } from "@/components/admin/TeamLinkSection";
import { toast } from "sonner";
import { UserCheck, UserX, Trash2, QrCode, Shield } from "lucide-react";
import { Profile, AppRole, VerificationStatus, TableCustomColumn } from "@/types/database";

type UserWithRole = Profile & { role?: AppRole; team_name?: string | null };

interface UserEditSheetProps {
  user: UserWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customColumns?: TableCustomColumn[];
  onDelete?: (user: UserWithRole) => void;
}

export function UserEditSheet({
  user,
  open,
  onOpenChange,
  customColumns = [],
  onDelete,
}: UserEditSheetProps) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole | undefined>(undefined);

  // Fetch user's team membership
  const { data: teamMembership } = useQuery({
    queryKey: ["user-team-membership", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          id,
          member_type,
          team:teams(id, name)
        `)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  // Reset selected role when user changes
  useEffect(() => {
    setSelectedRole(undefined);
  }, [user?.id]);

  const currentRole = selectedRole ?? user?.role;

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: {
        first_name?: string;
        last_name?: string;
        phone?: string;
        postal_code?: string;
        tg_id?: string;
        tg_email?: string;
        verification_status?: VerificationStatus;
      };
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuario actualizado correctamente");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  // Update verification status
  const updateVerificationMutation = useMutation({
    mutationFn: async ({
      userId,
      status,
    }: {
      userId: string;
      status: VerificationStatus;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ verification_status: status })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-metrics"] });
      toast.success("Estado de verificación actualizado");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update custom fields mutation
  const updateCustomFieldsMutation = useMutation({
    mutationFn: async ({
      userId,
      customFields,
    }: {
      userId: string;
      customFields: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ custom_fields: customFields as unknown as Record<string, never> })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(`Error al guardar campos: ${error.message}`);
    },
  });

  const handleValidate = useCallback(() => {
    if (!user) return;
    updateVerificationMutation.mutate({
      userId: user.id,
      status: "verified",
    });
  }, [user, updateVerificationMutation]);

  const handleReject = useCallback(() => {
    if (!user) return;
    updateVerificationMutation.mutate({
      userId: user.id,
      status: "rejected",
    });
  }, [user, updateVerificationMutation]);

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, oldRole, newRole }: { userId: string; oldRole?: AppRole; newRole: AppRole }) => {
      // First, delete old role if exists
      if (oldRole) {
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", oldRole);
      }
      
      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: newRole }, { onConflict: "user_id,role" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Rol actualizado correctamente");
    },
    onError: (error) => {
      toast.error(`Error al cambiar rol: ${error.message}`);
    },
  });

  // Assign volunteer role mutation (additional role)
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Rol de validador QR asignado correctamente");
    },
    onError: (error) => {
      toast.error(`Error al asignar rol: ${error.message}`);
    },
  });

  const handleRoleChange = useCallback((newRole: AppRole) => {
    setSelectedRole(newRole);
  }, []);

  const handleSaveRole = useCallback(() => {
    if (!user || !selectedRole || selectedRole === user.role) return;
    updateRoleMutation.mutate({ 
      userId: user.id, 
      oldRole: user.role, 
      newRole: selectedRole 
    });
  }, [user, selectedRole, updateRoleMutation]);

  const handleAssignVolunteer = useCallback(() => {
    if (!user) return;
    assignRoleMutation.mutate({ userId: user.id, role: "volunteer" });
  }, [user, assignRoleMutation]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    
    // Collect custom field values
    const updatedCustomFields: Record<string, unknown> = {
      ...(user.custom_fields || {}),
    };
    customColumns.forEach((col) => {
      const value = formData.get(`custom_${col.column_key}`) as string;
      updatedCustomFields[col.column_key] = value;
    });

    // Update main profile fields
    updateUserMutation.mutate({
      userId: user.id,
      updates: {
        first_name: formData.get("first_name") as string,
        last_name: formData.get("last_name") as string,
        phone: formData.get("phone") as string,
        postal_code: formData.get("postal_code") as string,
        tg_id: formData.get("tg_id") as string,
        tg_email: formData.get("tg_email") as string,
      },
    });

    // Update custom fields if any exist
    if (customColumns.length > 0) {
      updateCustomFieldsMutation.mutate({
        userId: user.id,
        customFields: updatedCustomFields,
      });
    }
  };

  if (!user) return null;

  const initials =
    `${user.first_name?.charAt(0) || ""}${user.last_name?.charAt(0) || ""}`.toUpperCase() ||
    "?";

  const customFieldsData = (user.custom_fields || {}) as Record<string, unknown>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          {/* User Avatar & Basic Info */}
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left truncate">
                {user.first_name} {user.last_name}
              </SheetTitle>
              <SheetDescription className="text-left truncate">
                {user.email}
              </SheetDescription>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={user.verification_status || "pending"} />
                {user.role && <RoleBadge role={user.role} />}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {user.verification_status !== "verified" && (
              <Button
                variant="outline"
                size="sm"
                className="border-primary/50 text-primary hover:bg-primary/10"
                onClick={handleValidate}
                disabled={updateVerificationMutation.isPending}
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Validar
              </Button>
            )}
            {user.verification_status !== "rejected" && (
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={handleReject}
                disabled={updateVerificationMutation.isPending}
              >
                <UserX className="h-4 w-4 mr-1" />
                Rechazar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-accent/50 text-accent hover:bg-accent/10"
              onClick={handleAssignVolunteer}
              disabled={assignRoleMutation.isPending}
            >
              <QrCode className="h-4 w-4 mr-1" />
              Validador QR
            </Button>
          </div>
        </SheetHeader>

        <Separator className="my-6" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Información Personal
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  defaultValue={user.first_name || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellidos</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  defaultValue={user.last_name || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={user.phone || ""}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="postal_code">Código Postal</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  defaultValue={user.postal_code || ""}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Role Management */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Rol del Usuario
            </h3>
            <div className="flex items-center gap-3">
              <Select
                value={currentRole || "participant"}
                onValueChange={(value) => handleRoleChange(value as AppRole)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant">Participante</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="judge">Juez</SelectItem>
                  <SelectItem value="volunteer">Voluntario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {selectedRole && selectedRole !== user.role && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveRole}
                  disabled={updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending ? "Guardando..." : "Guardar rol"}
                </Button>
              )}
              {currentRole && <RoleBadge role={currentRole} />}
            </div>
            <p className="text-xs text-muted-foreground">
              Cambiar el rol principal del usuario. Los administradores tienen acceso completo al panel de gestión.
            </p>
          </div>

          <Separator />

          {/* Team Link Section */}
          <TeamLinkSection
            userId={user.id}
            currentTeamId={(teamMembership?.team as { id: string } | null)?.id}
            currentTeamName={(teamMembership?.team as { name: string } | null)?.name}
            currentMemberType={teamMembership?.member_type as "participant" | "mentor" | null}
          />

          <Separator />

          {/* Technovation Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Technovation
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tg_id">TG ID</Label>
                <Input
                  id="tg_id"
                  name="tg_id"
                  defaultValue={user.tg_id || ""}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tg_email">Email TG</Label>
                <Input
                  id="tg_email"
                  name="tg_email"
                  defaultValue={user.tg_email || ""}
                />
              </div>
            </div>
          </div>

          {/* Custom Fields */}
          {customColumns.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Campos Personalizados
                </h3>
                <div className="grid gap-4">
                  {customColumns.map((col) => (
                    <div key={col.id} className="space-y-2">
                      <Label htmlFor={`custom_${col.column_key}`}>
                        {col.column_label}
                      </Label>
                      <Input
                        id={`custom_${col.column_key}`}
                        name={`custom_${col.column_key}`}
                        defaultValue={(customFieldsData[col.column_key] as string) || ""}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <SheetFooter className="flex-col sm:flex-row gap-2">
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(user)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
