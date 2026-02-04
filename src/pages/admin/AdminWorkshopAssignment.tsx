import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWorkshopAssignment } from '@/hooks/useWorkshopAssignment';
import { useAllTeamsPreferences } from '@/hooks/useWorkshopPreferences';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Shuffle, 
  Play, 
  Eye, 
  Check, 
  AlertTriangle, 
  X, 
  Trash2,
  CheckCircle2
} from 'lucide-react';

interface AssignmentResult {
  teamId: string;
  teamName: string;
  participantCount: number;
  workshopA: { workshopId: string; workshopName: string; slotNumber: number } | null;
  workshopB: { workshopId: string; workshopName: string; slotNumber: number } | null;
  preferenceMatchedA: number | null;
  preferenceMatchedB: number | null;
  errors: string[];
}

interface AssignmentStats {
  totalTeams: number;
  fullyAssigned: number;
  partiallyAssigned: number;
  unassigned: number;
  preferenceStats: { preference: number; count: number }[];
}

export default function AdminWorkshopAssignment() {
  const { eventId } = useParams();
  const [previewResults, setPreviewResults] = useState<{ results: AssignmentResult[]; stats: AssignmentStats } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const {
    workshops,
    timeSlots,
    existingAssignments,
    assignmentsLoading,
    runAssignment,
    clearAssignments,
    isRunning,
    isClearing,
  } = useWorkshopAssignment(eventId || '');

  const { data: teamsData } = useAllTeamsPreferences(eventId || '');

  // Fetch event
  const { data: event } = useQuery({
    queryKey: ['admin-event', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data } = await supabase
        .from('events')
        .select('id, name, date')
        .eq('id', eventId)
        .single();
      return data;
    },
    enabled: !!eventId,
  });

  const teamsWithPrefs = teamsData?.filter(t => t.hasPreferences).length || 0;
  const totalTeams = teamsData?.length || 0;
  const teamsWithoutPrefs = totalTeams - teamsWithPrefs;

  const hasAssignments = existingAssignments && existingAssignments.length > 0;

  const handlePreview = async () => {
    try {
      const result = await runAssignment({ dryRun: true });
      setPreviewResults(result);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleExecute = async () => {
    try {
      await runAssignment({ dryRun: false });
      setPreviewResults(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleClear = async () => {
    await clearAssignments();
    setClearDialogOpen(false);
    setPreviewResults(null);
  };

  // Validation checks
  const validationChecks = [
    {
      label: `${teamsWithPrefs} equipos con preferencias registradas`,
      ok: teamsWithPrefs > 0,
    },
    {
      label: `${teamsWithoutPrefs} equipos sin preferencias (serán asignados al final)`,
      ok: true,
      warning: teamsWithoutPrefs > 0,
    },
    {
      label: `${workshops?.length || 0} talleres configurados`,
      ok: (workshops?.length || 0) > 0,
    },
    {
      label: `${timeSlots?.length || 0} turnos horarios definidos`,
      ok: (timeSlots?.length || 0) > 0,
    },
  ];

  const canRun = validationChecks.filter(c => !c.ok && !c.warning).length === 0 && 
                 (workshops?.length || 0) > 0 && 
                 (timeSlots?.length || 0) > 0;

  return (
    <AdminLayout title="Asignación de Talleres">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/workshops">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shuffle className="h-6 w-6" />
                Asignación de Talleres
              </h1>
              <p className="text-muted-foreground">{event?.name}</p>
            </div>
          </div>
          {hasAssignments && (
            <Button 
              variant="outline" 
              className="text-destructive hover:text-destructive"
              onClick={() => setClearDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar Asignaciones
            </Button>
          )}
        </div>

        {/* Current Status */}
        {hasAssignments && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Asignaciones existentes</AlertTitle>
            <AlertDescription className="text-green-700">
              Hay {existingAssignments?.length || 0} asignaciones guardadas. 
              Si ejecutas el algoritmo de nuevo, se reemplazarán las asignaciones actuales.
            </AlertDescription>
          </Alert>
        )}

        {/* Pre-validation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pre-validación</CardTitle>
            <CardDescription>
              Verifica que todo esté configurado antes de ejecutar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {validationChecks.map((check, i) => (
                <div key={i} className="flex items-center gap-3">
                  {check.ok ? (
                    check.warning ? (
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    ) : (
                      <Check className="h-5 w-5 text-green-600 shrink-0" />
                    )
                  ) : (
                    <X className="h-5 w-5 text-red-500 shrink-0" />
                  )}
                  <span className={check.warning ? 'text-amber-700' : ''}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handlePreview}
            disabled={!canRun || isRunning}
          >
            <Eye className="mr-2 h-4 w-4" />
            {isRunning ? 'Calculando...' : 'Vista Previa (Dry Run)'}
          </Button>
          <Button 
            onClick={handleExecute}
            disabled={!canRun || isRunning}
          >
            <Play className="mr-2 h-4 w-4" />
            {isRunning ? 'Ejecutando...' : 'Ejecutar Asignación'}
          </Button>
        </div>

        {/* Preview Results */}
        {previewResults && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Resultados {previewResults.stats ? '(Vista Previa)' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {previewResults.stats.fullyAssigned}
                  </div>
                  <div className="text-sm text-green-600">Asignados completos</div>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-700">
                    {previewResults.stats.partiallyAssigned}
                  </div>
                  <div className="text-sm text-amber-600">Parciales</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-700">
                    {previewResults.stats.unassigned}
                  </div>
                  <div className="text-sm text-red-600">Sin asignar</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">
                    {previewResults.stats.totalTeams}
                  </div>
                  <div className="text-sm text-muted-foreground">Total equipos</div>
                </div>
              </div>

              {/* Preference Stats */}
              {previewResults.stats.preferenceStats.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Satisfacción de preferencias:</h4>
                  <div className="space-y-2">
                    {previewResults.stats.preferenceStats.map(({ preference, count }) => {
                      const total = previewResults.stats.preferenceStats.reduce((s, p) => s + p.count, 0);
                      const percentage = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={preference} className="flex items-center gap-3">
                          <span className="text-sm w-24">
                            {preference}ª opción:
                          </span>
                          <Progress value={percentage} className="flex-1 h-2" />
                          <span className="text-sm text-muted-foreground w-20 text-right">
                            {count} ({Math.round(percentage)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Results Table */}
              <div>
                <h4 className="font-medium mb-3">Detalle por equipo:</h4>
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Part.</TableHead>
                        <TableHead>Taller A</TableHead>
                        <TableHead>Taller B</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResults.results.map((result) => (
                        <TableRow key={result.teamId}>
                          <TableCell className="font-medium">{result.teamName}</TableCell>
                          <TableCell>{result.participantCount}</TableCell>
                          <TableCell>
                            {result.workshopA ? (
                              <div className="text-sm">
                                <span>{result.workshopA.workshopName}</span>
                                <div className="text-xs text-muted-foreground">
                                  Turno {result.workshopA.slotNumber}
                                  {result.preferenceMatchedA && (
                                    <> • Pref #{result.preferenceMatchedA}</>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-red-500">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.workshopB ? (
                              <div className="text-sm">
                                <span>{result.workshopB.workshopName}</span>
                                <div className="text-xs text-muted-foreground">
                                  Turno {result.workshopB.slotNumber}
                                  {result.preferenceMatchedB && (
                                    <> • Pref #{result.preferenceMatchedB}</>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-red-500">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.errors.length > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {result.errors.length} error(es)
                              </Badge>
                            ) : result.workshopA && result.workshopB ? (
                              <Badge className="bg-green-100 text-green-800">OK</Badge>
                            ) : (
                              <Badge variant="secondary">Parcial</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clear Confirmation */}
        <ConfirmDialog
          open={clearDialogOpen}
          onOpenChange={setClearDialogOpen}
          title="¿Eliminar todas las asignaciones?"
          description="Esta acción eliminará todas las asignaciones de talleres para este evento. Tendrás que ejecutar el algoritmo de nuevo para generar nuevas asignaciones."
          confirmText="Eliminar"
          variant="danger"
          onConfirm={handleClear}
          loading={isClearing}
        />
      </div>
    </AdminLayout>
  );
}
