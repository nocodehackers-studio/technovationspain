import { Users, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TeamInfoSectionProps {
  currentTeamName?: string | null;
  currentMemberType?: "participant" | "mentor" | null;
}

export function TeamInfoSection({
  currentTeamName,
  currentMemberType,
}: TeamInfoSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Users className="h-4 w-4" />
        Equipo
      </h3>

      {currentTeamName ? (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{currentTeamName}</span>
            {currentMemberType && (
              <Badge
                variant="outline"
                className={
                  currentMemberType === "mentor"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-secondary/50 text-secondary-foreground"
                }
              >
                {currentMemberType === "mentor" ? "Mentor" : "Estudiante"}
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/10 text-muted-foreground">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">Sin equipo asignado</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        La asignación de equipos se gestiona automáticamente al importar el CSV de equipos desde Technovation Global.
      </p>
    </div>
  );
}
