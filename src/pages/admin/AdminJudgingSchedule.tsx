import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useJudgingAssignment } from '@/hooks/useJudgingAssignment';
import { useJudgingConfig } from '@/hooks/useJudgingConfig';
import { useEventJudges } from '@/hooks/useEventJudges';
import { useAuth } from '@/hooks/useAuth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Download,
  UserMinus,
  UserPlus,
  ArrowRightLeft,
  Calendar,
  Users,
  Gavel,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

type TurnFilter = 'all' | 'morning' | 'afternoon';

export default function AdminJudgingSchedule() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [turnFilter, setTurnFilter] = useState<TurnFilter>('all');
  const [activeView, setActiveView] = useState('sessions');

  // Drag & drop state
  const [dragTeam, setDragTeam] = useState<{ teamId: string; teamName: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ panelId: string; subsession: number } | null>(null);

  // Deactivate judge dialog
  const [deactivateDialog, setDeactivateDialog] = useState<{
    open: boolean;
    panelJudgeId: string;
    judgeName: string;
  }>({ open: false, panelJudgeId: '', judgeName: '' });
  const [deactivateReason, setDeactivateReason] = useState('');

  // Add judge dialog
  const [addJudgeDialog, setAddJudgeDialog] = useState<{
    open: boolean;
    panelId: string;
    panelCode: string;
  }>({ open: false, panelId: '', panelCode: '' });
  const [selectedJudgeId, setSelectedJudgeId] = useState('');

  // Move team dialog
  const [moveTeamDialog, setMoveTeamDialog] = useState<{
    open: boolean;
    teamId: string;
    teamName: string;
  }>({ open: false, teamId: '', teamName: '' });
  const [targetPanelId, setTargetPanelId] = useState('');
  const [targetSubsession, setTargetSubsession] = useState<'1' | '2'>('1');

  const { config } = useJudgingConfig(eventId);
  const { readyJudges } = useEventJudges(eventId);
  const {
    assignments,
    isLoading,
    deactivateJudgeFromPanel,
    isDeactivating,
    addJudgeToPanel,
    isAddingJudge,
    moveTeam,
    isMovingTeam,
  } = useJudgingAssignment(eventId);

  // Filtered assignments
  const filteredPanels = assignments.filter(p =>
    turnFilter === 'all' ? true : p.turn === turnFilter
  );

  // Get all assigned judge IDs to show unassigned in add dialog
  const assignedJudgeIds = new Set(
    assignments.flatMap(p =>
      (p.judging_panel_judges || [])
        .filter(j => j.is_active)
        .map(j => j.judge_id)
    )
  );
  const unassignedJudges = readyJudges.filter(j => !assignedJudgeIds.has(j.id));

  // Pending teams: in event_teams but not assigned to any panel
  const assignedTeamIds = new Set(
    assignments.flatMap(p =>
      (p.judging_panel_teams || [])
        .filter(t => t.is_active)
        .map(t => t.team_id)
    )
  );
  const { data: allEventTeams = [] } = useQuery({
    queryKey: ['event-teams-for-schedule', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_teams')
        .select('team_id, team_code, category, turn, teams:team_id (id, name)')
        .eq('event_id', eventId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });
  const pendingTeams = allEventTeams.filter(et => !assignedTeamIds.has(et.team_id));

  // Build flat lists for "By Teams" and "By Judges" views
  const allTeamRows = assignments.flatMap(p =>
    (p.judging_panel_teams || []).map(t => ({
      teamId: t.team_id,
      teamName: t.teams?.name || '',
      teamCode: t.team_code,
      category: t.teams?.category || '',
      hubId: t.teams?.hub_id,
      panelCode: p.panel_code,
      session: p.session_number,
      room: p.room_number,
      subsession: t.subsession,
      turn: p.turn,
      isActive: t.is_active,
      assignmentType: t.assignment_type,
      panelId: p.id,
    }))
  );

  // Build hub lookup: hubId → hubName
  const { data: hubsMap = {} } = useQuery({
    queryKey: ['hubs-map'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name');
      const map: Record<string, string> = {};
      for (const h of data || []) map[h.id] = h.name;
      return map;
    },
  });

  const allJudgeRows = assignments.flatMap(p => {
    const panelTeamHubIds = new Set(
      (p.judging_panel_teams || [])
        .filter(t => t.is_active && t.teams?.hub_id)
        .map(t => t.teams!.hub_id as string)
    );

    return (p.judging_panel_judges || []).map(j => {
      const judgeHubId = j.profiles?.hub_id || null;
      const hasHubConflict = !!judgeHubId && panelTeamHubIds.has(judgeHubId);
      return {
        judgeId: j.judge_id,
        judgeName: `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim(),
        email: j.profiles?.email || '',
        hubId: judgeHubId,
        hubName: judgeHubId ? (hubsMap[judgeHubId] || null) : null,
        hasHubConflict,
        panelCode: p.panel_code,
        session: p.session_number,
        room: p.room_number,
        turn: p.turn,
        isActive: j.is_active,
        assignmentType: j.assignment_type,
        deactivatedReason: j.deactivated_reason,
        panelJudgeId: j.id,
        panelId: p.id,
      };
    });
  });

  // Handlers
  const handleDeactivateJudge = async () => {
    try {
      await deactivateJudgeFromPanel({
        panelJudgeId: deactivateDialog.panelJudgeId,
        reason: deactivateReason,
      });
      setDeactivateDialog({ open: false, panelJudgeId: '', judgeName: '' });
      setDeactivateReason('');
    } catch (error) {
      // handled by hook
    }
  };

  const handleAddJudge = async () => {
    if (!selectedJudgeId) return;
    try {
      await addJudgeToPanel({
        panelId: addJudgeDialog.panelId,
        judgeId: selectedJudgeId,
        userId: user?.id || '',
      });
      setAddJudgeDialog({ open: false, panelId: '', panelCode: '' });
      setSelectedJudgeId('');
    } catch (error) {
      // handled by hook
    }
  };

  const handleMoveTeam = async () => {
    if (!targetPanelId) return;
    try {
      await moveTeam({
        teamId: moveTeamDialog.teamId,
        targetPanelId,
        targetSubsession: Number(targetSubsession) as 1 | 2,
        userId: user?.id || '',
      });
      setMoveTeamDialog({ open: false, teamId: '', teamName: '' });
      setTargetPanelId('');
    } catch (error) {
      // handled by hook
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, teamId: string, teamName: string) => {
    setDragTeam({ teamId, teamName });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', teamId);
  };

  const handleDragOver = (e: React.DragEvent, panelId: string, subsession: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ panelId, subsession });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const queryClient = useQueryClient();

  const handleDrop = async (e: React.DragEvent, panelId: string, subsession: number) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragTeam) return;

    const isPending = pendingTeams.some(pt => pt.team_id === dragTeam.teamId);

    try {
      if (isPending) {
        // Insert new assignment for pending team
        const pendingTeam = pendingTeams.find(pt => pt.team_id === dragTeam.teamId);
        const { error } = await supabase
          .from('judging_panel_teams')
          .insert({
            panel_id: panelId,
            team_id: dragTeam.teamId,
            team_code: pendingTeam?.team_code || '',
            subsession,
            assignment_type: 'manual',
            assigned_by: user?.id || null,
          });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
        toast.success(`${dragTeam.teamName} asignado al panel`);
      } else {
        // Move existing team between panels
        await moveTeam({
          teamId: dragTeam.teamId,
          targetPanelId: panelId,
          targetSubsession: subsession as 1 | 2,
          userId: user?.id || '',
        });
      }
    } catch (error) {
      // handled by hook or shown above
    }
    setDragTeam(null);
  };

  const handleDragEnd = () => {
    setDragTeam(null);
    setDropTarget(null);
  };

  // CSV Exports
  const exportScheduleCSV = () => {
    const rows = [['Panel', 'Sesión', 'Aula', 'Turno', 'Tipo', 'Nombre', 'Código', 'Subsesión', 'Estado']];
    for (const panel of assignments) {
      for (const j of panel.judging_panel_judges || []) {
        rows.push([
          panel.panel_code,
          String(panel.session_number),
          String(panel.room_number),
          panel.turn === 'morning' ? 'Mañana' : 'Tarde',
          'Juez',
          `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim(),
          '',
          '',
          j.is_active ? 'Activo' : 'Baja',
        ]);
      }
      for (const t of panel.judging_panel_teams || []) {
        rows.push([
          panel.panel_code,
          String(panel.session_number),
          String(panel.room_number),
          panel.turn === 'morning' ? 'Mañana' : 'Tarde',
          'Equipo',
          t.teams?.name || '',
          t.team_code,
          String(t.subsession),
          t.is_active ? 'Activo' : 'Movido',
        ]);
      }
    }
    downloadCSV(rows, 'escaleta-completa');
  };

  const exportJudgesCSV = () => {
    const rows = [['Nombre', 'Email', 'Panel', 'Aula', 'Sesión', 'Turno', 'Estado']];
    for (const j of allJudgeRows) {
      rows.push([
        j.judgeName,
        j.email,
        j.panelCode,
        String(j.room),
        String(j.session),
        j.turn === 'morning' ? 'Mañana' : 'Tarde',
        j.isActive ? 'Activo' : 'Baja',
      ]);
    }
    downloadCSV(rows, 'listado-jueces');
  };

  const exportTeamsCSV = () => {
    const rows = [['Código', 'Nombre Equipo', 'Categoría', 'Panel', 'Aula', 'Sesión', 'Subsesión', 'Turno']];
    for (const t of allTeamRows.filter(t => t.isActive)) {
      rows.push([
        t.teamCode,
        t.teamName,
        t.category,
        t.panelCode,
        String(t.room),
        String(t.session),
        String(t.subsession),
        t.turn === 'morning' ? 'Mañana' : 'Tarde',
      ]);
    }
    downloadCSV(rows, 'listado-equipos');
  };

  const downloadCSV = (rows: string[][], name: string) => {
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group panels by session for grid view
  const sessions = Array.from(new Set(filteredPanels.map(p => p.session_number))).sort();
  const maxRooms = Math.max(...filteredPanels.map(p => p.room_number), 1); // F10 fix: min 1 for valid CSS

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Atrás
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Escaleta de Jurados</h1>
              <p className="text-muted-foreground">
                Vista y edición de la distribución jueces-equipos.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={turnFilter} onValueChange={(v: TurnFilter) => setTurnFilter(v)}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los turnos</SelectItem>
                <SelectItem value="morning">Mañana</SelectItem>
                <SelectItem value="afternoon">Tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeView} onValueChange={setActiveView}>
          <TabsList>
            <TabsTrigger value="sessions" className="gap-2">
              <Calendar className="h-4 w-4" />
              Por Sesiones
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Users className="h-4 w-4" />
              Por Equipos
            </TabsTrigger>
            <TabsTrigger value="judges" className="gap-2">
              <Gavel className="h-4 w-4" />
              Por Jueces
            </TabsTrigger>
          </TabsList>

          {/* ============ By Sessions View (Spreadsheet) ============ */}
          <TabsContent value="sessions">
            {sessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay asignaciones. Ejecuta el algoritmo desde la página de asignación.
              </div>
            ) : (() => {
              // Build room numbers from ALL panels (not just filtered)
              // Always show all rooms from config, even if empty
              const configRooms = config?.total_rooms || 1;
              const allRooms = Array.from({ length: configRooms }, (_, i) => i + 1);
              const roomCount = allRooms.length;

              const catColors: Record<string, string> = {
                senior: 'bg-green-100 text-green-800 border-green-300',
                junior: 'bg-blue-100 text-blue-800 border-blue-300',
                beginner: 'bg-amber-100 text-amber-800 border-amber-300',
              };

              return (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    {/* Header row: Aulas */}
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-green-600 text-white">
                        <th className="px-3 py-2 text-left w-[120px] border-r border-green-500 sticky left-0 bg-green-600 z-20" />
                        {allRooms.map(room => (
                          <th key={room} className="px-4 py-2 text-center font-semibold border-l border-green-500 min-w-[200px]">
                            Aula {room}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {sessions.map(session => {
                        const isMorning = session <= (config?.sessions_per_turn || 2);
                        const turnLabel = isMorning ? 'TURNO MAÑANA' : 'TURNO TARDE';
                        const isFirstOfTurn = isMorning ? session === 1 : session === (config?.sessions_per_turn || 2) + 1;

                        const sessionPanels = filteredPanels
                          .filter(p => p.session_number === session)
                          .sort((a, b) => a.room_number - b.room_number);

                        const maxSub1 = Math.max(...sessionPanels.map(p =>
                          (p.judging_panel_teams || []).filter(t => t.subsession === 1 && t.is_active).length), 0);
                        const maxSub2 = Math.max(...sessionPanels.map(p =>
                          (p.judging_panel_teams || []).filter(t => t.subsession === 2 && t.is_active).length), 0);

                        return (
                          <React.Fragment key={session}>
                            {/* Turn banner */}
                            {isFirstOfTurn && (
                              <tr>
                                <td colSpan={roomCount + 1} className="bg-green-700 text-white px-3 py-2 font-bold text-sm">
                                  {turnLabel}
                                </td>
                              </tr>
                            )}

                            {/* Panel codes row */}
                            <tr className="bg-green-50 border-b border-t-2 border-green-300">
                              <td className="px-3 py-1.5 font-bold sticky left-0 bg-green-50 z-10 border-r">
                                Sesión {session}
                              </td>
                              {allRooms.map(room => {
                                const panel = sessionPanels.find(p => p.room_number === room);
                                return (
                                  <td key={room} className="px-3 py-1.5 text-center font-bold border-l">
                                    {panel?.panel_code || ''}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Subsession 1 teams */}
                            {Array.from({ length: Math.max(maxSub1, 1) }, (_, rowIdx) => (
                              <tr key={`s${session}-a-${rowIdx}`} className="border-b hover:bg-green-50/30">
                                {rowIdx === 0 ? (
                                  <td rowSpan={Math.max(maxSub1, 1)} className="px-3 py-1 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[11px]">
                                    Sub 1
                                  </td>
                                ) : null}
                                {allRooms.map(room => {
                                  const panel = sessionPanels.find(p => p.room_number === room);
                                  if (!panel) return (
                                    <td key={room} className="border-l" />
                                  );
                                  const teams = (panel.judging_panel_teams || []).filter(t => t.subsession === 1 && t.is_active);
                                  const team = teams[rowIdx];
                                  const isOver = dropTarget?.panelId === panel.id && dropTarget?.subsession === 1;

                                  if (!team) return (
                                    <td
                                      key={room}
                                      className={`border-l transition-colors ${isOver ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : ''}`}
                                      onDragOver={(e) => handleDragOver(e, panel.id, 1)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={(e) => handleDrop(e, panel.id, 1)}
                                    />
                                  );

                                  return (
                                    <td
                                      key={room}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, team.team_id, team.teams?.name || team.team_code)}
                                      onDragEnd={handleDragEnd}
                                      onDragOver={(e) => handleDragOver(e, panel.id, 1)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={(e) => handleDrop(e, panel.id, 1)}
                                      className={`px-2 py-1 border-l cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors ${
                                        team.assignment_type === 'manual' ? 'bg-amber-50' : ''
                                      } ${isOver ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : ''} ${
                                        dragTeam?.teamId === team.team_id ? 'opacity-40' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 pointer-events-none">
                                        <Badge variant="outline" className={`font-mono text-[10px] px-1 py-0 shrink-0 ${catColors[team.teams?.category || ''] || ''}`}>
                                          {team.team_code}
                                        </Badge>
                                        <span className="truncate">{team.teams?.name}</span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}

                            {/* Separator between subsessions */}
                            <tr className="border-b-2 border-green-200">
                              <td colSpan={roomCount + 1} className="h-0.5 bg-green-100" />
                            </tr>

                            {/* Subsession 2 teams */}
                            {Array.from({ length: Math.max(maxSub2, 1) }, (_, rowIdx) => (
                              <tr key={`s${session}-b-${rowIdx}`} className="border-b hover:bg-green-50/30">
                                {rowIdx === 0 ? (
                                  <td rowSpan={Math.max(maxSub2, 1)} className="px-3 py-1 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[11px]">
                                    Sub 2
                                  </td>
                                ) : null}
                                {allRooms.map(room => {
                                  const panel = sessionPanels.find(p => p.room_number === room);
                                  if (!panel) return (
                                    <td key={room} className="border-l" />
                                  );
                                  const teams = (panel.judging_panel_teams || []).filter(t => t.subsession === 2 && t.is_active);
                                  const team = teams[rowIdx];
                                  const isOver = dropTarget?.panelId === panel.id && dropTarget?.subsession === 2;

                                  if (!team) return (
                                    <td
                                      key={room}
                                      className={`border-l transition-colors ${isOver ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : ''}`}
                                      onDragOver={(e) => handleDragOver(e, panel.id, 2)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={(e) => handleDrop(e, panel.id, 2)}
                                    />
                                  );

                                  return (
                                    <td
                                      key={room}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, team.team_id, team.teams?.name || team.team_code)}
                                      onDragEnd={handleDragEnd}
                                      onDragOver={(e) => handleDragOver(e, panel.id, 2)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={(e) => handleDrop(e, panel.id, 2)}
                                      className={`px-2 py-1 border-l cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors ${
                                        team.assignment_type === 'manual' ? 'bg-amber-50' : ''
                                      } ${isOver ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : ''} ${
                                        dragTeam?.teamId === team.team_id ? 'opacity-40' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 pointer-events-none">
                                        <Badge variant="outline" className={`font-mono text-[10px] px-1 py-0 shrink-0 ${catColors[team.teams?.category || ''] || ''}`}>
                                          {team.team_code}
                                        </Badge>
                                        <span className="truncate">{team.teams?.name}</span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}

                            {/* Gap between sessions */}
                            <tr><td colSpan={roomCount + 1} className="h-3" /></tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Pending Teams Section */}
            {pendingTeams.length > 0 && (
              <div className="mt-4 border border-amber-200 bg-amber-50/50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-amber-800 mb-3">
                  Equipos pendientes de asignar ({pendingTeams.length})
                </h4>
                <p className="text-xs text-amber-700 mb-3">
                  Arrastra estos equipos a cualquier celda de la escaleta para asignarlos.
                </p>
                <div className="flex flex-wrap gap-2">
                  {pendingTeams.map(pt => {
                    const team = pt.teams as { id: string; name: string } | null;
                    const catColors: Record<string, string> = {
                      senior: 'bg-green-100 text-green-800 border-green-300',
                      junior: 'bg-blue-100 text-blue-800 border-blue-300',
                      beginner: 'bg-amber-100 text-amber-800 border-amber-300',
                    };
                    return (
                      <div
                        key={pt.team_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, pt.team_id, team?.name || pt.team_code)}
                        onDragEnd={handleDragEnd}
                        className="flex items-center gap-1.5 px-2 py-1 border border-amber-300 rounded bg-white cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      >
                        <Badge variant="outline" className={`font-mono text-[10px] px-1 py-0 shrink-0 ${catColors[pt.category] || ''}`}>
                          {pt.team_code}
                        </Badge>
                        <span className="text-xs truncate max-w-[150px]">{team?.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ============ By Teams View ============ */}
          <TabsContent value="teams">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Panel</TableHead>
                      <TableHead>Sesión</TableHead>
                      <TableHead>Subsesión</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTeamRows
                      .filter(t => turnFilter === 'all' || t.turn === turnFilter)
                      .sort((a, b) => a.teamCode.localeCompare(b.teamCode))
                      .map((t, i) => (
                        <TableRow
                          key={`${t.teamId}-${i}`}
                          className={!t.isActive ? 'opacity-50' : ''}
                        >
                          <TableCell>
                            <Badge variant="outline">{t.teamCode}</Badge>
                          </TableCell>
                          <TableCell>{t.teamName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{t.category}</Badge>
                          </TableCell>
                          <TableCell>{t.panelCode}</TableCell>
                          <TableCell>{t.session}</TableCell>
                          <TableCell>{t.subsession}</TableCell>
                          <TableCell>{t.turn === 'morning' ? 'Mañana' : 'Tarde'}</TableCell>
                          <TableCell>
                            {t.isActive ? (
                              <Badge className={
                                t.assignmentType === 'manual' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                              }>
                                {t.assignmentType === 'manual' ? 'Manual' : 'Algoritmo'}
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Movido</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ By Judges View ============ */}
          <TabsContent value="judges">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Juez</TableHead>
                      <TableHead>Hub</TableHead>
                      <TableHead>Panel</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Conflicto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allJudgeRows
                      .filter(j => turnFilter === 'all' || j.turn === turnFilter)
                      .sort((a, b) => {
                        // Conflicts first, then alphabetical
                        if (a.hasHubConflict && !b.hasHubConflict) return -1;
                        if (!a.hasHubConflict && b.hasHubConflict) return 1;
                        return a.judgeName.localeCompare(b.judgeName);
                      })
                      .map((j, i) => (
                        <TableRow
                          key={`${j.judgeId}-${i}`}
                          className={`${!j.isActive ? 'opacity-50' : ''} ${j.hasHubConflict && j.isActive ? 'bg-red-50' : ''}`}
                        >
                          <TableCell>
                            <div>
                              <span className={!j.isActive ? 'line-through text-red-500' : 'font-medium'}>
                                {j.judgeName}
                              </span>
                              <p className="text-xs text-muted-foreground">{j.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {j.hubName ? (
                              <Badge variant="outline" className="text-xs">{j.hubName}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{j.panelCode}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              (S{j.session})
                            </span>
                          </TableCell>
                          <TableCell>{j.turn === 'morning' ? 'Mañana' : 'Tarde'}</TableCell>
                          <TableCell>
                            {j.hasHubConflict && j.isActive ? (
                              <Badge variant="destructive" className="text-xs">
                                Mismo hub
                              </Badge>
                            ) : (
                              <span className="text-xs text-green-600">OK</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {j.isActive ? (
                              <Badge variant="outline" className="text-xs">Activo</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                Baja{j.deactivatedReason && `: ${j.deactivatedReason}`}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {j.isActive && (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setMoveTeamDialog({ open: false, teamId: '', teamName: '' });
                                    setAddJudgeDialog({ open: false, panelId: '', panelCode: '' });
                                    setDeactivateDialog({ open: true, panelJudgeId: j.panelJudgeId, judgeName: j.judgeName });
                                    setDeactivateReason('');
                                  }}
                                >
                                  <UserMinus className="h-3 w-3 mr-1" />
                                  Baja
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setDeactivateDialog({ open: true, panelJudgeId: j.panelJudgeId, judgeName: j.judgeName });
                                    setDeactivateReason('Reasignado a otro panel');
                                  }}
                                >
                                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                                  Mover
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>

                {/* Unassigned judges pool */}
                {unassignedJudges.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="text-sm font-medium mb-3">
                      Jueces sin asignar ({unassignedJudges.length})
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {unassignedJudges.map(j => (
                        <Badge
                          key={j.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => {
                            setSelectedJudgeId(j.id);
                            setAddJudgeDialog({ open: true, panelId: '', panelCode: 'Selecciona panel' });
                          }}
                        >
                          {j.name}
                          {j.hubId && hubsMap[j.hubId] && (
                            <span className="ml-1 text-muted-foreground">({hubsMap[j.hubId]})</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Export Buttons */}
        {assignments.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={exportScheduleCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Escaleta Completa
            </Button>
            <Button variant="outline" onClick={exportJudgesCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Listado de Jueces
            </Button>
            <Button variant="outline" onClick={exportTeamsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Listado de Equipos
            </Button>
          </div>
        )}

        {/* ============ Dialogs ============ */}

        {/* Deactivate Judge Dialog */}
        <Dialog
          open={deactivateDialog.open}
          onOpenChange={(open) => {
            if (!open) setDeactivateDialog({ open: false, panelJudgeId: '', judgeName: '' });
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dar de baja a {deactivateDialog.judgeName}</DialogTitle>
              <DialogDescription>
                El juez aparecerá tachado en la escaleta. Indica el motivo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Ej: No puede asistir"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeactivateDialog({ open: false, panelJudgeId: '', judgeName: '' })}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeactivateJudge}
                disabled={!deactivateReason.trim() || isDeactivating}
              >
                Dar de baja
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Judge Dialog */}
        <Dialog
          open={addJudgeDialog.open}
          onOpenChange={(open) => {
            if (!open) setAddJudgeDialog({ open: false, panelId: '', panelCode: '' });
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir juez a {addJudgeDialog.panelCode}</DialogTitle>
              <DialogDescription>
                Selecciona un juez no asignado para añadirlo manualmente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Juez</Label>
              <Select value={selectedJudgeId} onValueChange={setSelectedJudgeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar juez..." />
                </SelectTrigger>
                <SelectContent>
                  {unassignedJudges.map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name} ({j.email})
                    </SelectItem>
                  ))}
                  {unassignedJudges.length === 0 && (
                    <SelectItem value="_none" disabled>
                      No hay jueces sin asignar
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddJudgeDialog({ open: false, panelId: '', panelCode: '' })}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddJudge} disabled={!selectedJudgeId || isAddingJudge}>
                Añadir juez
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Team Dialog */}
        <Dialog
          open={moveTeamDialog.open}
          onOpenChange={(open) => {
            if (!open) setMoveTeamDialog({ open: false, teamId: '', teamName: '' });
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mover equipo: {moveTeamDialog.teamName}</DialogTitle>
              <DialogDescription>
                Selecciona el panel y subsesión de destino.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Panel destino</Label>
                <Select value={targetPanelId} onValueChange={setTargetPanelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar panel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.panel_code} ({p.turn === 'morning' ? 'Mañana' : 'Tarde'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subsesión</Label>
                <Select value={targetSubsession} onValueChange={(v) => setTargetSubsession(v as '1' | '2')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Subsesión 1</SelectItem>
                    <SelectItem value="2">Subsesión 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setMoveTeamDialog({ open: false, teamId: '', teamName: '' })}
              >
                Cancelar
              </Button>
              <Button onClick={handleMoveTeam} disabled={!targetPanelId || isMovingTeam}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Mover equipo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
