import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { ConflictTable, ConflictRecord } from "./ConflictTable";

interface ConflictResolverProps {
  conflicts: ConflictRecord[];
  onConflictActionChange: (conflictId: string, action: ConflictRecord["action"]) => void;
  onSelectAllSkip: (skip: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ConflictResolver({
  conflicts,
  onConflictActionChange,
  onSelectAllSkip,
  onContinue,
  onBack,
}: ConflictResolverProps) {
  const activeUserConflicts = conflicts.filter(c => c.conflictType === "already_active");
  const resolveableConflicts = conflicts.filter(c => c.conflictType !== "already_active");
  const skippedCount = conflicts.filter(c => c.action === "skip").length;

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
            {skippedCount} serán ignorados
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
