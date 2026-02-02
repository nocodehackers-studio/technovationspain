import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, AlertTriangle, CheckCircle2, Clock, Circle, Minus } from "lucide-react";

interface TeamStats {
  total: number;
  complete: number;
  inProgress: number;
  notStarted: number;
  noData: number;
  active: number;
}

interface TeamProgressCardProps {
  stats: TeamStats | undefined;
  isLoading?: boolean;
}

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

  const percentage = stats.total > 0 ? (stats.active / stats.total) * 100 : 0;
  const pending = stats.total - stats.active;

  const statusItems = [
    { 
      key: "complete", 
      label: "Completos", 
      value: stats.complete, 
      icon: <CheckCircle2 className="h-4 w-4" />,
      colorClass: "text-success bg-success/10"
    },
    { 
      key: "inProgress", 
      label: "En Progreso", 
      value: stats.inProgress, 
      icon: <Clock className="h-4 w-4" />,
      colorClass: "text-info bg-info/10"
    },
    { 
      key: "notStarted", 
      label: "Sin Iniciar", 
      value: stats.notStarted, 
      icon: <Circle className="h-4 w-4" />,
      colorClass: "text-warning bg-warning/10"
    },
    { 
      key: "noData", 
      label: "Sin Datos", 
      value: stats.noData, 
      icon: <Minus className="h-4 w-4" />,
      colorClass: "text-muted-foreground bg-muted"
    },
  ];

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
            {stats.active} <span className="text-muted-foreground font-normal">/ {stats.total}</span>
          </div>
          <p className="text-sm text-muted-foreground">equipos activos</p>
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
            <span className="text-sm font-medium">{pending} equipos pendientes de activación</span>
          </div>
        )}

        {/* Breakdown by status */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t">
          {statusItems.map((item) => (
            <div key={item.key} className={`text-center p-2 rounded-lg ${item.colorClass}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                {item.icon}
              </div>
              <div className="text-sm font-semibold">{item.value}</div>
              <div className="text-xs opacity-80 truncate">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
