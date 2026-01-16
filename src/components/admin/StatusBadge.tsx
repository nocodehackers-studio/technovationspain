import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status =
  | "pending"
  | "verified"
  | "rejected"
  | "manual_review"
  | "confirmed"
  | "cancelled"
  | "checked_in";

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: {
    label: "Pendiente",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  verified: {
    label: "Verificado",
    className: "bg-success/10 text-success border-success/20",
  },
  rejected: {
    label: "Rechazado",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  manual_review: {
    label: "Revisión Manual",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-info/10 text-info border-info/20",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
  checked_in: {
    label: "Check-in",
    className: "bg-success/10 text-success border-success/20",
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn(config.className, sizeClasses[size])}
    >
      {config.label}
    </Badge>
  );
}
