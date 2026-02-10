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
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RoleBadges } from "@/components/admin/RoleBadge";
import { TeamInfoSection } from "@/components/admin/TeamInfoSection";
import { HubLinkSection } from "@/components/admin/HubLinkSection";
import { MultiRoleSelector } from "@/components/admin/users/MultiRoleSelector";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { UserCheck, UserX, Trash2 } from "lucide-react";
import { Profile, AppRole, VerificationStatus, TableCustomColumn } from "@/types/database";

type UserWithRoles = Profile & { roles: AppRole[]; team_name?: string | null };

interface UserEditSheetProps {
  user: UserWithRoles | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customColumns?: TableCustomColumn[];
  onDelete?: () => void;
  canDelete?: boolean;
}

export function UserEditSheet({
  user,
  open,
  onOpenChange,
  customColumns = [],
  onDelete,
  canDelete = true,
}: UserEditSheetProps) {
  const queryClient = useQueryClient();

  // Fetch user's team memberships (supports multiple teams for mentors)
  const { data: teamMemberships } = useQuery({
    queryKey: ["user-team-memberships", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          id,
          member_type,
          team:teams(id, name)
        `)
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open,
  });

  // Fetch user's hub info
  const { data: userHub } = useQuery({
    queryKey: ["user-hub", user?.hub_id],
    queryFn: async () => {
      if (!user?.hub_id) return null;
      const { data, error } = await supabase
        .from("hubs")
        .select("id, name, location")
        .eq("id", user.hub_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.hub_id && open,
  });

  // Fetch user's all roles
  const { data: userRoles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return (data || []).map((r) => r.role as AppRole);
    },
    enabled: !!user?.id && open,
  });

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
    }, {
      onSuccess: () => {
        // Send welcome email (fire and forget)
        supabase.functions.invoke("send-welcome-email", {
          body: { email: user.email, firstName: user.first_name },
        }).catch((err) => console.error("Welcome email error:", err));
      },
    });
  }, [user, updateVerificationMutation]);

  const handleReject = useCallback(() => {
    if (!user) return;
    updateVerificationMutation.mutate({
      userId: user.id,
      status: "rejected",
    });
  }, [user, updateVerificationMutation]);

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
  const displayRoles = userRoles || user.roles || [];

  const deleteTooltip = !canDelete
    ? user.verification_status === "verified"
      ? "No se puede eliminar un usuario verificado"
      : "No se puede eliminar un usuario que está en la whitelist"
    : undefined;

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
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <StatusBadge status={user.verification_status || "pending"} />
                {displayRoles.length > 0 && <RoleBadges roles={displayRoles} size="sm" />}
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

          {/* Multi Role Management */}
          <MultiRoleSelector userId={user.id} />

          <Separator />

          {/* Team Info Section (read-only) - supports multiple teams */}
          <TeamInfoSection
            teams={(teamMemberships || []).map((tm) => ({
              teamId: (tm.team as { id: string; name: string } | null)?.id,
              teamName: (tm.team as { id: string; name: string } | null)?.name || "Equipo desconocido",
              memberType: tm.member_type as "participant" | "mentor" | null,
            }))}
          />

          <Separator />

          {/* Hub Link Section */}
          <HubLinkSection
            userId={user.id}
            currentHubId={user.hub_id}
            currentHubName={userHub?.name}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        onClick={onDelete}
                        disabled={!canDelete}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {deleteTooltip && (
                    <TooltipContent>
                      <p>{deleteTooltip}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
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
