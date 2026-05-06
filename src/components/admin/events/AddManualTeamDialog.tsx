import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Loader2, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEventTeamImport, generateTeamCode } from '@/hooks/useEventTeamImport';
import { TeamCombobox } from './TeamCombobox';
import { JudgingPanel, Team, TeamCategory, TeamTurn } from '@/types/database';

interface AddManualTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  turn: TeamTurn;
  /** When true, the optional panel assignment section starts expanded. */
  defaultAssignToPanel?: boolean;
}

const TEAM_CODE_REGEX = /^[A-Z][A-Z]\d+$/;

export function AddManualTeamDialog({
  open,
  onOpenChange,
  eventId,
  turn: defaultTurn,
  defaultAssignToPanel = false,
}: AddManualTeamDialogProps) {
  const { user } = useAuth();
  const { roster, allTeams, addManualTeam } = useEventTeamImport(eventId);

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [category, setCategory] = useState<TeamCategory>('beginner');
  const [turn, setTurn] = useState<TeamTurn>(defaultTurn);
  const [teamCodeOverride, setTeamCodeOverride] = useState<string | null>(null);
  const [assignToPanel, setAssignToPanel] = useState(defaultAssignToPanel);
  const [panelId, setPanelId] = useState<string>('');
  const [subsession, setSubsession] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Detect mode: insert vs reactivate (existing inactive row for this team)
  const existingInactive = useMemo(() => {
    if (!selectedTeam) return null;
    return (
      roster.find((r) => r.team_id === selectedTeam.id && !r.is_active) ?? null
    );
  }, [selectedTeam, roster]);

  const mode: 'insert' | 'reactivate' = existingInactive ? 'reactivate' : 'insert';

  const defaultTeamCode = useMemo(() => {
    if (!selectedTeam) return '';
    const re = /^[A-Z][A-Z](\d+)$/;
    const max = roster
      .filter((r) => r.category === category && r.turn === turn)
      .reduce((acc, r) => {
        const m = r.team_code.match(re);
        return m ? Math.max(acc, Number(m[1])) : acc;
      }, 0);
    return generateTeamCode(category, turn, max);
  }, [selectedTeam, category, turn, roster]);

  const teamCode = teamCodeOverride ?? defaultTeamCode;

  // Fetch panels for this event filtered by selected turn
  const panelsQuery = useQuery({
    queryKey: ['judging-panels-list', eventId, turn],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judging_panels')
        .select('*')
        .eq('event_id', eventId)
        .eq('turn', turn)
        .order('session_number')
        .order('room_number');
      if (error) throw error;
      return data as JudgingPanel[];
    },
    enabled: open && !!eventId,
  });

  const panels = useMemo(
    () => panelsQuery.data ?? [],
    [panelsQuery.data],
  );
  const hasPanelsForTurn = panels.length > 0;

  // Pre-fill category when a team is picked, and reset team_code override on
  // selection / category / turn changes so the precomputed code shows fresh.
  useEffect(() => {
    if (!selectedTeam) return;
    const teamCat = (selectedTeam.category as TeamCategory | null) ?? null;
    if (teamCat) setCategory(teamCat);
    setTeamCodeOverride(null);
  }, [selectedTeam]);

  useEffect(() => {
    setTeamCodeOverride(null);
  }, [category, turn]);

  // If panel list changes (e.g. turn switch) and current panelId no longer applies, clear it.
  useEffect(() => {
    if (panelId && !panels.find((p) => p.id === panelId)) {
      setPanelId('');
    }
  }, [panels, panelId]);

  // Reset everything on close
  useEffect(() => {
    if (!open) {
      setSelectedTeam(null);
      setCategory('beginner');
      setTurn(defaultTurn);
      setTeamCodeOverride(null);
      setAssignToPanel(defaultAssignToPanel);
      setPanelId('');
      setSubsession(1);
      setSubmitting(false);
    }
  }, [open, defaultTurn, defaultAssignToPanel]);

  // Sync turn state when defaultTurn prop changes while the dialog stays open.
  useEffect(() => {
    if (open) setTurn(defaultTurn);
  }, [defaultTurn, open]);

  const teamCodeValid = TEAM_CODE_REGEX.test(teamCode);
  const teamCodeCollides = useMemo(() => {
    if (!teamCode) return false;
    return roster.some(
      (r) =>
        r.team_code === teamCode &&
        r.is_active &&
        r.team_id !== selectedTeam?.id,
    );
  }, [teamCode, roster, selectedTeam]);

  const excludeActiveIds = useMemo(
    () => roster.filter((r) => r.is_active).map((r) => r.team_id),
    [roster],
  );

  const canSubmit =
    !!selectedTeam &&
    !!user?.id &&
    teamCodeValid &&
    !teamCodeCollides &&
    (!assignToPanel || (!!panelId && hasPanelsForTurn));

  const handleSubmit = async () => {
    if (!canSubmit || !selectedTeam || !user?.id) return;
    setSubmitting(true);
    try {
      const result = await addManualTeam.mutateAsync({
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        category,
        turn,
        teamCode,
        mode,
        userId: user.id,
        panel:
          assignToPanel && panelId
            ? { panelId, subsession }
            : undefined,
      });
      toast.success(
        mode === 'reactivate'
          ? `Equipo reactivado con código ${result.teamCode}`
          : `Equipo añadido con código ${result.teamCode}`,
      );
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error desconocido al añadir el equipo';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir equipo manual</DialogTitle>
          <DialogDescription>
            Añade un único equipo a este evento sin re-importar el CSV. Útil para
            inscripciones de última hora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Team picker */}
          <div className="space-y-1.5">
            <Label>Equipo</Label>
            <TeamCombobox
              teams={allTeams}
              value={selectedTeam?.id ?? null}
              onSelect={setSelectedTeam}
              excludeIds={excludeActiveIds}
              placeholder="Buscar equipo..."
              buttonClassName="w-full text-sm"
            />
            {existingInactive && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 p-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Este equipo ya estuvo en el evento (código{' '}
                  <code className="font-mono">{existingInactive.team_code}</code>) pero
                  está desactivado. Al guardar se reactivará con el nuevo código.
                </span>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as TeamCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
              </SelectContent>
            </Select>
            {selectedTeam?.category && selectedTeam.category !== category && (
              <p className="text-xs text-muted-foreground">
                Equipo registrado como <strong>{selectedTeam.category}</strong> en su
                perfil global.
              </p>
            )}
          </div>

          {/* Turn */}
          <div className="space-y-1.5">
            <Label>Turno</Label>
            <Select value={turn} onValueChange={(v) => setTurn(v as TeamTurn)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Mañana</SelectItem>
                <SelectItem value="afternoon">Tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* team_code */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-team-code">Código de equipo</Label>
            <Input
              id="manual-team-code"
              value={teamCode}
              onChange={(e) => setTeamCodeOverride(e.target.value.toUpperCase())}
              placeholder="BT66"
              className="font-mono"
              disabled={!selectedTeam}
            />
            {teamCode && !teamCodeValid && (
              <p className="text-xs text-destructive">
                Formato esperado: 2 letras + dígitos (ej. BT66).
              </p>
            )}
            {teamCodeCollides && (
              <p className="text-xs text-destructive">
                Ya existe <code className="font-mono">{teamCode}</code> en este evento.
              </p>
            )}
          </div>

          {/* Panel assignment (collapsible, default closed) */}
          <Collapsible open={assignToPanel} onOpenChange={setAssignToPanel}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between p-2 h-auto"
              >
                <span className="text-sm">Asignar a un panel (opcional)</span>
                {assignToPanel ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {!hasPanelsForTurn ? (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
                  No hay paneles para este turno. El equipo se añadirá solo al roster.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Panel</Label>
                    <Select value={panelId} onValueChange={setPanelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un panel" />
                      </SelectTrigger>
                      <SelectContent>
                        {panels.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.panel_code} (S{p.session_number} · Sala {p.room_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subsesión</Label>
                    <Select
                      value={String(subsession)}
                      onValueChange={(v) => setSubsession(Number(v) as 1 | 2)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Subsesión 1</SelectItem>
                        <SelectItem value="2">Subsesión 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : mode === 'reactivate' ? (
              'Reactivar equipo'
            ) : (
              'Añadir equipo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
