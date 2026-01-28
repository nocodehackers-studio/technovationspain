import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Scale, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileType = "student" | "mentor" | "judge" | "chapter_ambassador";

interface ProfileTypeBadgeProps {
  type: ProfileType;
  className?: string;
}

const profileTypeConfig: Record<ProfileType, { label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  student: {
    label: "Estudiante",
    icon: GraduationCap,
    variant: "default",
  },
  mentor: {
    label: "Mentor",
    icon: Users,
    variant: "secondary",
  },
  judge: {
    label: "Juez",
    icon: Scale,
    variant: "outline",
  },
  chapter_ambassador: {
    label: "Embajador",
    icon: Crown,
    variant: "secondary",
  },
};

export function ProfileTypeBadge({ type, className }: ProfileTypeBadgeProps) {
  const config = profileTypeConfig[type] || profileTypeConfig.student;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function getProfileTypeLabel(type: ProfileType): string {
  return profileTypeConfig[type]?.label || type;
}
