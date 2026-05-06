import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mail,
  ArrowLeft,
  Trash2,
  RefreshCw,
  UserMinus,
  UserPlus,
  UserPlus2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEventTeamImport, parseCsvRow, normalizeCategory, matchTeams, MatchResult, CsvTeamRow } from '@/hooks/useEventTeamImport';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Team, TeamTurn } from '@/types/database';
import { cn } from '@/lib/utils';
import { TeamCombobox } from './TeamCombobox';
import { AddManualTeamDialog } from './AddManualTeamDialog';

type Step = 'config' | 'upload' | 'preview' | 'confirming' | 'done';

interface EventTeamImportProps {
  eventId: string;
  turn: TeamTurn;
}

export function EventTeamImport({ eventId, turn }: EventTeamImportProps) {
  const { user } = useAuth();
  const {
    roster,
    isLoadingRoster,
    allTeams,
    isLoadingTeams,
    confirmImport,
    clearImport,
    toggleTeamActive,
  } = useEventTeamImport(eventId);

  const [step, setStep] = useState<Step>('config');
  const [files, setFiles] = useState<File[]>([]);
  const [csvRows, setCsvRows] = useState<CsvTeamRow[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [importOnlyMatched, setImportOnlyMatched] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  // ─── Config Step ─────────────────────────────────────────────
  const hasExistingImport = roster.length > 0;

  const handleStartUpload = () => setStep('upload');
  const handleReimport = () => {
    setFiles([]);
    setCsvRows([]);
    setMatches([]);
    setStep('upload');
  };

  // ─── Upload Step: Parse CSV files ────────────────────────────
  const handleFilesSelected = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter((f) => f.name.endsWith('.csv'));
    if (fileArray.length === 0) {
      toast.error('Por favor selecciona archivos CSV');
      return;
    }

    // F10: Deduplicate by file name to avoid double-drop
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newUnique = fileArray.filter((f) => !existingNames.has(f.name));
      return [...prev, ...newUnique];
    });

    // Parse using Promise.all instead of counter
    const parseFile = (file: File): Promise<CsvTeamRow[]> =>
      new Promise((resolve) => {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            const headers = result.meta.fields || [];
            const hasName = headers.some((h) =>
              ['Name', 'name', 'team'].includes(h),
            );
            const hasDivision = headers.some((h) =>
              ['Division', 'division'].includes(h),
            );

            if (!hasName || !hasDivision) {
              toast.error(
                `"${file.name}" no tiene las columnas requeridas (Name/name y Division/division)`,
              );
              resolve([]);
              return;
            }

            const rows = result.data.map(parseCsvRow).filter((r) => r.name.trim() !== '');
            resolve(rows);
          },
        });
      });

    Promise.all(fileArray.map(parseFile)).then((allParsed) => {
      const allRows = allParsed.flat();
      setCsvRows((prev) => [...prev, ...allRows]);

      const breakdown: Record<string, number> = {};
      for (const row of allRows) {
        const cat = normalizeCategory(row.division) || 'desconocida';
        breakdown[cat] = (breakdown[cat] || 0) + 1;
      }
      setCategoryBreakdown((prev) => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(breakdown)) {
          merged[k] = (merged[k] || 0) + v;
        }
        return merged;
      });
    });
  }, []);

  const handleContinueToPreview = async () => {
    if (csvRows.length === 0) {
      toast.error('No hay equipos en los CSV cargados');
      return;
    }

    setIsMatching(true);
    try {
      const results = await matchTeams(csvRows, allTeams, turn);
      setMatches(results);
      setStep('preview');
    } catch (err) {
      toast.error('Error en el matching: ' + (err as Error).message);
    } finally {
      setIsMatching(false);
    }
  };

  // ─── Preview Step: Manual override ───────────────────────────
  const handleManualMatch = (index: number, team: Team) => {
    setMatches((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        matchedTeam: team,
        matchType: 'manual',
        confidence: 1.0,
      };
      return next;
    });
  };

  const matchedCount = matches.filter((m) => m.matchedTeam).length;
  const unmatchedCount = matches.filter((m) => !m.matchedTeam).length;
  const canConfirm = importOnlyMatched ? matchedCount > 0 : unmatchedCount === 0;

  // ─── Confirm Import ──────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!user?.id) return;
    setStep('confirming');

    try {
      const count = await confirmImport.mutateAsync({
        matches: importOnlyMatched ? matches.filter((m) => m.matchedTeam) : matches,
        turn,
        userId: user.id,
      });
      toast.success(`${count} equipos importados correctamente`);
      setStep('done');
    } catch (err) {
      toast.error('Error al importar: ' + (err as Error).message);
      setStep('preview');
    }
  };

  // ─── Clear Import ────────────────────────────────────────────
  const handleClearImport = async () => {
    try {
      await clearImport.mutateAsync();
      toast.success('Importación limpiada');
      setStep('config');
      setFiles([]);
      setCsvRows([]);
      setMatches([]);
      setCategoryBreakdown({});
    } catch (err) {
      toast.error('Error al limpiar: ' + (err as Error).message);
    }
  };

  // ─── Reset to config ─────────────────────────────────────────
  const handleBackToConfig = () => {
    setStep('config');
    setFiles([]);
    setCsvRows([]);
    setMatches([]);
    setCategoryBreakdown({});
  };

  if (isLoadingRoster || isLoadingTeams) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Config Step ──────────────────────────────────── */}
      {step === 'config' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuración de importación</CardTitle>
              <CardDescription>
                Importa equipos desde CSV de Technovation Global para vincularlos a este evento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Turno seleccionado: <Badge variant="outline">{turn === 'morning' ? 'Mañana' : 'Tarde'}</Badge>
                <span className="ml-1 text-xs">(se configura en la pestaña Info)</span>
              </p>

              {!hasExistingImport && (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleStartUpload}>
                    <Upload className="mr-2 h-4 w-4" />
                    Subir CSVs
                  </Button>
                  <Button variant="outline" onClick={() => setManualOpen(true)}>
                    <UserPlus2 className="mr-2 h-4 w-4" />
                    Añadir equipo manual
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {hasExistingImport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Equipos importados</CardTitle>
                <CardDescription>
                  {roster.length} equipos vinculados a este evento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary by category */}
                <div className="flex gap-3">
                  {(['senior', 'junior', 'beginner'] as const).map((cat) => {
                    const count = roster.filter((r) => r.category === cat).length;
                    if (count === 0) return null;
                    return (
                      <Badge key={cat} variant="secondary">
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}: {count}
                      </Badge>
                    );
                  })}
                </div>

                {/* Existing teams table */}
                <div className="max-h-80 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roster.map((r) => (
                        <TableRow key={r.id} className={!r.is_active ? 'bg-red-50 opacity-60' : ''}>
                          <TableCell className={`font-mono font-bold ${!r.is_active ? 'line-through text-red-400' : ''}`}>{r.team_code}</TableCell>
                          <TableCell className={!r.is_active ? 'line-through text-red-400' : ''}>{r.team?.name ?? r.csv_team_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.category}</Badge>
                          </TableCell>
                          <TableCell>{r.turn === 'morning' ? 'Mañana' : 'Tarde'}</TableCell>
                          <TableCell>
                            <MatchBadge type={r.match_type} />
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => toggleTeamActive.mutate({ id: r.id, is_active: !r.is_active })}
                                  disabled={toggleTeamActive.isPending}
                                  className={`p-1 rounded transition-colors ${r.is_active ? 'hover:bg-red-100 text-muted-foreground hover:text-destructive' : 'hover:bg-green-100 text-red-400 hover:text-green-700'}`}
                                >
                                  {r.is_active
                                    ? <UserMinus className="h-3.5 w-3.5" />
                                    : <UserPlus className="h-3.5 w-3.5" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{r.is_active ? 'Dar de baja' : 'Reactivar'}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleReimport}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-importar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setManualOpen(true)}
                    disabled={confirmImport.isPending || clearImport.isPending}
                  >
                    <UserPlus2 className="mr-2 h-4 w-4" />
                    Añadir equipo manual
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpiar todo
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar todos los equipos importados?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminarán los {roster.length} equipos vinculados a este evento. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearImport}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Upload Step ──────────────────────────────────── */}
      {step === 'upload' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subir CSVs de Technovation Global</CardTitle>
              <CardDescription>
                Arrastra o selecciona los archivos CSV. Se esperan columnas: Name, Division, Student emails, Mentor emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length > 0) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv';
                  input.multiple = true;
                  input.onchange = () => {
                    if (input.files && input.files.length > 0) {
                      handleFilesSelected(input.files);
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arrastra archivos CSV o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Múltiples archivos permitidos (.csv)
                </p>
              </div>

              {/* Files list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Archivos cargados:</p>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>{f.name}</span>
                      <span className="text-muted-foreground">
                        ({(f.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Breakdown */}
              {csvRows.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">
                    {csvRows.length} equipos detectados
                  </p>
                  <div className="flex gap-3">
                    {Object.entries(categoryBreakdown).map(([cat, count]) => (
                      <Badge key={cat} variant="secondary">
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBackToConfig}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <Button
              onClick={handleContinueToPreview}
              disabled={csvRows.length === 0 || isMatching}
            >
              {isMatching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando matches...
                </>
              ) : (
                'Continuar a Preview'
              )}
            </Button>
          </div>
        </>
      )}

      {/* ── Preview Step ─────────────────────────────────── */}
      {step === 'preview' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview de matching</CardTitle>
              <CardDescription>
                {matchedCount} de {matches.length} equipos matched — {unmatchedCount} sin match
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Código</TableHead>
                      <TableHead>CSV Team Name</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Equipo DB</TableHead>
                      <TableHead className="w-48">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((m, idx) => (
                      <TableRow
                        key={idx}
                        className={cn(
                          !m.matchedTeam && 'bg-red-50 dark:bg-red-950/20',
                          m.matchType === 'fuzzy' && 'bg-yellow-50 dark:bg-yellow-950/20',
                          m.matchType === 'email' && 'bg-blue-50 dark:bg-blue-950/20',
                          (m.matchType === 'exact' || m.matchType === 'tg_id') &&
                            'bg-green-50 dark:bg-green-950/20',
                        )}
                      >
                        <TableCell className="font-mono font-bold">{m.teamCode}</TableCell>
                        <TableCell>{m.csvName}</TableCell>
                        <TableCell>
                          <Badge variant={m.categoryUnknown ? 'destructive' : 'outline'}>
                            {m.categoryUnknown ? `${m.category} (?)` : m.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <MatchBadge type={m.matchType} confidence={m.confidence} />
                        </TableCell>
                        <TableCell>{m.matchedTeam?.name ?? '—'}</TableCell>
                        <TableCell>
                          {(!m.matchedTeam || m.matchType === 'fuzzy') && (
                            <TeamCombobox
                              teams={allTeams}
                              value={m.matchedTeam?.id ?? null}
                              onSelect={(team) => handleManualMatch(idx, team)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Stats footer */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">
                    <CheckCircle2 className="inline h-4 w-4 mr-1" />
                    {matches.filter((m) => m.matchType === 'exact' || m.matchType === 'tg_id').length} exact
                  </span>
                  <span className="text-yellow-600">
                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                    {matches.filter((m) => m.matchType === 'fuzzy').length} fuzzy
                  </span>
                  <span className="text-blue-600">
                    <Mail className="inline h-4 w-4 mr-1" />
                    {matches.filter((m) => m.matchType === 'email').length} email
                  </span>
                  <span className="text-red-600">
                    <XCircle className="inline h-4 w-4 mr-1" />
                    {unmatchedCount} sin match
                  </span>
                </div>
              </div>

              {unmatchedCount > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <Checkbox
                    id="import-only-matched"
                    checked={importOnlyMatched}
                    onCheckedChange={(v) => setImportOnlyMatched(!!v)}
                  />
                  <label htmlFor="import-only-matched" className="text-sm">
                    Importar solo los matched, ignorar los sin match
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('upload')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <Button onClick={handleConfirmImport} disabled={!canConfirm}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Confirmar Importación ({importOnlyMatched ? matchedCount : matches.length} equipos)
            </Button>
          </div>
        </>
      )}

      {/* ── Confirming Step ──────────────────────────────── */}
      {step === 'confirming' && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <span className="text-lg">Importando equipos...</span>
          </CardContent>
        </Card>
      )}

      {/* ── Done Step ────────────────────────────────────── */}
      {step === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Importación completada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToConfig}>
              Volver a configuración
            </Button>
          </CardContent>
        </Card>
      )}

      <AddManualTeamDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        eventId={eventId}
        turn={turn}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function MatchBadge({ type, confidence }: { type: string | null; confidence?: number }) {
  if (!type) {
    return <Badge variant="destructive">Sin match</Badge>;
  }

  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    tg_id: { label: 'TG ID', variant: 'default' },
    exact: { label: 'Exacto', variant: 'default' },
    fuzzy: { label: `Fuzzy${confidence ? ` ${Math.round(confidence * 100)}%` : ''}`, variant: 'secondary' },
    email: { label: 'Email', variant: 'secondary' },
    manual: { label: 'Manual', variant: 'outline' },
  };

  const c = config[type] || { label: type, variant: 'outline' as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

