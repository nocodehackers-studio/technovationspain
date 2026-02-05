import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Scale, Crown, AlertTriangle, CheckCircle2, Package, UserPlus, RefreshCw, Calendar, MapPin, Phone, School, UserCog } from "lucide-react";
import { ProfileType } from "./ProfileTypeBadge";

interface DetectedChanges {
  ageUpdated: number;
  teamChanged: number;
  divisionChanged: number;
  phoneUpdated: number;
  nameUpdated: number;
  schoolUpdated: number;
  cityStateUpdated: number;
  parentInfoUpdated: number;
  total: number;
}

interface ImportSummaryData {
  byProfileType: Record<ProfileType, number>;
  byDivision: Record<string, number>;
  totalRecords: number;
  conflictsCount: number;
  readyToImport: number;
  teamsInCSV?: number;
  teamsToCreate?: number;
  teamsExisting?: number;
  usersInCSV?: number;
  usersNew?: number;
  usersInWhitelist?: number;
  usersAlreadyActive?: number;
  detectedChanges?: DetectedChanges;
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

  const hasChanges = data.detectedChanges && data.detectedChanges.total > 0;

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

        {/* Users Summary */}
        {data.usersInCSV != null && data.usersInCSV > 0 && (
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Usuarios Detectados</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{data.usersInCSV}</div>
                <div className="text-sm text-muted-foreground">En CSV</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{data.usersNew || 0}</div>
                <div className="text-sm text-muted-foreground">Nuevos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{data.usersInWhitelist || 0}</div>
                <div className="text-sm text-muted-foreground">En whitelist</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">{data.usersAlreadyActive || 0}</div>
                <div className="text-sm text-muted-foreground">Ya activos</div>
              </div>
            </div>
          </div>
        )}

        {/* Detected Changes - NEW SECTION */}
        {hasChanges && data.detectedChanges && (
          <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-5 w-5 text-amber-600" />
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                Cambios Detectados
              </h4>
              <Badge variant="secondary" className="ml-auto">
                {data.detectedChanges.total} usuarios con cambios
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {data.detectedChanges.ageUpdated > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{data.detectedChanges.ageUpdated}</strong> edades
                  </span>
                </div>
              )}
              {data.detectedChanges.teamChanged > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{data.detectedChanges.teamChanged}</strong> equipos
                  </span>
                </div>
              )}
              {data.detectedChanges.divisionChanged > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{data.detectedChanges.divisionChanged}</strong> divisiones
                  </span>
                </div>
              )}
              {data.detectedChanges.phoneUpdated > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{data.detectedChanges.phoneUpdated}</strong> teléfonos
                  </span>
                </div>
              )}
              {data.detectedChanges.nameUpdated > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{data.detectedChanges.nameUpdated}</strong> nombres
                  </span>
                </div>
              )}
              {data.detectedChanges.schoolUpdated > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                  <School className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{data.detectedChanges.schoolUpdated}</strong> escuelas
                  </span>
                </div>
              )}
              {data.detectedChanges.cityStateUpdated > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{data.detectedChanges.cityStateUpdated}</strong> ubicaciones
                  </span>
                </div>
              )}
              {data.detectedChanges.parentInfoUpdated > 0 && (
                <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{data.detectedChanges.parentInfoUpdated}</strong> tutores
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Teams Summary */}
        {data.teamsInCSV != null && data.teamsInCSV > 0 && (
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Equipos Detectados</h4>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{data.teamsInCSV}</div>
                <div className="text-sm text-muted-foreground">En CSV</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">{data.teamsExisting || 0}</div>
                <div className="text-sm text-muted-foreground">Ya existen</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{data.teamsToCreate || 0}</div>
                <div className="text-sm text-muted-foreground">Se crearán</div>
              </div>
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
                ? `${data.conflictsCount} registros requieren revisión`
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
