import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AppRole } from "@/types/database";

interface RoleBadgeProps {
  role: AppRole;
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
  judge: {
    label: "Juez",
    className: "bg-accent/10 text-accent border-accent/20",
  },
  volunteer: {
    label: "Voluntario",
    className: "bg-success/10 text-success border-success/20",
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

  return (
    <Badge
      variant="outline"
      className={cn(config.className, sizeClasses[size])}
    >
      {config.label}
    </Badge>
  );
}
