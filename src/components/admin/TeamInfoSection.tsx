import { Users, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TeamMembership {
  teamId?: string;
  teamName: string;
  memberType: "participant" | "mentor" | null;
}

interface TeamInfoSectionProps {
  teams: TeamMembership[];
}

export function TeamInfoSection({ teams }: TeamInfoSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Users className="h-4 w-4" />
        {teams.length > 1 ? `Equipos (${teams.length})` : "Equipo"}
      </h3>

      {teams.length > 0 ? (
        <ScrollArea className={teams.length > 3 ? "max-h-40" : ""}>
          <div className="space-y-2">
            {teams.map((team, index) => (
              <div
                key={team.teamId || index}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <span className="text-sm font-medium">{team.teamName}</span>
                {team.memberType && (
                  <Badge
                    variant="outline"
                    className={
                      team.memberType === "mentor"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-secondary/50 text-secondary-foreground"
                    }
                  >
                    {team.memberType === "mentor" ? "Mentor" : "Estudiante"}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
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
