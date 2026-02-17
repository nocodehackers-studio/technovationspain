import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, AlertTriangle, Users, Briefcase, Scale } from "lucide-react";

interface WhitelistStats {
  total: number;
  registered: number;
  byType: {
    student: { total: number; registered: number };
    mentor: { total: number; registered: number };
    judge: { total: number; registered: number };
  };
}

interface WhitelistProgressCardProps {
  stats: WhitelistStats | undefined;
  isLoading?: boolean;
}

export function WhitelistProgressCard({ stats, isLoading }: WhitelistProgressCardProps) {
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

  const percentage = stats.total > 0 ? (stats.registered / stats.total) * 100 : 0;
  const pending = stats.total - stats.registered;

  const typeIcons = {
    student: <Users className="h-4 w-4" />,
    mentor: <Briefcase className="h-4 w-4" />,
    judge: <Scale className="h-4 w-4" />,
  };

  const typeLabels = {
    student: "Estudiantes",
    mentor: "Mentores",
    judge: "Jueces",
  };

  return (
    <Card 
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      onClick={() => navigate("/admin/users")}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg">Progreso de Verificación</CardTitle>
            <CardDescription>Usuarios registrados en la plataforma</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main metric */}
        <div className="text-center">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">
            {stats.registered} <span className="text-muted-foreground font-normal">/ {stats.total}</span>
          </div>
          <p className="text-sm text-muted-foreground">usuarios verificados</p>
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
            <span className="text-sm font-medium">{pending} usuarios pendientes de verificación</span>
          </div>
        )}

        {/* Breakdown by type */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          {(Object.keys(stats.byType) as Array<keyof typeof stats.byType>).map((type) => {
            const typeStats = stats.byType[type];
            const typePercentage = typeStats.total > 0 
              ? (typeStats.registered / typeStats.total) * 100 
              : 0;
            
            return (
              <div key={type} className="text-center p-2 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  {typeIcons[type]}
                  <span className="text-xs">{typeLabels[type]}</span>
                </div>
                <div className="text-sm font-semibold">
                  {typeStats.registered}/{typeStats.total}
                </div>
                <div className="text-xs text-muted-foreground">
                  {typePercentage.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
