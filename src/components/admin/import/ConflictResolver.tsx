import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ArrowRight, RefreshCw, Info } from "lucide-react";
import { ConflictTable, ConflictRecord } from "./ConflictTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ConflictResolverProps {
  conflicts: ConflictRecord[];
  onConflictActionChange: (conflictId: string, action: ConflictRecord["action"]) => void;
  onSelectAllSkip: (skip: boolean) => void;
  onSelectAllUpdate?: () => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ConflictResolver({
  conflicts,
  onConflictActionChange,
  onSelectAllSkip,
  onSelectAllUpdate,
  onContinue,
  onBack,
}: ConflictResolverProps) {
  const activeUserConflicts = conflicts.filter(c => c.conflictType === "already_active");
  const whitelistConflicts = conflicts.filter(c => c.conflictType === "already_in_whitelist");
  const duplicateConflicts = conflicts.filter(c => c.conflictType === "duplicate_in_csv");
  const skippedCount = conflicts.filter(c => c.action === "skip").length;
  const updateCount = conflicts.filter(c => c.action === "update").length;

  // Check if ALL records are already in whitelist (reimport scenario)
  const allInWhitelist = whitelistConflicts.length > 0 && 
    whitelistConflicts.length === conflicts.length - activeUserConflicts.length - duplicateConflicts.length;

  return (
    <div className="space-y-6">
      {/* Active users warning */}
      {activeUserConflicts.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <CheckCircle2 className="h-5 w-5" />
              Usuarios Activos Protegidos
            </CardTitle>
            <CardDescription>
              Se han detectado {activeUserConflicts.length} usuarios que ya están registrados 
              y activos en la plataforma. Sus datos <strong>no serán modificados</strong> para 
              preservar la información existente.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Bulk update option when many whitelist conflicts */}
      {whitelistConflicts.length > 50 && onSelectAllUpdate && (
        <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">
            {allInWhitelist 
              ? "Todos los registros ya existen en la whitelist" 
              : `${whitelistConflicts.length} registros ya están en la whitelist`
            }
          </AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
            <span className="text-muted-foreground">
              {allInWhitelist 
                ? "Este CSV parece ser una reimportación. Puedes actualizar todos los datos existentes."
                : "Puedes actualizar todos a la vez o revisar individualmente."
              }
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onSelectAllSkip(true)}
              >
                Ignorar todos
              </Button>
              <Button 
                variant="default"
                size="sm"
                onClick={onSelectAllUpdate}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar todos
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Resolveable conflicts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Resolver Conflictos
          </CardTitle>
          <CardDescription>
            Revisa los siguientes conflictos y decide qué acción tomar para cada uno. 
            Los usuarios activos no pueden modificarse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConflictTable
            conflicts={conflicts}
            onConflictActionChange={onConflictActionChange}
            onSelectAll={onSelectAllSkip}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {updateCount} se actualizarán, {skippedCount} se ignorarán
          </span>
          <Button onClick={onContinue}>
            Continuar con la importación
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
