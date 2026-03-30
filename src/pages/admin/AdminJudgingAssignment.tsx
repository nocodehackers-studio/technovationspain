import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useJudgingAssignment, PanelAssignmentResult, JudgingAssignmentStats, StructuredWarning } from '@/hooks/useJudgingAssignment';
import { useJudgingConfig } from '@/hooks/useJudgingConfig';
import { useEventJudges } from '@/hooks/useEventJudges';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Shuffle,
  Play,
  Check,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Loader2,
  Download,
  ExternalLink,
  X,
  XCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminJudgingAssignment() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [previewResults, setPreviewResults] = useState<{
    results: PanelAssignmentResult[];
    stats: JudgingAssignmentStats;
  } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearConfirmStep, setClearConfirmStep] = useState(0);

  const { config, isLoading: configLoading } = useJudgingConfig(eventId);
  const { readyJudges, pendingJudges, isLoading: judgesLoading } = useEventJudges(eventId);
  const {
    assignments,
    isLoading: assignmentsLoading,
    runAssignment,
    isRunning,
    clearAssignments,
    isClearing,
  } = useJudgingAssignment(eventId);

  // Count teams and turns from event_teams
  const { data: eventTeamsInfo } = useQuery({
    queryKey: ['judging-event-teams-info', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_teams')
        .select('team_id, turn')
        .eq('event_id', eventId!);

      if (error) throw error;
      const turns = [...new Set((data || []).map(d => d.turn))];
      return { count: data?.length || 0, numberOfTurns: turns.length || 1 };
    },
    enabled: !!eventId,
  });
  const teamCount = eventTeamsInfo?.count ?? 0;
  const numberOfTurns = eventTeamsInfo?.numberOfTurns ?? 1;

  const hasConfig = !!config;
  const hasTeams = teamCount > 0;
  const hasJudges = readyJudges.length > 0;
  const canRunDryRun = hasConfig && hasTeams && hasJudges;
  const hasExistingAssignments = assignments.length > 0;

  const handleDryRun = async () => {
    try {
      const result = await runAssignment({ dryRun: true });
      setPreviewResults({ results: result.results, stats: result.stats });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleConfirm = async () => {
    try {
      await runAssignment({ dryRun: false });
      setPreviewResults(null);
      navigate(`/admin/events/${eventId}/judging/schedule`);
    } catch (error) {
      // Error handled by hook — toast shown
      console.error('Error al guardar asignaciones:', error);
    }
  };

  const handleClear = async () => {
    try {
      await clearAssignments();
      setClearDialogOpen(false);
      setClearConfirmStep(0);
    } catch (error) {
      // Error handled by hook
    }
  };

  const exportCSV = () => {
    if (assignments.length === 0) return;

    const rows: string[][] = [
      ['Panel', 'Sesión', 'Aula', 'Turno', 'Juez', 'Email Juez', 'Equipo', 'Código Equipo', 'Categoría', 'Subsesión'],
    ];

    for (const panel of assignments) {
      for (const judge of panel.judging_panel_judges || []) {
        if (!judge.is_active) continue;
        const profile = judge.profiles;
        rows.push([
          panel.panel_code,
          String(panel.session_number),
          String(panel.room_number),
          panel.turn === 'morning' ? 'Mañana' : 'Tarde',
          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          profile?.email || '',
          '', '', '', '',
        ]);
      }
      for (const team of panel.judging_panel_teams || []) {
        if (!team.is_active) continue;
        const t = team.teams;
        rows.push([
          panel.panel_code,
          String(panel.session_number),
          String(panel.room_number),
          panel.turn === 'morning' ? 'Mañana' : 'Tarde',
          '', '',
          t?.name || '',
          team.team_code,
          t?.category || '',
          String(team.subsession),
        ]);
      }
    }

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asignacion-jueces-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atrás
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Asignación de Jueces</h1>
            <p className="text-muted-foreground">
              Ejecuta el algoritmo de matching jueces-equipos.
            </p>
          </div>
        </div>

        {/* Pre-validation Card */}
        <Card>
          <CardHeader>
            <CardTitle>Pre-validación</CardTitle>
            <CardDescription>Requisitos para ejecutar el algoritmo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              {hasConfig ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              <span className={!hasConfig ? 'text-red-600' : ''}>
                Configuración de judging {hasConfig ? 'creada' : '— falta crear'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasTeams ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              <span className={!hasTeams ? 'text-red-600' : ''}>
                Equipos registrados y validados: {teamCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasJudges ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              <span className={!hasJudges ? 'text-red-600' : ''}>
                Jueces con onboarding completo: {readyJudges.length}
                {pendingJudges.length > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({pendingJudges.length} pendientes)
                  </span>
                )}
              </span>
            </div>
            {config && (
              <div className="flex items-center gap-2">
                {readyJudges.length >= config.total_rooms * config.sessions_per_turn * numberOfTurns * config.judges_per_group ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <span>
                  Ratio jueces/paneles: {readyJudges.length}/
                  {config.total_rooms * config.sessions_per_turn * numberOfTurns * config.judges_per_group} necesarios
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleDryRun}
                disabled={!canRunDryRun || isRunning}
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Vista previa (Dry Run)
              </Button>
              {!canRunDryRun && (
                <p className="text-sm text-muted-foreground self-center">
                  Completa los requisitos para ejecutar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview Results */}
        {previewResults && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5" />
                Vista previa del algoritmo
              </CardTitle>
              <CardDescription>
                Revisa los resultados antes de confirmar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{previewResults.stats.totalPanels}</div>
                  <div className="text-xs text-muted-foreground">Paneles</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{previewResults.stats.assignedTeams}/{previewResults.stats.totalTeams}</div>
                  <div className="text-xs text-muted-foreground">Equipos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{previewResults.stats.assignedJudges}/{previewResults.stats.totalJudges}</div>
                  <div className="text-xs text-muted-foreground">Jueces</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{previewResults.stats.unassignedTeams}</div>
                  <div className="text-xs text-muted-foreground">Equipos sin asignar</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{previewResults.stats.unassignedJudges}</div>
                  <div className="text-xs text-muted-foreground">Jueces sin asignar</div>
                </div>
              </div>

              {/* Category distribution */}
              <div>
                <h4 className="text-sm font-medium mb-2">Por categoría</h4>
                <div className="flex gap-3">
                  {previewResults.stats.teamsByCategory.map(tc => (
                    <Badge key={tc.category} variant="outline">
                      {tc.category}: {tc.count}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Judge preferences */}
              <div>
                <h4 className="text-sm font-medium mb-2">Preferencia de jueces</h4>
                <div className="flex gap-3">
                  {previewResults.stats.judgesByPreference.map(jp => (
                    <Badge key={jp.preference} variant="outline">
                      {jp.preference === 'morning' ? 'Mañana' : jp.preference === 'afternoon' ? 'Tarde' : 'Sin preferencia'}: {jp.count}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Structured Warnings */}
              {previewResults.stats.structuredWarnings.length > 0 && (
                <div className="space-y-3">
                  {previewResults.stats.structuredWarnings.map((w, i) => {
                    const isError = w.severity === 'error';
                    const isWarning = w.severity === 'warning';
                    return (
                      <Alert
                        key={i}
                        variant={isError ? 'destructive' : 'default'}
                        className={
                          isWarning
                            ? 'border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600'
                            : !isError
                            ? 'bg-muted/50 border-muted'
                            : undefined
                        }
                      >
                        {isError ? (
                          <XCircle className="h-4 w-4" />
                        ) : isWarning ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Info className="h-4 w-4" />
                        )}
                        <AlertTitle>{w.message}</AlertTitle>
                        <AlertDescription>
                          {w.suggestion && (
                            <p className="text-sm mt-1 opacity-80">{w.suggestion}</p>
                          )}
                          {w.panels && w.panels.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer hover:underline">
                                Ver {w.panels.length} {w.panels.length === 1 ? 'panel afectado' : 'paneles afectados'}
                              </summary>
                              <p className="text-xs mt-1 pl-2">{w.panels.join(', ')}</p>
                            </details>
                          )}
                        </AlertDescription>
                      </Alert>
                    );
                  })}
                </div>
              )}

              {/* Panel Summary Table */}
              <div>
                <h4 className="text-sm font-medium mb-2">Paneles</h4>
                <div className="max-h-96 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Panel</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead>Jueces</TableHead>
                        <TableHead>Sub 1</TableHead>
                        <TableHead>Sub 2</TableHead>
                        <TableHead>Avisos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResults.results.map(panel => {
                        const panelCategory = panel.teamsSubsession1[0]?.category || panel.teamsSubsession2[0]?.category || '—';
                        return (
                          <TableRow key={panel.panelCode}>
                            <TableCell className="font-medium">{panel.panelCode}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">{panelCategory}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {panel.turn === 'morning' ? 'Mañana' : 'Tarde'}
                              </Badge>
                            </TableCell>
                            <TableCell>{panel.judges.length}</TableCell>
                            <TableCell>{panel.teamsSubsession1.length}</TableCell>
                            <TableCell>{panel.teamsSubsession2.length}</TableCell>
                            <TableCell>
                              {panel.warnings.length > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {panel.warnings.length}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pending Teams */}
              {previewResults.stats.pendingTeams.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-amber-700">
                    Equipos pendientes de asignar ({previewResults.stats.pendingTeams.length})
                  </h4>
                  <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
                    <p className="text-xs text-amber-700 mb-3">
                      Estos equipos no caben en los paneles actuales. Tras confirmar, podrás moverlos manualmente desde la escaleta.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewResults.stats.pendingTeams.map(team => (
                        <Badge key={team.id} variant="outline" className="border-amber-300 text-amber-800">
                          {team.code} — {team.name} ({team.category})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Blocked Judges */}
              {previewResults.stats.blockedJudges.length > 0 && (
                <div>
                  <details>
                    <summary className="text-sm font-medium cursor-pointer hover:underline">
                      Jueces bloqueados por conflicto ({[...new Set(previewResults.stats.blockedJudges.map(b => b.judge))].length})
                    </summary>
                    <div className="mt-2 border rounded-lg overflow-auto max-h-60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Juez</TableHead>
                            <TableHead>Panel</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewResults.stats.blockedJudges.map((b, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{b.judge}</TableCell>
                              <TableCell className="text-sm">{b.panel}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={b.reason === 'hub' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'}>
                                  {b.reason === 'hub' ? 'Mismo hub' : 'Incompatibilidad'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={handleConfirm} disabled={isRunning}>
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Confirmar y Guardar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPreviewResults(null)}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Assignments */}
        {hasExistingAssignments && !previewResults && (
          <Card>
            <CardHeader>
              <CardTitle>Asignaciones Guardadas</CardTitle>
              <CardDescription>
                {config?.algorithm_run_at && (
                  <>
                    Última ejecución: {new Date(config.algorithm_run_at).toLocaleString('es-ES')}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold">{assignments.length}</div>
                  <div className="text-xs text-muted-foreground">Paneles</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {assignments.reduce((sum, p) =>
                      sum + (p.judging_panel_judges?.filter(j => j.is_active).length || 0), 0
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Jueces activos</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {assignments.reduce((sum, p) =>
                      sum + (p.judging_panel_teams?.filter(t => t.is_active).length || 0), 0
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Equipos</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleDryRun} disabled={isRunning}>
                  <Shuffle className="h-4 w-4 mr-2" />
                  Re-ejecutar Algoritmo
                </Button>
                <Link to={`/admin/events/${eventId}/judging/schedule`}>
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Escaleta Completa
                  </Button>
                </Link>
                <Button variant="outline" onClick={exportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { setClearDialogOpen(true); setClearConfirmStep(0); }}
                  disabled={isClearing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar Todo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clear confirmation dialog (double confirmation) */}
        <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {clearConfirmStep === 0
                  ? 'Limpiar todas las asignaciones'
                  : 'Confirmar eliminación'}
              </DialogTitle>
              <DialogDescription>
                {clearConfirmStep === 0
                  ? 'Esta acción eliminará TODAS las asignaciones de jueces y equipos. Los datos de configuración se mantendrán.'
                  : '¿Estás absolutamente seguro? Esta acción no se puede deshacer.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                Cancelar
              </Button>
              {clearConfirmStep === 0 ? (
                <Button variant="destructive" onClick={() => setClearConfirmStep(1)}>
                  Continuar
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleClear}
                  disabled={isClearing}
                >
                  {isClearing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Sí, eliminar todo
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
