import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, AlertTriangle } from "lucide-react";

interface CategoryStats {
  total: number;
  active: number;
}

interface TeamStats {
  total: number;
  withParticipants: number;
  byCategory: {
    beginner: CategoryStats;
    junior: CategoryStats;
    senior: CategoryStats;
  };
}

interface TeamProgressCardProps {
  stats: TeamStats | undefined | null;
  isLoading?: boolean;
}

const categoryConfig = {
  beginner: { label: "Beginner", colorClass: "text-emerald-700 bg-emerald-100" },
  junior: { label: "Junior", colorClass: "text-blue-700 bg-blue-100" },
  senior: { label: "Senior", colorClass: "text-purple-700 bg-purple-100" },
} as const;

export function TeamProgressCard({ stats, isLoading }: TeamProgressCardProps) {
  const navigate = useNavigate();

  if (isLoading || !stats) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const percentage = stats.total > 0 ? (stats.withParticipants / stats.total) * 100 : 0;
  const pending = stats.total - stats.withParticipants;

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      onClick={() => navigate("/admin/teams")}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg">Progreso de Registro - Equipos</CardTitle>
            <CardDescription>Equipos de Technovation Global</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main metric */}
        <div className="text-center">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">
            {stats.withParticipants} <span className="text-muted-foreground font-normal">/ {stats.total}</span>
          </div>
          <p className="text-sm text-muted-foreground">equipos con participantes</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={percentage} className="h-3" />
          <p className="text-xs text-muted-foreground text-right">{percentage.toFixed(1)}%</p>
        </div>

        {/* Pending warning */}
        {pending > 0 && (
          <div className="flex items-center gap-2 text-warning bg-warning/10 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{pending} equipos sin participantes registrados</span>
          </div>
        )}

        {/* Breakdown by category */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map((cat) => {
            const config = categoryConfig[cat];
            const catStats = stats.byCategory[cat];
            return (
              <div key={cat} className={`text-center p-2 rounded-lg ${config.colorClass}`}>
                <div className="text-sm font-semibold">
                  {catStats.active} / {catStats.total}
                </div>
                <div className="text-xs opacity-80">{config.label}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
