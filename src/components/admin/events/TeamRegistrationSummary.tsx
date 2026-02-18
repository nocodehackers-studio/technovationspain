import { TeamEventStats } from "@/hooks/useEventTeamStats";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { TeamCategory } from "@/types/database";

interface TeamRegistrationSummaryProps {
  teams: TeamEventStats[];
  isLoading: boolean;
}

const categoryColors: Record<TeamCategory, string> = {
  beginner:
    "bg-category-beginner/10 text-category-beginner border-category-beginner/20",
  junior:
    "bg-category-junior/10 text-category-junior border-category-junior/20",
  senior:
    "bg-category-senior/10 text-category-senior border-category-senior/20",
};

const categoryLabels: Record<TeamCategory, string> = {
  beginner: "Beginner",
  junior: "Junior",
  senior: "Senior",
};

function StatusBadge({ team }: { team: TeamEventStats }) {
  const total = team.totalParticipants + team.totalMentors;
  const registered = team.registeredParticipants + team.registeredMentors;

  if (registered === total && total > 0) {
    return (
      <Badge
        className="bg-success/10 text-success border-success/20"
        variant="outline"
      >
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Completo
      </Badge>
    );
  }
  if (team.registeredMentors === 0 && team.totalMentors > 0) {
    return (
      <Badge
        className="bg-warning/10 text-warning border-warning/20"
        variant="outline"
      >
        <AlertCircle className="h-3 w-3 mr-1" />
        Sin mentor
      </Badge>
    );
  }
  return (
    <Badge
      className="bg-blue-500/10 text-blue-500 border-blue-500/20"
      variant="outline"
    >
      <Clock className="h-3 w-3 mr-1" />
      Parcial
    </Badge>
  );
}

export function TeamRegistrationSummary({
  teams,
  isLoading,
}: TeamRegistrationSummaryProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-48" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  if (teams.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Registro por Equipos</h3>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Participantes</TableHead>
              <TableHead>Mentores</TableHead>
              <TableHead className="min-w-[140px]">Progreso</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => {
              const missing = team.members.filter((m) => !m.isRegistered);

              return (
                <TooltipProvider key={team.teamId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableRow className="cursor-default">
                        <TableCell className="font-medium">
                          {team.teamName}
                        </TableCell>
                        <TableCell>
                          {team.category ? (
                            <Badge
                              variant="outline"
                              className={
                                categoryColors[team.category as TeamCategory]
                              }
                            >
                              {categoryLabels[team.category as TeamCategory]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {team.registeredParticipants}/
                            {team.totalParticipants}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {team.registeredMentors}/{team.totalMentors}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={team.completionPercentage}
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {team.completionPercentage}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge team={team} />
                        </TableCell>
                      </TableRow>
                    </TooltipTrigger>
                    {missing.length > 0 && (
                      <TooltipContent
                        side="bottom"
                        className="max-w-[280px]"
                      >
                        <p className="font-medium text-sm mb-1">
                          Faltan por registrarse:
                        </p>
                        {missing.map((m) => (
                          <p
                            key={m.userId}
                            className="text-xs flex items-center gap-1"
                          >
                            <Clock className="h-3 w-3 text-warning shrink-0" />
                            {m.name}
                            <span className="text-muted-foreground">
                              ({m.memberType === "mentor"
                                ? "Mentor"
                                : "Participante"})
                            </span>
                          </p>
                        ))}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
