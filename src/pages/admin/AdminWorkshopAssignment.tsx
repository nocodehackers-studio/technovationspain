import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWorkshopAssignment, AssignmentResult, AssignmentStats } from '@/hooks/useWorkshopAssignment';
import { useAllTeamsPreferences } from '@/hooks/useWorkshopPreferences';
import { useDemoData } from '@/hooks/useDemoData';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  CheckCircle2,
  FlaskConical,
  Loader2,
  Download,
  ExternalLink,
} from 'lucide-react';

interface GroupedAssignment {
  teamId: string;
  teamName: string;
  participantCount: number;
  slotA: { workshopName: string; slotNumber: number; preferenceMatched: number | null; assignmentType: string } | null;
  slotB: { workshopName: string; slotNumber: number; preferenceMatched: number | null; assignmentType: string } | null;
}

export default function AdminWorkshopAssignment() {
  const { eventId } = useParams();
  const [previewResults, setPreviewResults] = useState<{ results: AssignmentResult[]; stats: AssignmentStats; occupancy?: Record<string, Record<number, number>> } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearDemoDialogOpen, setClearDemoDialogOpen] = useState(false);

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

  // Demo data management
  const {
    demoTeamsCount,
    hasDemoData,
    isGenerating,
    isClearing: isClearingDemo,
    generateDemoData,
    clearDemoData,
  } = useDemoData(eventId || '');

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

  // Clear stale preview when assignments change
  useEffect(() => {
    if (existingAssignments && existingAssignments.length > 0) {
      setPreviewResults(null);
    }
  }, [existingAssignments]);

  const validatedTeams = teamsData?.filter(t => t.validated) || [];
  const excludedTeams = teamsData?.filter(t => !t.validated) || [];
  const teamsWithPrefs = validatedTeams.filter(t => t.hasPreferences).length;
  const totalTeams = validatedTeams.length;
  const teamsWithoutPrefs = totalTeams - teamsWithPrefs;

  const hasAssignments = existingAssignments && existingAssignments.length > 0;

  // Group existing assignments by team (read-only)
  const groupedAssignments = useMemo<GroupedAssignment[]>(() => {
    if (!existingAssignments || existingAssignments.length === 0) return [];

    const map = new Map<string, GroupedAssignment>();

    for (const assignment of existingAssignments) {
      const team = assignment.team as any;
      const workshop = assignment.workshop as any;
      const timeSlot = assignment.time_slot as any;
      if (!team?.id) continue;

      if (!map.has(team.id)) {
        const teamData = validatedTeams.find(t => t.id === team.id);
        map.set(team.id, {
          teamId: team.id,
          teamName: team.name,
          participantCount: teamData?.participantCount || 1,
          slotA: null,
          slotB: null,
        });
      }

      const entry = map.get(team.id)!;
      const slotData = {
        workshopName: workshop?.name || '',
        slotNumber: timeSlot?.slot_number,
        preferenceMatched: assignment.preference_matched,
        assignmentType: assignment.assignment_type || 'algorithm',
      };

      if (assignment.assignment_slot === 'A') {
        entry.slotA = slotData;
      } else {
        entry.slotB = slotData;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [existingAssignments, validatedTeams]);

  // Mini-tabla de capacidad
  const capacityData = useMemo(() => {
    if (!workshops || !timeSlots) return null;

    const matrix: Record<string, Record<number, number>> = {};
    workshops.forEach(w => {
      matrix[w.id] = {};
      timeSlots.forEach(s => {
        matrix[w.id][s.slot_number] = 0;
      });
    });

    // Si hay preview con occupancy, usar esos datos
    if (previewResults?.occupancy) {
      const occ = previewResults.occupancy;
      workshops.forEach(w => {
        timeSlots.forEach(s => {
          matrix[w.id][s.slot_number] = occ[w.id]?.[s.slot_number] || 0;
        });
      });
      return matrix;
    }

    // Si no, calcular desde existingAssignments
    if (existingAssignments) {
      const teamParticipants = new Map<string, number>();
      validatedTeams.forEach(t => teamParticipants.set(t.id, t.participantCount));

      existingAssignments.forEach(a => {
        const team = a.team as any;
        const timeSlot = a.time_slot as any;
        if (!team?.id || !timeSlot?.slot_number) return;
        const participants = teamParticipants.get(team.id) || 1;
        if (matrix[a.workshop_id]?.[timeSlot.slot_number] !== undefined) {
          matrix[a.workshop_id][timeSlot.slot_number] += participants;
        }
      });
    }

    return matrix;
  }, [workshops, timeSlots, existingAssignments, previewResults, validatedTeams]);

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
    try {
      await clearAssignments();
      setClearDialogOpen(false);
      setPreviewResults(null);
    } catch (error) {
      // Error handled in hook via toast
    }
  };

  const handleClearDemo = async () => {
    try {
      await clearDemoData();
      setClearDemoDialogOpen(false);
      setPreviewResults(null);
    } catch (error) {
      // Error handled in hook via toast
    }
  };

  // CSV export (read-only data)
  const handleExportAssignmentsCSV = () => {
    if (groupedAssignments.length === 0) return;

    const headers = ['Equipo', 'Participantes', 'Taller A', 'Turno A', 'Preferencia A', 'Taller B', 'Turno B', 'Preferencia B', 'Tipo Asignación'];
    const rows = groupedAssignments.map(g => {
      const typeA = g.slotA?.assignmentType || '';
      const typeB = g.slotB?.assignmentType || '';
      const type = typeA === 'manual' || typeB === 'manual' ? 'manual' : typeA || typeB || '';
      return [
        g.teamName,
        String(g.participantCount),
        g.slotA?.workshopName || '',
        g.slotA ? `Turno ${g.slotA.slotNumber}` : '',
        g.slotA?.preferenceMatched != null ? `#${g.slotA.preferenceMatched}` : '',
        g.slotB?.workshopName || '',
        g.slotB ? `Turno ${g.slotB.slotNumber}` : '',
        g.slotB?.preferenceMatched != null ? `#${g.slotB.preferenceMatched}` : '',
        type,
      ];
    });

    const csvRows = [
      headers.join(','),
      ...rows.map(row =>
        row.map(val => {
          const strVal = String(val);
          if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
            return `"${strVal.replace(/"/g, '""')}"`;
          }
          return strVal;
        }).join(',')
      ),
    ];

    const blob = new Blob(['\ufeff' + csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asignaciones-talleres-${event?.name || 'evento'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    {
      label: `${excludedTeams.length} equipos excluidos por no estar validados`,
      ok: true,
      warning: excludedTeams.length > 0,
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
          <div className="flex items-center gap-2">
            {hasAssignments && (
              <>
                <Button variant="outline" onClick={handleExportAssignmentsCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setClearDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Asignaciones
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Current Status */}
        {hasAssignments && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Asignaciones existentes</AlertTitle>
            <AlertDescription className="text-green-700">
              Hay {groupedAssignments.length} equipos con asignaciones guardadas.
              Si ejecutas el algoritmo de nuevo, se reemplazarán las asignaciones actuales.
              Para editar asignaciones individuales, ve al{' '}
              <Link
                to={`/admin/events/${eventId}/workshops/schedule`}
                className="font-medium underline hover:text-green-900 inline-flex items-center gap-1"
              >
                Cuadrante de Talleres
                <ExternalLink className="h-3 w-3" />
              </Link>.
            </AlertDescription>
          </Alert>
        )}

        {/* Demo Data Section */}
        <Card className="border-dashed border-2 border-muted-foreground/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Datos de Demostración
              {hasDemoData && (
                <Badge variant="secondary" className="ml-2">
                  {demoTeamsCount} equipos DEMO
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Genera equipos ficticios con preferencias para probar el algoritmo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {!hasDemoData ? (
                <Button
                  variant="outline"
                  onClick={generateDemoData}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="mr-2 h-4 w-4" />
                      Generar 10 Equipos DEMO
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setClearDemoDialogOpen(true)}
                  disabled={isClearingDemo}
                >
                  {isClearingDemo ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Datos DEMO
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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

        {/* Mini Capacity Table */}
        {capacityData && workshops && workshops.length > 0 && timeSlots && timeSlots.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Capacidad por Taller</CardTitle>
              <CardDescription>Participantes asignados / capacidad máxima por turno</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b font-medium">Taller</th>
                      {timeSlots.map(s => (
                        <th key={s.id} className="text-center p-2 border-b font-medium">
                          Turno {s.slot_number}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workshops.map(w => (
                      <tr key={w.id} className="border-b">
                        <td className="p-2 font-medium">{w.name}</td>
                        {timeSlots.map(s => {
                          const current = capacityData[w.id]?.[s.slot_number] || 0;
                          const max = w.max_capacity;
                          const ratio = max > 0 ? current / max : 0;
                          const colorClass = ratio >= 0.9
                            ? 'text-red-700 bg-red-50'
                            : ratio >= 0.7
                              ? 'text-amber-700 bg-amber-50'
                              : 'text-green-700 bg-green-50';
                          return (
                            <td key={s.id} className={`text-center p-2 font-mono ${colorClass}`}>
                              {current}/{max}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

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
                Resultados (Vista Previa)
              </CardTitle>
              <CardDescription>
                Estos resultados no se han guardado todavía. Pulsa "Ejecutar Asignación" para guardarlos.
              </CardDescription>
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
                      const totalSlots = previewResults.stats.totalTeams * 2;
                      const percentage = totalSlots > 0 ? (count / totalSlots) * 100 : 0;
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
                <div className="max-h-96 overflow-y-auto">
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
                                  {result.preferenceMatchedA ? (
                                    <> • Pref #{result.preferenceMatchedA}</>
                                  ) : (
                                    <> • <span className="text-amber-600">Disponibilidad</span></>
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
                                  {result.preferenceMatchedB ? (
                                    <> • Pref #{result.preferenceMatchedB}</>
                                  ) : (
                                    <> • <span className="text-amber-600">Disponibilidad</span></>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-red-500">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.errors.length > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="destructive" className="text-xs cursor-help">
                                      {result.errors.length} error(es)
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <ul className="text-xs space-y-1">
                                      {result.errors.map((err, i) => (
                                        <li key={i}>• {err}</li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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

        {/* Saved Assignments (read-only) */}
        {hasAssignments && !previewResults && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asignaciones Guardadas</CardTitle>
              <CardDescription>
                {groupedAssignments.length} equipos asignados. Para editar, ve al{' '}
                <Link
                  to={`/admin/events/${eventId}/workshops/schedule`}
                  className="font-medium underline"
                >
                  Cuadrante de Talleres
                </Link>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipo</TableHead>
                      <TableHead className="text-center">Part.</TableHead>
                      <TableHead>Taller A</TableHead>
                      <TableHead>Taller B</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedAssignments.map((g) => (
                      <TableRow key={g.teamId}>
                        <TableCell className="font-medium">{g.teamName}</TableCell>
                        <TableCell className="text-center">{g.participantCount}</TableCell>
                        <TableCell>
                          {g.slotA ? (
                            <div className="text-sm">
                              <span>{g.slotA.workshopName}</span>
                              <div className="text-xs text-muted-foreground">
                                Turno {g.slotA.slotNumber}
                                {g.slotA.preferenceMatched != null && (
                                  <> • Pref #{g.slotA.preferenceMatched}</>
                                )}
                                {g.slotA.assignmentType === 'manual' && (
                                  <> • <span className="text-amber-600">Manual</span></>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {g.slotB ? (
                            <div className="text-sm">
                              <span>{g.slotB.workshopName}</span>
                              <div className="text-xs text-muted-foreground">
                                Turno {g.slotB.slotNumber}
                                {g.slotB.preferenceMatched != null && (
                                  <> • Pref #{g.slotB.preferenceMatched}</>
                                )}
                                {g.slotB.assignmentType === 'manual' && (
                                  <> • <span className="text-amber-600">Manual</span></>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {g.slotA && g.slotB ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">OK</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Parcial</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

        {/* Clear Demo Data Confirmation */}
        <ConfirmDialog
          open={clearDemoDialogOpen}
          onOpenChange={setClearDemoDialogOpen}
          title="¿Eliminar todos los datos DEMO?"
          description="Esta acción eliminará todos los equipos DEMO, sus registros, preferencias y asignaciones. Los datos reales no se verán afectados."
          confirmText="Eliminar DEMO"
          variant="danger"
          onConfirm={handleClearDemo}
          loading={isClearingDemo}
        />
      </div>
    </AdminLayout>
  );
}
