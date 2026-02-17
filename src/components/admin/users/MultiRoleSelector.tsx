import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RoleBadges } from "@/components/admin/RoleBadge";
import { toast } from "sonner";
import { Shield, Crown, Users, GraduationCap, Scale, QrCode, Check } from "lucide-react";
import { AppRole } from "@/types/database";

interface MultiRoleSelectorProps {
  userId: string;
}

// Primary roles - user should have exactly one
const PRIMARY_ROLES: { role: AppRole; label: string; icon: React.ReactNode }[] = [
  { role: "participant", label: "Participante", icon: <GraduationCap className="h-4 w-4" /> },
  { role: "mentor", label: "Mentor", icon: <Users className="h-4 w-4" /> },
  { role: "judge", label: "Juez", icon: <Scale className="h-4 w-4" /> },
  { role: "chapter_ambassador", label: "Embajador", icon: <Crown className="h-4 w-4" /> },
];

// Additional roles - can be combined with primary
const ADDITIONAL_ROLES: { role: AppRole; label: string; description: string; icon: React.ReactNode }[] = [
  { role: "volunteer", label: "Validador QR", description: "Puede escanear entradas en eventos", icon: <QrCode className="h-4 w-4" /> },
  { role: "admin", label: "Administrador", description: "Acceso completo al panel de gestión", icon: <Shield className="h-4 w-4" /> },
];

export function MultiRoleSelector({ userId }: MultiRoleSelectorProps) {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<{
    add: AppRole[];
    remove: AppRole[];
  }>({ add: [], remove: [] });

  // Fetch all current roles for this user
  const { data: userRoles, isLoading } = useQuery({
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      return (data || []).map((r) => r.role as AppRole);
    },
    enabled: !!userId,
  });

  // Reset pending changes when user changes
  useEffect(() => {
    setPendingChanges({ add: [], remove: [] });
  }, [userId]);

  // Calculate effective roles (current + pending)
  const effectiveRoles = (() => {
    if (!userRoles) return [];
    const roles = new Set(userRoles);
    pendingChanges.add.forEach((r) => roles.add(r));
    pendingChanges.remove.forEach((r) => roles.delete(r));
    return Array.from(roles);
  })();

  const currentPrimaryRole = PRIMARY_ROLES.find((pr) => effectiveRoles.includes(pr.role))?.role;

  // Save roles mutation
  const saveRolesMutation = useMutation({
    mutationFn: async () => {
      // Remove roles
      for (const role of pendingChanges.remove) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }

      // Add roles
      for (const role of pendingChanges.add) {
        const { error } = await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setPendingChanges({ add: [], remove: [] });
      toast.success("Roles actualizados correctamente");
    },
    onError: (error) => {
      toast.error(`Error al guardar roles: ${error.message}`);
    },
  });

  const handlePrimaryRoleChange = (role: AppRole) => {
    // If clicking current primary role, do nothing (must have one)
    if (role === currentPrimaryRole) return;

    // Remove old primary role (if exists)
    const newRemove = [...pendingChanges.remove];
    const newAdd = pendingChanges.add.filter((r) => !PRIMARY_ROLES.map((pr) => pr.role).includes(r));

    if (currentPrimaryRole) {
      // Check if it was in add list (pending addition)
      if (pendingChanges.add.includes(currentPrimaryRole)) {
        // Just remove from add list
      } else if (!pendingChanges.remove.includes(currentPrimaryRole)) {
        // Add to remove list
        newRemove.push(currentPrimaryRole);
      }
    }

    // Add new primary role
    if (userRoles?.includes(role)) {
      // Remove from remove list if it was there
      const idx = newRemove.indexOf(role);
      if (idx >= 0) newRemove.splice(idx, 1);
    } else {
      // Add to add list
      newAdd.push(role);
    }

    setPendingChanges({ add: newAdd, remove: newRemove });
  };

  const handleAdditionalRoleToggle = (role: AppRole, enabled: boolean) => {
    const newAdd = [...pendingChanges.add];
    const newRemove = [...pendingChanges.remove];

    const hasRole = userRoles?.includes(role);

    if (enabled) {
      if (hasRole) {
        // Remove from remove list
        const idx = newRemove.indexOf(role);
        if (idx >= 0) newRemove.splice(idx, 1);
      } else {
        // Add to add list
        if (!newAdd.includes(role)) newAdd.push(role);
      }
    } else {
      if (hasRole) {
        // Add to remove list
        if (!newRemove.includes(role)) newRemove.push(role);
      } else {
        // Remove from add list
        const idx = newAdd.indexOf(role);
        if (idx >= 0) newAdd.splice(idx, 1);
      }
    }

    setPendingChanges({ add: newAdd, remove: newRemove });
  };

  const hasChanges = pendingChanges.add.length > 0 || pendingChanges.remove.length > 0;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando roles...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Roles del Usuario
      </h3>

      {/* Current roles display */}
      {effectiveRoles.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Roles actuales:</span>
          <RoleBadges roles={effectiveRoles} size="sm" />
        </div>
      )}

      {/* Primary role selection */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Rol Principal</p>
        <p className="text-xs text-muted-foreground mb-2">
          El rol principal define el tipo de participación en Technovation
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PRIMARY_ROLES.map(({ role, label, icon }) => (
            <div
              key={role}
              className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                currentPrimaryRole === role
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => handlePrimaryRoleChange(role)}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                  currentPrimaryRole === role
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30"
                }`}
              >
                {currentPrimaryRole === role && <Check className="h-3 w-3" />}
              </div>
              <div className="flex items-center gap-1.5">
                {icon}
                <span className="text-sm">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional roles */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Roles Adicionales</p>
        <p className="text-xs text-muted-foreground mb-2">
          Estos roles se combinan con el rol principal
        </p>
        {ADDITIONAL_ROLES.map(({ role, label, description, icon }) => (
          <div
            key={role}
            className="flex items-center justify-between p-3 rounded-md border"
          >
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">{icon}</div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              checked={effectiveRoles.includes(role)}
              onCheckedChange={(checked) => handleAdditionalRoleToggle(role, checked)}
            />
          </div>
        ))}
      </div>

      {/* Save button */}
      {hasChanges && (
        <Button
          onClick={() => saveRolesMutation.mutate()}
          disabled={saveRolesMutation.isPending}
          className="w-full"
        >
          {saveRolesMutation.isPending ? "Guardando..." : "Guardar Cambios de Roles"}
        </Button>
      )}
    </div>
  );
}
