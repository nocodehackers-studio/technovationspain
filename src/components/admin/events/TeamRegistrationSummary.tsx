import { useState } from "react";
import { TeamEventStats } from "@/hooks/useEventTeamStats";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertCircle, ShieldCheck, Download, XCircle } from "lucide-react";
import { TeamCategory } from "@/types/database";

interface TeamRegistrationSummaryProps {
  teams: TeamEventStats[];
  isLoading: boolean;
  onToggleValidated?: (teamId: string, validated: boolean) => void;
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

type TeamStatus = "sin_mentor" | "parcial" | "completo" | "validado";

function getTeamStatus(team: TeamEventStats): TeamStatus {
  if (team.validated) return "validado";
  const total = team.totalParticipants + team.totalMentors;
  const registered = team.registeredParticipants + team.registeredMentors + team.waitlistedParticipants + team.waitlistedMentors;
  if (registered === total && total > 0) return "completo";
  if ((team.registeredMentors + team.waitlistedMentors) === 0 && team.totalMentors > 0) return "sin_mentor";
  return "parcial";
}

function StatusBadge({ team }: { team: TeamEventStats }) {
  const status = getTeamStatus(team);

  if (status === "validado") {
    return (
      <Badge
        className="bg-primary/10 text-primary border-primary/20"
        variant="outline"
      >
        <ShieldCheck className="h-3 w-3 mr-1" />
        Validado
      </Badge>
    );
  }
  if (status === "completo") {
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
  if (status === "sin_mentor") {
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

function handleExportTeamsCSV(teams: TeamEventStats[]) {
  const mentorsByTeam = teams.map((t) =>
    t.members.filter((m) => m.memberType === "mentor")
  );
  const maxMentors = Math.max(0, ...mentorsByTeam.map((m) => m.length));

  const headers = [
    "Equipo",
    "Categoría",
    "Participantes confirmados",
    "Participantes en espera",
    "Total participantes",
    "Mentores confirmados",
    "Mentores en espera",
    "Total mentores",
    "Completitud (%)",
    "Estado",
    "Validado",
  ];
  for (let i = 1; i <= maxMentors; i++) {
    headers.push(`Mentor ${i} - Nombre`, `Mentor ${i} - Email`, `Mentor ${i} - Registrado`);
  }

  const statusLabels: Record<TeamStatus, string> = {
    sin_mentor: "Sin mentor",
    parcial: "Parcial",
    completo: "Completo",
    validado: "Validado",
  };

  const rows = teams.map((team, idx) => {
    const mentors = mentorsByTeam[idx];
    const row: string[] = [
      team.teamName,
      team.category ?? "",
      String(team.registeredParticipants),
      String(team.waitlistedParticipants),
      String(team.totalParticipants),
      String(team.registeredMentors),
      String(team.waitlistedMentors),
      String(team.totalMentors),
      String(team.completionPercentage),
      statusLabels[getTeamStatus(team)],
      team.validated ? "Sí" : "No",
    ];
    for (let i = 0; i < maxMentors; i++) {
      const m = mentors[i];
      row.push(m?.name ?? "", m?.email ?? "", m ? (m.isRegistered ? "Sí" : m.isWaitlisted ? "En espera" : "No") : "");
    }
    return row;
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv =
    "\uFEFF" +
    [headers, ...rows].map((r) => r.map(escape).join(";")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `equipos-evento-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TeamRegistrationSummary({
  teams,
  isLoading,
  onToggleValidated,
}: TeamRegistrationSummaryProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-48" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No hay equipos con miembros registrados en este evento
      </div>
    );
  }

  const filteredTeams = statusFilter === "all"
    ? teams
    : teams.filter((team) => getTeamStatus(team) === statusFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Registro por Equipos</h3>
        <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExportTeamsCSV(filteredTeams)}
          disabled={filteredTeams.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ({teams.length})</SelectItem>
            <SelectItem value="sin_mentor">Sin mentor ({teams.filter(t => getTeamStatus(t) === "sin_mentor").length})</SelectItem>
            <SelectItem value="parcial">Parcial ({teams.filter(t => getTeamStatus(t) === "parcial").length})</SelectItem>
            <SelectItem value="completo">Completo ({teams.filter(t => getTeamStatus(t) === "completo").length})</SelectItem>
            <SelectItem value="validado">Validado ({teams.filter(t => getTeamStatus(t) === "validado").length})</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>
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
              <TableHead className="text-center">Validado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeams.map((team) => {
              const confirmed = team.members.filter((m) => m.isRegistered && !m.isCancelled);
              const waitlisted = team.members.filter((m) => m.isWaitlisted && !m.isCancelled);
              const cancelled = team.members.filter((m) => m.isCancelled);
              const missing = team.members.filter((m) => !m.isRegistered && !m.isWaitlisted && !m.isCancelled);

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
                            {team.registeredParticipants}
                            {team.waitlistedParticipants > 0 && (
                              <span className="text-amber-500">+{team.waitlistedParticipants}</span>
                            )}
                            /{team.totalParticipants}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {team.registeredMentors}
                            {team.waitlistedMentors > 0 && (
                              <span className="text-amber-500">+{team.waitlistedMentors}</span>
                            )}
                            /{team.totalMentors}
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
                        <TableCell className="text-center">
                          <Checkbox
                            checked={team.validated}
                            onCheckedChange={(checked) => {
                              onToggleValidated?.(team.teamId, !!checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                      </TableRow>
                    </TooltipTrigger>
                    {team.members.length > 0 && (
                      <TooltipContent
                        side="bottom"
                        className="max-w-[300px]"
                      >
                        {confirmed.length > 0 && (
                          <>
                            <p className="font-medium text-sm mb-1">
                              Inscritos:
                            </p>
                            {confirmed.map((m) => (
                              <p
                                key={m.userId}
                                className="text-xs flex items-center gap-1"
                              >
                                <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                                {m.name}
                                <span className="text-muted-foreground">
                                  ({m.memberType === "mentor"
                                    ? "Mentor"
                                    : "Participante"})
                                </span>
                              </p>
                            ))}
                          </>
                        )}
                        {waitlisted.length > 0 && (
                          <>
                            <p className={`font-medium text-sm mb-1${confirmed.length > 0 ? " mt-2" : ""}`}>
                              En lista de espera:
                            </p>
                            {waitlisted.map((m) => (
                              <p
                                key={m.userId}
                                className="text-xs flex items-center gap-1"
                              >
                                <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                                {m.name}
                                <span className="text-muted-foreground">
                                  ({m.memberType === "mentor"
                                    ? "Mentor"
                                    : "Participante"})
                                </span>
                              </p>
                            ))}
                          </>
                        )}
                        {missing.length > 0 && (
                          <>
                            <p className={`font-medium text-sm mb-1${confirmed.length > 0 || waitlisted.length > 0 ? " mt-2" : ""}`}>
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
                          </>
                        )}
                        {cancelled.length > 0 && (
                          <>
                            <p className={`font-medium text-sm mb-1${confirmed.length > 0 || waitlisted.length > 0 || missing.length > 0 ? " mt-2" : ""}`}>
                              Cancelados:
                            </p>
                            {cancelled.map((m) => (
                              <p
                                key={m.userId}
                                className="text-xs flex items-center gap-1"
                              >
                                <XCircle className="h-3 w-3 text-destructive shrink-0" />
                                {m.name}
                                <span className="text-muted-foreground">
                                  ({m.memberType === "mentor"
                                    ? "Mentor"
                                    : "Participante"})
                                </span>
                              </p>
                            ))}
                          </>
                        )}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              );
            })}
            {filteredTeams.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No hay equipos con el estado seleccionado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
