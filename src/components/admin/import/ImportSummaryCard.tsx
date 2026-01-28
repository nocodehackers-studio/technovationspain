import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Scale, Crown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ProfileType } from "./ProfileTypeBadge";

interface ImportSummaryData {
  byProfileType: Record<ProfileType, number>;
  byDivision: Record<string, number>;
  totalRecords: number;
  conflictsCount: number;
  readyToImport: number;
}

interface ImportSummaryCardProps {
  data: ImportSummaryData;
}

export function ImportSummaryCard({ data }: ImportSummaryCardProps) {
  const profileTypeIcons: Record<ProfileType, React.ReactNode> = {
    student: <GraduationCap className="h-5 w-5 text-primary" />,
    mentor: <Users className="h-5 w-5 text-blue-600" />,
    judge: <Scale className="h-5 w-5 text-amber-600" />,
    chapter_ambassador: <Crown className="h-5 w-5 text-purple-600" />,
  };

  const profileTypeLabels: Record<ProfileType, string> = {
    student: "Estudiantes",
    mentor: "Mentores",
    judge: "Jueces",
    chapter_ambassador: "Embajadores",
  };

  const divisionColors: Record<string, string> = {
    Beginner: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    Junior: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    Senior: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Resumen de Importación
        </CardTitle>
        <CardDescription>
          {data.totalRecords.toLocaleString()} registros detectados en el CSV
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* By Profile Type */}
        <div>
          <h4 className="text-sm font-medium mb-3">Por tipo de perfil</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(data.byProfileType) as [ProfileType, number][])
              .filter(([_, count]) => count > 0)
              .map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border"
                >
                  {profileTypeIcons[type]}
                  <div>
                    <div className="text-lg font-semibold">{count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{profileTypeLabels[type]}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* By Division (only if students exist) */}
        {data.byProfileType.student > 0 && Object.keys(data.byDivision).length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Divisiones de estudiantes</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.byDivision)
                .filter(([_, count]) => count > 0)
                .map(([division, count]) => (
                  <Badge
                    key={division}
                    variant="outline"
                    className={divisionColors[division] || ""}
                  >
                    {division}: {count.toLocaleString()}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Conflicts Summary */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            {data.conflictsCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <span className="text-sm">
              {data.conflictsCount > 0
                ? `${data.conflictsCount} conflictos detectados`
                : "Sin conflictos"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {data.readyToImport.toLocaleString()} listos para importar
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
