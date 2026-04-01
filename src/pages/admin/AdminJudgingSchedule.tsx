import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useJudgingAssignment } from '@/hooks/useJudgingAssignment';
import { useJudgingConfig } from '@/hooks/useJudgingConfig';
import { useEventJudges } from '@/hooks/useEventJudges';
import { useAuth } from '@/hooks/useAuth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  GripVertical,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

type TurnFilter = 'all' | 'morning' | 'afternoon';

// ============================================================================
// SortableTeamItem — dnd-kit sortable item for intra-panel reorder
// ============================================================================

interface SortableTeamItemProps {
  team: {
    id: string;
    team_id: string;
    team_code: string;
    subsession: number;
    is_active: boolean;
    assignment_type: string;
    display_order: number;
    manual_change_comment: string | null;
    manual_change_by_profile: { first_name: string; last_name: string } | null;
    manual_change_at: string | null;
    teams: { id: string; name: string; category: string; hub_id: string | null } | null;
  };
  onMoveStart: (e: React.DragEvent, teamId: string, teamName: string, category: string) => void;
  onDropTeam: (teamId: string, teamName: string) => void;
  catColors: Record<string, string>;
}

const SortableTeamItem = React.memo(function SortableTeamItem({
  team,
  onMoveStart,
  onDropTeam,
  catColors,
}: SortableTeamItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: team.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const teamName = team.teams?.name || team.team_code;
  const category = team.teams?.category || '';

  const badge = (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 ${team.assignment_type === 'manual' ? 'bg-amber-50 rounded px-0.5' : ''}`}
    >
      {/* Grip handle for intra-panel reorder (dnd-kit) */}
      <span
        {...attributes}
        {...listeners}
        onPointerDown={(e) => { e.stopPropagation(); (listeners as any)?.onPointerDown?.(e); }}
        className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted shrink-0"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </span>

      <Badge variant="outline" className={`font-mono text-[10px] px-1 py-0 shrink-0 ${catColors[category] || ''}`}>
        {team.team_code}
      </Badge>
      <span className="truncate text-xs">{teamName}</span>

      {/* Move between panels button (native D&D) */}
      <span
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onMoveStart(e, team.team_id, teamName, category);
        }}
        className="cursor-grab p-0.5 rounded hover:bg-blue-100 shrink-0"
      >
        <ArrowRightLeft className="h-3 w-3 text-blue-500" />
      </span>

      {/* Drop team button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDropTeam(team.team_id, teamName); }}
        className="p-0.5 rounded hover:bg-red-100 shrink-0 opacity-0 group-hover/team:opacity-100 transition-opacity"
      >
        <UserMinus className="h-3 w-3 text-destructive" />
      </button>
    </div>
  );

  // Wrap manual items in audit tooltip
  if (team.assignment_type === 'manual') {
    const profileName = team.manual_change_by_profile
      ? `${team.manual_change_by_profile.first_name} ${team.manual_change_by_profile.last_name}`.trim()
      : null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="group/team">{badge}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px]">
          <p className="font-medium text-xs">Cambio manual</p>
          {team.manual_change_comment && <p className="text-xs">{team.manual_change_comment}</p>}
          {profileName && (
            <p className="text-xs text-muted-foreground">
              {profileName}{team.manual_change_at ? ` · ${new Date(team.manual_change_at).toLocaleDateString('es-ES')}` : ''}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <div className="group/team">{badge}</div>;
});

// ============================================================================
// Main Component
// ============================================================================

export default function AdminJudgingSchedule() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [turnFilter, setTurnFilter] = useState<TurnFilter>('all');
  const [activeView, setActiveView] = useState('sessions');

  // Drag & drop state (native — cross-panel moves)
  const [dragTeam, setDragTeam] = useState<{ teamId: string; teamName: string; category: string } | null>(null);
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
  const [addJudgeComment, setAddJudgeComment] = useState('');

  // Move team dialog
  const [moveTeamDialog, setMoveTeamDialog] = useState<{
    open: boolean;
    teamId: string;
    teamName: string;
  }>({ open: false, teamId: '', teamName: '' });
  const [targetPanelId, setTargetPanelId] = useState('');
  const [targetSubsession, setTargetSubsession] = useState<'1' | '2'>('1');
  const [moveComment, setMoveComment] = useState('');

  // Drop team dialog (event-level deactivation)
  const [dropTeamDialog, setDropTeamDialog] = useState<{
    open: boolean;
    teamId: string;
    teamName: string;
  }>({ open: false, teamId: '', teamName: '' });
  const [dropTeamComment, setDropTeamComment] = useState('');

  // Drop judge from event dialog
  const [dropJudgeDialog, setDropJudgeDialog] = useState<{
    open: boolean;
    judgeId: string;
    judgeName: string;
  }>({ open: false, judgeId: '', judgeName: '' });
  const [dropJudgeComment, setDropJudgeComment] = useState('');

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
    replaceJudge,
    isReplacing,
    swapJudges,
    isSwapping,
    isMovingTeam,
    reorderTeams,
    dropTeam,
    isDroppingTeam,
    reactivateTeam,
    isReactivatingTeam,
    dropJudge,
    isDroppingJudge,
    reactivateJudge,
    isReactivatingJudge,
  } = useJudgingAssignment(eventId);

  // dnd-kit sensors for intra-panel reorder
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
        .select('id, team_id, team_code, category, turn, is_active, teams:team_id (id, name)')
        .eq('event_id', eventId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });
  const pendingTeams = allEventTeams.filter(et => et.is_active !== false && !assignedTeamIds.has(et.team_id));

  // Helper: get majority category of a panel's active teams
  const getPanelMajorityCategory = useCallback((panelId: string): string | null => {
    const panel = assignments.find(p => p.id === panelId);
    if (!panel) return null;
    const activeTeams = (panel.judging_panel_teams || []).filter(t => t.is_active);
    if (activeTeams.length === 0) return null;
    const catCounts: Record<string, number> = {};
    for (const t of activeTeams) {
      const cat = t.teams?.category || '';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    let maxCat = '';
    let maxCount = 0;
    for (const [cat, count] of Object.entries(catCounts)) {
      if (count > maxCount) { maxCat = cat; maxCount = count; }
    }
    return maxCat;
  }, [assignments]);

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
      displayOrder: t.display_order,
      manualComment: t.manual_change_comment,
      manualByProfile: t.manual_change_by_profile,
      manualAt: t.manual_change_at,
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
        judgeName: `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim() || j.profiles?.email || 'Sin nombre',
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
        manualComment: j.manual_change_comment,
        manualByProfile: j.manual_change_by_profile,
        manualAt: j.manual_change_at,
        panelJudgeId: j.id,
        panelId: p.id,
      };
    });
  });

  // Judge manage dialog state
  const [judgeManageDialog, setJudgeManageDialog] = useState<{
    open: boolean;
    judgeId: string;
    judgeName: string;
    hubName: string | null;
    panelJudgeId: string;
    panelId: string;
    panelCode: string;
  }>({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '' });
  const [manageAction, setManageAction] = useState<'replace' | 'swap' | 'deactivate' | 'drop_event'>('replace');
  const [selectedReplaceJudgeId, setSelectedReplaceJudgeId] = useState('');
  const [selectedSwapPanelJudgeId, setSelectedSwapPanelJudgeId] = useState('');
  const [manageDeactivateReason, setManageDeactivateReason] = useState('');
  const [manageComment, setManageComment] = useState('');

  // Judges grid data grouped by turn → session → room
  const judgesGridData = useMemo(() => {
    const turnMap = new Map<string, Map<number, Map<number, {
      panelCode: string;
      panelId: string;
      judges: typeof allJudgeRows;
    }>>>();

    for (const panel of assignments) {
      const turn = panel.turn;
      if (!turnMap.has(turn)) turnMap.set(turn, new Map());
      const sessMap = turnMap.get(turn)!;
      if (!sessMap.has(panel.session_number)) sessMap.set(panel.session_number, new Map());
      const roomMap = sessMap.get(panel.session_number)!;

      const panelTeamHubIds = new Set(
        (panel.judging_panel_teams || [])
          .filter(t => t.is_active && t.teams?.hub_id)
          .map(t => t.teams!.hub_id as string)
      );

      const judges = (panel.judging_panel_judges || []).map(j => {
        const judgeHubId = j.profiles?.hub_id || null;
        const hasHubConflict = !!judgeHubId && panelTeamHubIds.has(judgeHubId);
        return {
          judgeId: j.judge_id,
          judgeName: `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim() || j.profiles?.email || 'Sin nombre',
          email: j.profiles?.email || '',
          hubId: judgeHubId,
          hubName: judgeHubId ? (hubsMap[judgeHubId] || null) : null,
          hasHubConflict,
          panelCode: panel.panel_code,
          session: panel.session_number,
          room: panel.room_number,
          turn: panel.turn,
          isActive: j.is_active,
          assignmentType: j.assignment_type,
          deactivatedReason: j.deactivated_reason,
          manualComment: j.manual_change_comment,
          manualByProfile: j.manual_change_by_profile,
          manualAt: j.manual_change_at,
          panelJudgeId: j.id,
          panelId: panel.id,
        };
      });

      roomMap.set(panel.room_number, {
        panelCode: panel.panel_code,
        panelId: panel.id,
        judges,
      });
    }

    const turnOrder: ('morning' | 'afternoon')[] = ['morning', 'afternoon'];
    return turnOrder
      .filter(turn => turnMap.has(turn))
      .map(turn => {
        const sessMap = turnMap.get(turn)!;
        const sessionNumbers = Array.from(sessMap.keys()).sort((a, b) => a - b);
        return {
          turn,
          turnLabel: turn === 'morning' ? 'Mañana' : 'Tarde',
          sessions: sessionNumbers.map(sessionNumber => {
            const roomMap = sessMap.get(sessionNumber)!;
            const allRoomNums = Array.from({ length: config?.total_rooms || 1 }, (_, i) => i + 1);
            return {
              sessionNumber,
              rooms: allRoomNums.map(roomNumber => {
                const data = roomMap.get(roomNumber);
                return {
                  roomNumber,
                  panelCode: data?.panelCode || '',
                  panelId: data?.panelId || '',
                  judges: data?.judges || [],
                  activeCount: (data?.judges || []).filter(j => j.isActive).length,
                };
              }),
            };
          }),
        };
      });
  }, [assignments, hubsMap, config?.total_rooms]);

  // All assigned active judges for swap list (flat)
  const allAssignedActiveJudges = useMemo(() => {
    return assignments.flatMap(p =>
      (p.judging_panel_judges || [])
        .filter(j => j.is_active)
        .map(j => ({
          panelJudgeId: j.id,
          judgeId: j.judge_id,
          name: `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim() || j.profiles?.email || 'Sin nombre',
          hubId: j.profiles?.hub_id || null,
          hubName: j.profiles?.hub_id ? (hubsMap[j.profiles.hub_id] || null) : null,
          panelCode: p.panel_code,
          panelId: p.id,
        }))
    );
  }, [assignments, hubsMap]);

  // Hub conflict preview for swap target
  const getSwapHubConflict = (targetPanelJudgeId: string): boolean => {
    const targetJudge = allAssignedActiveJudges.find(j => j.panelJudgeId === targetPanelJudgeId);
    if (!targetJudge) return false;
    const currentJudgeHubId = allJudgeRows.find(j => j.panelJudgeId === judgeManageDialog.panelJudgeId)?.hubId;
    const targetPanel = assignments.find(p => p.id === targetJudge.panelId);
    if (!currentJudgeHubId || !targetPanel) return false;
    const targetPanelTeamHubIds = new Set(
      (targetPanel.judging_panel_teams || [])
        .filter(t => t.is_active && t.teams?.hub_id)
        .map(t => t.teams!.hub_id as string)
    );
    return targetPanelTeamHubIds.has(currentJudgeHubId);
  };

  const openJudgeManageDialog = (judge: typeof allJudgeRows[0]) => {
    setDeactivateDialog({ open: false, panelJudgeId: '', judgeName: '' });
    setAddJudgeDialog({ open: false, panelId: '', panelCode: '' });
    setMoveTeamDialog({ open: false, teamId: '', teamName: '' });
    setJudgeManageDialog({
      open: true,
      judgeId: judge.judgeId,
      judgeName: judge.judgeName,
      hubName: judge.hubName,
      panelJudgeId: judge.panelJudgeId,
      panelId: judge.panelId,
      panelCode: judge.panelCode,
    });
    setManageAction('replace');
    setSelectedReplaceJudgeId('');
    setSelectedSwapPanelJudgeId('');
    setManageDeactivateReason('');
    setManageComment('');
  };

  const handleManageConfirm = async () => {
    try {
      if (manageAction === 'replace') {
        if (!selectedReplaceJudgeId) return;
        await replaceJudge({
          panelJudgeId: judgeManageDialog.panelJudgeId,
          panelId: judgeManageDialog.panelId,
          newJudgeId: selectedReplaceJudgeId,
          userId: user?.id || '',
          comment: manageComment || undefined,
        });
      } else if (manageAction === 'swap') {
        if (!selectedSwapPanelJudgeId) return;
        await swapJudges({
          panelJudgeAId: judgeManageDialog.panelJudgeId,
          panelJudgeBId: selectedSwapPanelJudgeId,
          userId: user?.id || '',
          comment: manageComment || undefined,
        });
      } else if (manageAction === 'deactivate') {
        if (!manageDeactivateReason.trim()) return;
        await deactivateJudgeFromPanel({
          panelJudgeId: judgeManageDialog.panelJudgeId,
          reason: manageDeactivateReason,
          userId: user?.id || '',
        });
      } else if (manageAction === 'drop_event') {
        if (!manageDeactivateReason.trim()) return;
        await dropJudge({
          judgeId: judgeManageDialog.judgeId,
          eventId: eventId || '',
          userId: user?.id || '',
          comment: manageDeactivateReason,
        });
      }
      setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '' });
    } catch {
      // handled by hook
    }
  };

  const isManageDisabled = () => {
    if (isReplacing || isSwapping || isDeactivating || isDroppingJudge) return true;
    if (manageAction === 'replace') return !selectedReplaceJudgeId;
    if (manageAction === 'swap') return !selectedSwapPanelJudgeId;
    if (manageAction === 'deactivate' || manageAction === 'drop_event') return !manageDeactivateReason.trim();
    return true;
  };

  // Handlers
  const handleDeactivateJudge = async () => {
    try {
      await deactivateJudgeFromPanel({
        panelJudgeId: deactivateDialog.panelJudgeId,
        reason: deactivateReason,
        userId: user?.id || '',
      });
      setDeactivateDialog({ open: false, panelJudgeId: '', judgeName: '' });
      setDeactivateReason('');
    } catch {
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
        comment: addJudgeComment || undefined,
      });
      setAddJudgeDialog({ open: false, panelId: '', panelCode: '' });
      setSelectedJudgeId('');
      setAddJudgeComment('');
    } catch {
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
        comment: moveComment || undefined,
      });
      setMoveTeamDialog({ open: false, teamId: '', teamName: '' });
      setTargetPanelId('');
      setMoveComment('');
    } catch {
      // handled by hook
    }
  };

  const handleDropTeamConfirm = async () => {
    if (!dropTeamDialog.teamId) return;
    try {
      await dropTeam({
        teamId: dropTeamDialog.teamId,
        eventId: eventId || '',
        userId: user?.id || '',
        comment: dropTeamComment || undefined,
      });
      setDropTeamDialog({ open: false, teamId: '', teamName: '' });
      setDropTeamComment('');
    } catch {
      // handled by hook
    }
  };

  const handleReactivateTeam = async (teamId: string) => {
    try {
      await reactivateTeam({
        teamId,
        eventId: eventId || '',
        userId: user?.id || '',
      });
    } catch {
      // handled by hook
    }
  };

  const handleDropJudgeConfirm = async () => {
    if (!dropJudgeDialog.judgeId) return;
    try {
      await dropJudge({
        judgeId: dropJudgeDialog.judgeId,
        eventId: eventId || '',
        userId: user?.id || '',
        comment: dropJudgeComment || undefined,
      });
      setDropJudgeDialog({ open: false, judgeId: '', judgeName: '' });
      setDropJudgeComment('');
    } catch {
      // handled by hook
    }
  };

  const handleReactivateJudge = async (judgeId: string) => {
    try {
      await reactivateJudge({
        judgeId,
        eventId: eventId || '',
        userId: user?.id || '',
      });
    } catch {
      // handled by hook
    }
  };

  // Drag & drop handlers (native — cross-panel moves)
  const handleDragStart = (e: React.DragEvent, teamId: string, teamName: string, category: string) => {
    setDragTeam({ teamId, teamName, category });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', teamId);
  };

  const handleDragOver = (e: React.DragEvent, panelId: string, subsession: number) => {
    // Category validation: block drop if mismatch
    if (dragTeam) {
      const majorCat = getPanelMajorityCategory(panelId);
      if (majorCat && majorCat !== dragTeam.category) {
        e.dataTransfer.dropEffect = 'none';
        setDropTarget({ panelId, subsession });
        return; // Don't preventDefault → browser blocks the drop
      }
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ panelId, subsession });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, panelId: string, subsession: number) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragTeam) return;

    // Category validation
    const majorCat = getPanelMajorityCategory(panelId);
    if (majorCat && majorCat !== dragTeam.category) {
      toast.error('No se puede mover: la categoría del equipo no coincide con la del panel destino');
      setDragTeam(null);
      return;
    }

    const isPending = pendingTeams.some(pt => pt.team_id === dragTeam.teamId);

    try {
      if (isPending) {
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
            manual_change_by: user?.id || null,
            manual_change_at: new Date().toISOString(),
          });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['judging-assignments', eventId] });
        toast.success(`${dragTeam.teamName} asignado al panel`);
      } else {
        // Open move dialog for comment
        setMoveTeamDialog({ open: true, teamId: dragTeam.teamId, teamName: dragTeam.teamName });
        setTargetPanelId(panelId);
        setTargetSubsession(String(subsession) as '1' | '2');
        setMoveComment('');
      }
    } catch {
      // handled by hook or shown above
    }
    setDragTeam(null);
  };

  const handleDragEnd = () => {
    setDragTeam(null);
    setDropTarget(null);
  };

  // dnd-kit handler for intra-panel reorder
  const handleSortEnd = useCallback((panelId: string, subsession: number, teams: { id: string }[]) =>
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = teams.findIndex(t => t.id === active.id);
      const newIndex = teams.findIndex(t => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(teams, oldIndex, newIndex);
      reorderTeams({
        panelId,
        subsession: subsession as 1 | 2,
        orderedTeamIds: reordered.map(t => t.id),
        userId: user?.id || '',
      });
    }, [reorderTeams, user?.id]);

  // CSV Exports
  const exportScheduleCSV = () => {
    const rows = [['Panel', 'Sesión', 'Aula', 'Turno', 'Tipo', 'Nombre', 'Código', 'Subsesión', 'Orden', 'Estado', 'Cambio Manual', 'Comentario', 'Modificado por', 'Fecha modificación']];
    for (const panel of assignments) {
      for (const j of panel.judging_panel_judges || []) {
        const profileName = j.manual_change_by_profile ? `${j.manual_change_by_profile.first_name} ${j.manual_change_by_profile.last_name}`.trim() : '';
        rows.push([
          panel.panel_code,
          String(panel.session_number),
          String(panel.room_number),
          panel.turn === 'morning' ? 'Mañana' : 'Tarde',
          'Juez',
          `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim(),
          '',
          '',
          '',
          j.is_active ? 'Activo' : 'Baja',
          j.assignment_type === 'manual' ? 'Sí' : 'No',
          j.manual_change_comment || '',
          profileName,
          j.manual_change_at ? new Date(j.manual_change_at).toLocaleDateString('es-ES') : '',
        ]);
      }
      const sortedTeams = [...(panel.judging_panel_teams || [])].sort((a, b) => {
        if (a.subsession !== b.subsession) return a.subsession - b.subsession;
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return (a.display_order || 0) - (b.display_order || 0);
      });
      for (const t of sortedTeams) {
        const profileName = t.manual_change_by_profile ? `${t.manual_change_by_profile.first_name} ${t.manual_change_by_profile.last_name}`.trim() : '';
        rows.push([
          panel.panel_code,
          String(panel.session_number),
          String(panel.room_number),
          panel.turn === 'morning' ? 'Mañana' : 'Tarde',
          'Equipo',
          t.teams?.name || '',
          t.team_code,
          String(t.subsession),
          String(t.display_order || 0),
          t.is_active ? 'Activo' : 'Baja',
          t.assignment_type === 'manual' ? 'Sí' : 'No',
          t.manual_change_comment || '',
          profileName,
          t.manual_change_at ? new Date(t.manual_change_at).toLocaleDateString('es-ES') : '',
        ]);
      }
    }
    downloadCSV(rows, 'escaleta-completa');
  };

  const exportJudgesCSV = () => {
    const rows = [['Nombre', 'Email', 'Panel', 'Aula', 'Sesión', 'Turno', 'Estado', 'Comentario', 'Modificado por']];
    for (const j of allJudgeRows) {
      const profileName = j.manualByProfile ? `${j.manualByProfile.first_name} ${j.manualByProfile.last_name}`.trim() : '';
      rows.push([
        j.judgeName,
        j.email,
        j.panelCode,
        String(j.room),
        String(j.session),
        j.turn === 'morning' ? 'Mañana' : 'Tarde',
        j.isActive ? 'Activo' : 'Baja',
        j.manualComment || '',
        profileName,
      ]);
    }
    downloadCSV(rows, 'listado-jueces');
  };

  const exportTeamsCSV = () => {
    const rows = [['Código', 'Nombre Equipo', 'Categoría', 'Panel', 'Aula', 'Sesión', 'Subsesión', 'Turno', 'Orden', 'Estado', 'Comentario']];
    const sorted = [...allTeamRows].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
    for (const t of sorted) {
      rows.push([
        t.teamCode,
        t.teamName,
        t.category,
        t.panelCode,
        String(t.room),
        String(t.session),
        String(t.subsession),
        t.turn === 'morning' ? 'Mañana' : 'Tarde',
        String(t.displayOrder || 0),
        t.isActive ? 'Activo' : 'Baja',
        t.manualComment || '',
      ]);
    }
    downloadCSV(rows, 'listado-equipos');
  };

  const downloadCSV = (rows: string[][], name: string) => {
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`).join(',')).join('\n');
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

  const catColors: Record<string, string> = {
    senior: 'bg-green-100 text-green-800 border-green-300',
    junior: 'bg-blue-100 text-blue-800 border-blue-300',
    beginner: 'bg-amber-100 text-amber-800 border-amber-300',
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Helper to render a subsession cell with sortable teams
  const renderSubsessionCell = (panel: typeof assignments[0], subsession: 1 | 2) => {
    const allTeams = (panel.judging_panel_teams || [])
      .filter(t => t.subsession === subsession);
    const activeTeams = allTeams
      .filter(t => t.is_active)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const inactiveTeams = allTeams
      .filter(t => !t.is_active)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // Capacity warning
    const teamsPerGroup = config?.teams_per_group || 999;
    const overCapacity = activeTeams.length > teamsPerGroup;

    const isOver = dropTarget?.panelId === panel.id && dropTarget?.subsession === subsession;
    // Category mismatch check for drop visual
    const categoryMismatch = dragTeam ? (() => {
      const majorCat = getPanelMajorityCategory(panel.id);
      return majorCat && majorCat !== dragTeam.category;
    })() : false;

    return (
      <div
        className={`min-h-[28px] px-1 py-0.5 transition-colors ${
          isOver
            ? categoryMismatch
              ? 'bg-red-50/30 ring-2 ring-inset ring-red-300'
              : 'bg-blue-100 ring-2 ring-inset ring-blue-400'
            : ''
        } ${overCapacity ? 'border-l-2 border-l-orange-400' : ''}`}
        onDragOver={(e) => handleDragOver(e, panel.id, subsession)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, panel.id, subsession)}
      >
        {overCapacity && (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-[9px] px-1 py-0 mb-0.5">
            {activeTeams.length}/{teamsPerGroup}
          </Badge>
        )}

        {activeTeams.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSortEnd(panel.id, subsession, activeTeams)}
          >
            <SortableContext items={activeTeams.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {activeTeams.map(team => (
                <SortableTeamItem
                  key={team.id}
                  team={team as any}
                  onMoveStart={handleDragStart}
                  onDropTeam={(teamId, teamName) =>
                    setDropTeamDialog({ open: true, teamId, teamName })
                  }
                  catColors={catColors}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        {/* Inactive teams (dropped) at the end */}
        {inactiveTeams.map(team => (
          <div
            key={team.id}
            className="flex items-center gap-1 bg-red-50 rounded px-0.5 opacity-60 group/dropped"
          >
            <Badge variant="outline" className={`font-mono text-[10px] px-1 py-0 shrink-0 text-red-400 line-through ${catColors[team.teams?.category || ''] || ''}`}>
              {team.team_code}
            </Badge>
            <span className="truncate text-xs text-red-400 line-through">{team.teams?.name}</span>
            <Badge variant="destructive" className="text-[9px] px-1 py-0">BAJA</Badge>
            <button
              onClick={() => handleReactivateTeam(team.team_id)}
              className="p-0.5 rounded hover:bg-green-100 shrink-0 opacity-0 group-hover/dropped:opacity-100 transition-opacity"
            >
              <UserPlus className="h-3 w-3 text-green-600" />
            </button>
          </div>
        ))}
      </div>
    );
  };

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
              const configRooms = config?.total_rooms || 1;
              const allRooms = Array.from({ length: configRooms }, (_, i) => i + 1);
              const roomCount = allRooms.length;

              return (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
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
                        const sessionPanels = filteredPanels
                          .filter(p => p.session_number === session)
                          .sort((a, b) => a.room_number - b.room_number);

                        // Determine turn from actual panel data instead of session number heuristic
                        const sessionTurn = sessionPanels[0]?.turn || 'morning';
                        const isMorning = sessionTurn === 'morning';
                        const turnLabel = isMorning ? 'TURNO MAÑANA' : 'TURNO TARDE';
                        // Show turn banner on the first session of each turn
                        const prevSession = sessions[sessions.indexOf(session) - 1];
                        const prevTurn = prevSession
                          ? filteredPanels.find(p => p.session_number === prevSession)?.turn
                          : undefined;
                        const isFirstOfTurn = !prevTurn || prevTurn !== sessionTurn;

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

                            {/* Subsession 1 */}
                            <tr className="border-b hover:bg-green-50/30">
                              <td className="px-3 py-1 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[11px]">
                                Sub 1
                              </td>
                              {allRooms.map(room => {
                                const panel = sessionPanels.find(p => p.room_number === room);
                                if (!panel) return <td key={room} className="border-l" />;
                                return (
                                  <td key={room} className="border-l align-top">
                                    {renderSubsessionCell(panel, 1)}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Separator between subsessions */}
                            <tr className="border-b-2 border-green-200">
                              <td colSpan={roomCount + 1} className="h-0.5 bg-green-100" />
                            </tr>

                            {/* Subsession 2 */}
                            <tr className="border-b hover:bg-green-50/30">
                              <td className="px-3 py-1 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[11px]">
                                Sub 2
                              </td>
                              {allRooms.map(room => {
                                const panel = sessionPanels.find(p => p.room_number === room);
                                if (!panel) return <td key={room} className="border-l" />;
                                return (
                                  <td key={room} className="border-l align-top">
                                    {renderSubsessionCell(panel, 2)}
                                  </td>
                                );
                              })}
                            </tr>

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
                    return (
                      <div
                        key={pt.team_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, pt.team_id, team?.name || pt.team_code, pt.category)}
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
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTeamRows
                      .filter(t => turnFilter === 'all' || t.turn === turnFilter)
                      .sort((a, b) => {
                        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
                        return a.teamCode.localeCompare(b.teamCode);
                      })
                      .map((t, i) => (
                        <TableRow
                          key={`${t.teamId}-${i}`}
                          className={!t.isActive ? 'bg-red-50 opacity-60' : ''}
                        >
                          <TableCell>
                            <Badge variant="outline" className={!t.isActive ? 'line-through text-red-400' : ''}>
                              {t.teamCode}
                            </Badge>
                          </TableCell>
                          <TableCell className={!t.isActive ? 'line-through text-red-400' : ''}>
                            {t.teamName}
                            {t.assignmentType === 'manual' && t.manualComment && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MessageSquare className="h-3 w-3 inline ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{t.manualComment}</p>
                                  {t.manualByProfile && (
                                    <p className="text-xs text-muted-foreground">
                                      {t.manualByProfile.first_name} {t.manualByProfile.last_name}
                                      {t.manualAt ? ` · ${new Date(t.manualAt).toLocaleDateString('es-ES')}` : ''}
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
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
                              <Badge variant="destructive">Baja</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.isActive ? (
                              <button
                                onClick={() => setDropTeamDialog({ open: true, teamId: t.teamId, teamName: t.teamName })}
                                className="p-1 rounded hover:bg-red-100"
                                title="Dar de baja"
                              >
                                <UserMinus className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivateTeam(t.teamId)}
                                className="p-1 rounded hover:bg-green-100"
                                title="Reactivar"
                              >
                                <UserPlus className="h-3.5 w-3.5 text-green-600" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ By Judges View (Grid) ============ */}
          <TabsContent value="judges">
            {judgesGridData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay asignaciones. Ejecuta el algoritmo desde la página de asignación.
              </div>
            ) : (
              <div className="space-y-4">
                {judgesGridData
                  .filter(g => turnFilter === 'all' || g.turn === turnFilter)
                  .map(turnData => (
                    <div key={turnData.turn} className="border rounded-lg overflow-x-auto">
                      <div className="bg-emerald-700 text-white px-3 py-2 font-bold text-sm">
                        TURNO {turnData.turnLabel.toUpperCase()}
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-blue-100">
                            <th className="px-3 py-2 text-left w-[120px] border-r font-semibold sticky left-0 bg-blue-100 z-20" />
                            {turnData.sessions[0]?.rooms.map(room => (
                              <th key={room.roomNumber} className="px-4 py-2 text-center font-semibold border-l min-w-[200px]">
                                Aula {room.roomNumber}
                                <span className="ml-1 font-normal text-muted-foreground">
                                  ({room.activeCount}/{config?.judges_per_group || '?'})
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {turnData.sessions.map(session => (
                            <React.Fragment key={session.sessionNumber}>
                              <tr className="bg-blue-50 border-b border-t-2 border-blue-200">
                                <td className="px-3 py-1.5 font-bold sticky left-0 bg-blue-50 z-10 border-r">
                                  Sesión {session.sessionNumber}
                                </td>
                                {session.rooms.map(room => (
                                  <td key={room.roomNumber} className="px-3 py-1.5 text-center font-bold border-l">
                                    {room.panelCode}
                                  </td>
                                ))}
                              </tr>
                              {(() => {
                                const maxJudges = Math.max(...session.rooms.map(r => r.judges.length), 1);
                                return Array.from({ length: maxJudges }, (_, rowIdx) => (
                                  <tr key={`s${session.sessionNumber}-j-${rowIdx}`} className="border-b hover:bg-blue-50/30">
                                    {rowIdx === 0 ? (
                                      <td rowSpan={maxJudges} className="px-3 py-1 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[11px]">
                                        Jueces
                                      </td>
                                    ) : null}
                                    {session.rooms.map(room => {
                                      const judge = room.judges[rowIdx];
                                      if (!judge) return <td key={room.roomNumber} className="border-l" />;

                                      const judgeContent = (
                                        <div
                                          role={judge.isActive ? 'button' : undefined}
                                          tabIndex={judge.isActive ? 0 : undefined}
                                          onClick={judge.isActive ? () => openJudgeManageDialog(judge) : undefined}
                                          onKeyDown={judge.isActive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openJudgeManageDialog(judge); } } : undefined}
                                          className={`py-1 px-2 rounded max-w-[200px] ${
                                            judge.isActive
                                              ? judge.hasHubConflict
                                                ? 'bg-amber-100 border border-amber-300 cursor-pointer hover:bg-amber-200'
                                                : 'cursor-pointer hover:bg-gray-100'
                                              : 'bg-red-50 opacity-60'
                                          }`}
                                        >
                                          <span className={`text-xs block truncate ${
                                            !judge.isActive ? 'line-through text-red-500' : 'font-medium'
                                          }`} title={judge.judgeName}>
                                            {judge.judgeName}
                                          </span>
                                          {judge.hubName && (
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5">
                                              {judge.hubName}
                                            </Badge>
                                          )}
                                          {!judge.isActive && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                              <Badge variant="destructive" className="text-[9px] px-1 py-0">BAJA</Badge>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleReactivateJudge(judge.judgeId); }}
                                                className="p-0.5 rounded hover:bg-green-100"
                                              >
                                                <UserPlus className="h-3 w-3 text-green-600" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );

                                      // Wrap manual items with audit tooltip
                                      if (judge.assignmentType === 'manual' && judge.isActive) {
                                        const profileName = judge.manualByProfile
                                          ? `${judge.manualByProfile.first_name} ${judge.manualByProfile.last_name}`.trim()
                                          : null;
                                        return (
                                          <td key={room.roomNumber} className="px-2 py-0.5 border-l align-top">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                {judgeContent}
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-[250px]">
                                                <p className="font-medium text-xs">Cambio manual</p>
                                                {judge.manualComment && <p className="text-xs">{judge.manualComment}</p>}
                                                {profileName && (
                                                  <p className="text-xs text-muted-foreground">
                                                    {profileName}{judge.manualAt ? ` · ${new Date(judge.manualAt).toLocaleDateString('es-ES')}` : ''}
                                                  </p>
                                                )}
                                              </TooltipContent>
                                            </Tooltip>
                                          </td>
                                        );
                                      }

                                      return (
                                        <td key={room.roomNumber} className="px-2 py-0.5 border-l align-top">
                                          {judgeContent}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ));
                              })()}
                              <tr><td colSpan={(session.rooms.length || 1) + 1} className="h-3" /></tr>
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                {/* Unassigned judges pool */}
                {unassignedJudges.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-amber-800 mb-3">
                      Jueces sin asignar ({unassignedJudges.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {unassignedJudges.map(j => (
                        <Badge
                          key={j.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => {
                            setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '' });
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
              </div>
            )}
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
            else setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '' });
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
            if (!open) { setAddJudgeDialog({ open: false, panelId: '', panelCode: '' }); setAddJudgeComment(''); }
            else setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '' });
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
              <Label>Motivo del cambio (opcional)</Label>
              <Textarea
                value={addJudgeComment}
                onChange={(e) => setAddJudgeComment(e.target.value)}
                placeholder="Motivo del cambio (opcional)"
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setAddJudgeDialog({ open: false, panelId: '', panelCode: '' }); setAddJudgeComment(''); }}
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
            if (!open) { setMoveTeamDialog({ open: false, teamId: '', teamName: '' }); setMoveComment(''); }
            else setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '' });
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
              <div className="space-y-2">
                <Label>Motivo del cambio (opcional)</Label>
                <Textarea
                  value={moveComment}
                  onChange={(e) => setMoveComment(e.target.value)}
                  placeholder="Motivo del cambio (opcional)"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setMoveTeamDialog({ open: false, teamId: '', teamName: '' }); setMoveComment(''); }}
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

        {/* Drop Team Dialog (event-level) */}
        <Dialog
          open={dropTeamDialog.open}
          onOpenChange={(open) => {
            if (!open) { setDropTeamDialog({ open: false, teamId: '', teamName: '' }); setDropTeamComment(''); }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Dar de baja a {dropTeamDialog.teamName}?</DialogTitle>
              <DialogDescription>
                El equipo aparecerá en rojo al final de la lista. Se puede revertir.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={dropTeamComment}
                onChange={(e) => setDropTeamComment(e.target.value)}
                placeholder="Motivo de la baja (opcional)"
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setDropTeamDialog({ open: false, teamId: '', teamName: '' }); setDropTeamComment(''); }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDropTeamConfirm}
                disabled={isDroppingTeam}
              >
                Dar de baja
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Drop Judge from Event Dialog */}
        <Dialog
          open={dropJudgeDialog.open}
          onOpenChange={(open) => {
            if (!open) { setDropJudgeDialog({ open: false, judgeId: '', judgeName: '' }); setDropJudgeComment(''); }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Dar de baja del evento a {dropJudgeDialog.judgeName}?</DialogTitle>
              <DialogDescription>
                El juez será dado de baja de TODOS los paneles del evento. Se puede revertir.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={dropJudgeComment}
                onChange={(e) => setDropJudgeComment(e.target.value)}
                placeholder="Motivo de la baja (opcional)"
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setDropJudgeDialog({ open: false, judgeId: '', judgeName: '' }); setDropJudgeComment(''); }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDropJudgeConfirm}
                disabled={isDroppingJudge}
              >
                Dar de baja del evento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Judge Manage Dialog (grid click) */}
        <Dialog
          open={judgeManageDialog.open}
          onOpenChange={(open) => {
            if (!open) setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '' });
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Gestionar juez: {judgeManageDialog.judgeName}</DialogTitle>
              <DialogDescription>
                {judgeManageDialog.hubName && (
                  <Badge variant="outline" className="text-xs mr-2">{judgeManageDialog.hubName}</Badge>
                )}
                Panel: <span className="font-medium">{judgeManageDialog.panelCode}</span>
              </DialogDescription>
            </DialogHeader>

            <RadioGroup value={manageAction} onValueChange={(v) => setManageAction(v as typeof manageAction)} className="space-y-3">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="replace" id="action-replace" />
                <Label htmlFor="action-replace" className="cursor-pointer">Reemplazar por juez libre</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="swap" id="action-swap" />
                <Label htmlFor="action-swap" className="cursor-pointer">Intercambiar con otro juez</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deactivate" id="action-deactivate" />
                <Label htmlFor="action-deactivate" className="cursor-pointer">Dar de baja del panel</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="drop_event" id="action-drop-event" />
                <Label htmlFor="action-drop-event" className="cursor-pointer text-destructive">Dar de baja del evento</Label>
              </div>
            </RadioGroup>

            <div className="space-y-2 mt-2">
              {manageAction === 'replace' && (
                <>
                  <Label>Juez de reemplazo</Label>
                  <Select value={selectedReplaceJudgeId} onValueChange={setSelectedReplaceJudgeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar juez..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedJudges.map(j => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.name}
                          {j.hubId && hubsMap[j.hubId] ? ` (${hubsMap[j.hubId]})` : ''}
                        </SelectItem>
                      ))}
                      {unassignedJudges.length === 0 && (
                        <SelectItem value="_none" disabled>No hay jueces sin asignar</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}

              {manageAction === 'swap' && (
                <>
                  <Label>Intercambiar con</Label>
                  <Select value={selectedSwapPanelJudgeId} onValueChange={setSelectedSwapPanelJudgeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar juez..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allAssignedActiveJudges
                        .filter(j => j.panelJudgeId !== judgeManageDialog.panelJudgeId && j.panelId !== judgeManageDialog.panelId)
                        .map(j => (
                          <SelectItem key={j.panelJudgeId} value={j.panelJudgeId}>
                            {j.name}
                            {j.hubName ? ` (${j.hubName})` : ''}
                            {' — '}{j.panelCode}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedSwapPanelJudgeId && getSwapHubConflict(selectedSwapPanelJudgeId) && (
                    <p className="text-amber-600 text-xs mt-1">
                      Este intercambio generará un conflicto de hub en el panel destino
                    </p>
                  )}
                </>
              )}

              {(manageAction === 'deactivate' || manageAction === 'drop_event') && (
                <>
                  <Label>Motivo de baja</Label>
                  <Textarea
                    value={manageDeactivateReason}
                    onChange={(e) => setManageDeactivateReason(e.target.value)}
                    placeholder="Ej: No puede asistir"
                    maxLength={2000}
                  />
                </>
              )}

              {/* Comment field for replace/swap */}
              {(manageAction === 'replace' || manageAction === 'swap') && (
                <>
                  <Label>Motivo del cambio (opcional)</Label>
                  <Textarea
                    value={manageComment}
                    onChange={(e) => setManageComment(e.target.value)}
                    placeholder="Motivo del cambio (opcional)"
                    rows={2}
                  />
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '' })}
              >
                Cancelar
              </Button>
              <Button
                variant={manageAction === 'deactivate' || manageAction === 'drop_event' ? 'destructive' : 'default'}
                onClick={handleManageConfirm}
                disabled={isManageDisabled()}
              >
                {isReplacing || isSwapping || isDeactivating || isDroppingJudge ? 'Procesando...' : (
                  manageAction === 'replace' ? 'Reemplazar' :
                  manageAction === 'swap' ? 'Intercambiar' :
                  manageAction === 'drop_event' ? 'Dar de baja del evento' : 'Dar de baja'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
