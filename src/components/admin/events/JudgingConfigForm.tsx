import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { JudgingEventConfig } from '@/types/database';

interface JudgingConfigFormProps {
  config: JudgingEventConfig | null;
  isLoading: boolean;
  onSave: (values: {
    total_rooms: number;
    teams_per_group: number;
    judges_per_group: number;
    sessions_per_turn: number;
  }) => Promise<unknown>;
  onUpdate: (values: {
    id: string;
    total_rooms: number;
    teams_per_group: number;
    judges_per_group: number;
    sessions_per_turn: number;
  }) => Promise<unknown>;
  isSaving: boolean;
  activeTurns: ('morning' | 'afternoon')[];
}

export function JudgingConfigForm({ config, isLoading, onSave, onUpdate, isSaving, activeTurns }: JudgingConfigFormProps) {
  const [totalRooms, setTotalRooms] = useState(5);
  const [teamsPerGroup, setTeamsPerGroup] = useState(6);
  const [judgesPerGroup, setJudgesPerGroup] = useState(6);
  const [sessionsPerTurn, setSessionsPerTurn] = useState(2);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (config) {
      setTotalRooms(config.total_rooms);
      setTeamsPerGroup(config.teams_per_group);
      setJudgesPerGroup(config.judges_per_group);
      setSessionsPerTurn(config.sessions_per_turn);
    }
  }, [config]);

  const handleSubmit = async () => {
    // F12 fix: validate inputs
    const safeRooms = Math.max(1, Math.min(20, Math.floor(totalRooms) || 5));
    const safeTeams = Math.max(4, Math.min(10, Math.floor(teamsPerGroup) || 6));
    const safeJudges = Math.max(3, Math.min(10, Math.floor(judgesPerGroup) || 6));
    const safeSessions = Math.max(1, Math.min(4, Math.floor(sessionsPerTurn) || 2));

    const values = {
      total_rooms: safeRooms,
      teams_per_group: safeTeams,
      judges_per_group: safeJudges,
      sessions_per_turn: safeSessions,
    };

    if (config) {
      await onUpdate({ id: config.id, ...values });
    } else {
      await onSave(values);
    }
  };

  const numberOfTurns = activeTurns.length || 1;
  const totalSessions = sessionsPerTurn * numberOfTurns;
  const totalPanels = totalRooms * totalSessions;
  const totalTeamSlots = totalPanels * teamsPerGroup;
  const totalJudgeSlots = totalPanels * judgesPerGroup;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Jurado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact summary when config exists and not expanded
  if (config && !expanded) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <span className="font-medium">Configuración:</span>
              <span>{totalRooms} aulas</span>
              <span className="text-muted-foreground">·</span>
              <span>{teamsPerGroup} eq/grupo</span>
              <span className="text-muted-foreground">·</span>
              <span>{judgesPerGroup} jueces/grupo</span>
              <span className="text-muted-foreground">·</span>
              <span>{sessionsPerTurn} sesiones/turno</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{totalPanels} paneles, {totalTeamSlots} slots eq, {totalJudgeSlots} slots jueces</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configuración de Jurado</CardTitle>
            <CardDescription>
              Parámetros para la distribución de jueces y equipos en la final regional.
            </CardDescription>
          </div>
          {config && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              <ChevronUp className="h-4 w-4 mr-1" />
              Colapsar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="total_rooms">Número de aulas</Label>
            <Input
              id="total_rooms"
              type="number"
              min={1}
              max={20}
              value={totalRooms}
              onChange={(e) => setTotalRooms(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teams_per_group">Equipos por grupo</Label>
            <Input
              id="teams_per_group"
              type="number"
              min={4}
              max={10}
              value={teamsPerGroup}
              onChange={(e) => setTeamsPerGroup(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="judges_per_group">Jueces por grupo</Label>
            <Input
              id="judges_per_group"
              type="number"
              min={3}
              max={10}
              value={judgesPerGroup}
              onChange={(e) => setJudgesPerGroup(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sessions_per_turn">Sesiones por turno</Label>
            <Input
              id="sessions_per_turn"
              type="number"
              min={1}
              max={4}
              value={sessionsPerTurn}
              onChange={(e) => setSessionsPerTurn(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-1">
          <p><strong>Resumen calculado:</strong></p>
          <p>
            {totalSessions} sesiones totales ({sessionsPerTurn} × {numberOfTurns} {numberOfTurns === 1
              ? `turno (${activeTurns[0] === 'morning' ? 'mañana' : 'tarde'})`
              : 'turnos (mañana + tarde)'
            })
          </p>
          <p>{totalPanels} paneles de jueces ({totalRooms} aulas × {totalSessions} sesiones)</p>
          <p>{totalTeamSlots} slots de equipos ({totalPanels} × {teamsPerGroup})</p>
          <p>{totalJudgeSlots} slots de jueces ({totalPanels} × {judgesPerGroup})</p>
        </div>

        <Button onClick={handleSubmit} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {config ? 'Guardar cambios' : 'Crear configuración'}
        </Button>
      </CardContent>
    </Card>
  );
}
