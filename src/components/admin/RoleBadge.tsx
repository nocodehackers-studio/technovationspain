import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AppRole } from "@/types/database";

interface RoleBadgeProps {
  role: AppRole;
  size?: "sm" | "md" | "lg";
}

interface RoleBadgesProps {
  roles: AppRole[];
  size?: "sm" | "md" | "lg";
}

const roleConfig: Record<AppRole, { label: string; className: string }> = {
  participant: {
    label: "Participante",
    className: "bg-category-junior/10 text-category-junior border-category-junior/20",
  },
  mentor: {
    label: "Mentor",
    className: "bg-info/10 text-info border-info/20",
  },
  collaborator: {
    label: "Colaborador",
    className: "bg-accent/10 text-accent border-accent/20",
  },
  chapter_ambassador: {
    label: "Embajador",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  admin: {
    label: "Admin",
    className: "bg-primary/10 text-primary border-primary/20",
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  const config = roleConfig[role];

  if (!config) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, sizeClasses[size])}
    >
      {config.label}
    </Badge>
  );
}

// Display order for roles (primary roles first, then additional roles)
const roleDisplayOrder: AppRole[] = ['participant', 'mentor', 'collaborator', 'chapter_ambassador', 'admin'];

export function RoleBadges({ roles, size = "md" }: RoleBadgesProps) {
  // Sort roles by display order
  const sortedRoles = [...roles].sort((a, b) => {
    return roleDisplayOrder.indexOf(a) - roleDisplayOrder.indexOf(b);
  });

  return (
    <div className="flex flex-wrap gap-1">
      {sortedRoles.map((role) => (
        <RoleBadge key={role} role={role} size={size} />
      ))}
    </div>
  );
}

export function getRoleLabel(role: AppRole): string {
  return roleConfig[role]?.label || role;
}

interface FlagBadgesProps {
  isJudge?: boolean;
  isVolunteer?: boolean;
  size?: "sm" | "md" | "lg";
}

const flagConfig = {
  judge: { label: "Juez", className: "bg-warning/10 text-warning border-warning/20" },
  volunteer: { label: "Voluntario/a", className: "bg-success/10 text-success border-success/20" },
};

export function FlagBadges({ isJudge, isVolunteer, size = "md" }: FlagBadgesProps) {
  if (!isJudge && !isVolunteer) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {isJudge && (
        <Badge variant="outline" className={cn(flagConfig.judge.className, sizeClasses[size])}>
          {flagConfig.judge.label}
        </Badge>
      )}
      {isVolunteer && (
        <Badge variant="outline" className={cn(flagConfig.volunteer.className, sizeClasses[size])}>
          {flagConfig.volunteer.label}
        </Badge>
      )}
    </div>
  );
}
