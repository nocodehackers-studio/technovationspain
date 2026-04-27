import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import { Switch } from '@/components/ui/switch';
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
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';


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
  onMoveStart: (e: React.DragEvent, teamId: string, teamName: string, category: string, hubId?: string | null) => void;
  onDropTeam: (teamId: string, teamName: string) => void;
  catColors: Record<string, string>;
  hubsMap: Record<string, string>;
}

const SortableTeamItem = React.memo(function SortableTeamItem({
  team,
  onMoveStart,
  onDropTeam,
  catColors,
  hubsMap,
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
      className={`flex items-center gap-1 py-0.5 ${team.assignment_type === 'manual' ? 'bg-amber-50 rounded px-0.5' : ''}`}
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
      {team.teams?.hub_id && hubsMap[team.teams.hub_id] && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
          {hubsMap[team.teams.hub_id]}
        </Badge>
      )}

      {/* Move between panels button (native D&D) */}
      <span
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onMoveStart(e, team.team_id, teamName, category, team.teams?.hub_id);
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
// Accreditation export helpers (local utilities)
// ============================================================================

const sanitizeFilename = (name: string): string => {
  return (name || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
};

const mapTurn = (turn: string | null | undefined): string => {
  if (turn === 'morning') return 'Mañana';
  if (turn === 'afternoon') return 'Tarde';
  return '';
};

// Trim is load-bearing: callers rely on `safeName(null, 'Pérez') === 'Pérez'` (not ' Pérez')
// so AC 9 (nulls become '', never literal "null") holds.
const safeName = (
  first: string | null | undefined,
  last: string | null | undefined,
): string => {
  return `${first ?? ''} ${last ?? ''}`.trim();
};

const todayMadridDate = (): string => {
  // YYYY-MM-DD in Europe/Madrid timezone (avoids UTC day-rollover at night).
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
};

const triggerXlsxDownload = (buffer: ArrayBuffer, filename: string) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    document.body.removeChild(a);
    // Defer revoke so the browser can commit the download in slower paths (older Safari).
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

// ============================================================================
// Main Component
// ============================================================================

export default function AdminJudgingSchedule() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [turnFilters, setTurnFilters] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState('sessions');
  const [hideInactive, setHideInactive] = useState(false);
  const [incompDialog, setIncompDialog] = useState(false);
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  const toggleTurnFilter = (turn: string) => setTurnFilters(prev => {
    const next = new Set(prev);
    next.has(turn) ? next.delete(turn) : next.add(turn);
    return next;
  });

  // Drag & drop state (native — cross-panel moves)
  const [dragTeam, setDragTeam] = useState<{ teamId: string; teamName: string; category: string; hubId: string | null } | null>(null);
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

  // Accreditation exports
  const [isExportingJudges, setIsExportingJudges] = useState(false);
  const [isExportingTeams, setIsExportingTeams] = useState(false);
  // Refs as re-entrancy guard: state updates are async, so a fast double-click
  // can fire two concurrent exports before `disabled` propagates to the DOM.
  const exportingJudgesRef = useRef(false);
  const exportingTeamsRef = useRef(false);

  const { config } = useJudgingConfig(eventId);
  const { judges: eventJudges, readyJudges, bajaJudges, onboardingPendingJudges } = useEventJudges(eventId);
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
    turnFilters.size === 0 || turnFilters.has(p.turn)
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
  const unassignedOnboardingPendingJudges = onboardingPendingJudges.filter(j => !assignedJudgeIds.has(j.id));

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
        .select('id, team_id, team_code, category, turn, is_active, teams:team_id (id, name, hub_id)')
        .eq('event_id', eventId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });
  const pendingTeams = allEventTeams.filter(et => et.is_active !== false && !assignedTeamIds.has(et.team_id));
  const bajaTeams = allEventTeams.filter(et => et.is_active === false);

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
  const { data: hubsMap = {}, isPending: hubsMapLoading } = useQuery({
    queryKey: ['hubs-map'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name');
      const map: Record<string, string> = {};
      for (const h of data || []) map[h.id] = h.name;
      return map;
    },
  });

  // Check if a team's hub conflicts with any judge's hub in a panel
  const getPanelHubConflict = useCallback((panelId: string, teamHubId: string | null): string | null => {
    if (!teamHubId) return null;
    const panel = assignments.find(p => p.id === panelId);
    if (!panel) return null;
    const conflictJudge = (panel.judging_panel_judges || []).find(
      j => j.is_active && j.profiles?.hub_id === teamHubId
    );
    if (!conflictJudge) return null;
    const hubName = hubsMap[teamHubId] || 'desconocido';
    const judgeName = `${conflictJudge.profiles?.first_name || ''} ${conflictJudge.profiles?.last_name || ''}`.trim();
    return `Conflicto de Hub: el equipo y el juez "${judgeName}" comparten el hub ${hubName}`;
  }, [assignments, hubsMap]);

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
        chapter: j.profiles?.chapter ?? null,
        city: j.profiles?.city ?? null,
        state: j.profiles?.state ?? null,
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
    comments: string | null;
  }>({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null });
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
          chapter: j.profiles?.chapter ?? null,
          city: j.profiles?.city ?? null,
          state: j.profiles?.state ?? null,
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

  const geoFilterOptions = useMemo(() => {
    const activeJudges = eventJudges.filter(j => j.isEventActive);
    return {
      chapters: [...new Set(activeJudges.map(j => j.chapter).filter(Boolean))].sort() as string[],
      states: [...new Set(activeJudges.map(j => j.state).filter(Boolean))].sort() as string[],
      cities: [...new Set(activeJudges.map(j => j.city).filter(Boolean))].sort() as string[],
    };
  }, [eventJudges]);

  const matchesGeoFilter = useCallback(
    (judge: { chapter: string | null; state: string | null; city: string | null }) =>
      (chapterFilter === 'all' || judge.chapter === chapterFilter) &&
      (stateFilter === 'all' || judge.state === stateFilter) &&
      (cityFilter === 'all' || judge.city === cityFilter),
    [chapterFilter, stateFilter, cityFilter]
  );

  // Helper: distinguish swap/replace from permanent drop
  const isSwapOrReplace = (reason: string | null): boolean =>
    !!reason && (/reemplazado/i.test(reason) || /intercambiado/i.test(reason));

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
          sessionNumber: p.session_number,
        }))
    );
  }, [assignments, hubsMap]);

  // Incompatibilities detection
  type IncompatibilityType = 'hub_conflict' | 'over_capacity' | 'conflict_team' | 'judge_deficit';
  interface Incompatibility {
    type: IncompatibilityType;
    severity: 'error' | 'warning';
    panelCode: string;
    panelId: string;
    sessionNumber: number;
    turn: 'morning' | 'afternoon';
    description: string;
    judgeId?: string;
    judgeName?: string;
    teamId?: string;
    teamName?: string;
  }

  const incompatibilities = useMemo(() => {
    const issues: Incompatibility[] = [];
    const eventJudgesMap = new Map(eventJudges.map(j => [j.id, j]));
    for (const panel of assignments) {
      const activeTeams = (panel.judging_panel_teams || []).filter(t => t.is_active);
      const activeJudges = (panel.judging_panel_judges || []).filter(j => j.is_active);
      const teamHubIds = new Set(activeTeams.map(t => t.teams?.hub_id).filter(Boolean) as string[]);
      const teamIds = new Set(activeTeams.map(t => t.team_id));

      // Hub conflicts
      for (const j of activeJudges) {
        const judgeHubId = j.profiles?.hub_id;
        if (judgeHubId && teamHubIds.has(judgeHubId)) {
          const judgeName = `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim();
          const hubName = hubsMap[judgeHubId] || 'desconocido';
          issues.push({
            type: 'hub_conflict',
            severity: 'warning',
            panelCode: panel.panel_code,
            panelId: panel.id,
            sessionNumber: panel.session_number,
            turn: panel.turn as 'morning' | 'afternoon',
            description: `Juez "${judgeName}" comparte hub "${hubName}" con equipo(s) del panel`,
            judgeId: j.judge_id,
            judgeName,
          });
        }
      }

      // Conflict team IDs
      for (const j of activeJudges) {
        const judgeData = eventJudgesMap.get(j.judge_id);
        if (!judgeData?.conflictTeamIds?.length) continue;
        for (const conflictTid of judgeData.conflictTeamIds) {
          if (teamIds.has(conflictTid)) {
            const judgeName = `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim();
            const conflictTeam = activeTeams.find(t => t.team_id === conflictTid);
            issues.push({
              type: 'conflict_team',
              severity: 'error',
              panelCode: panel.panel_code,
              panelId: panel.id,
              sessionNumber: panel.session_number,
              turn: panel.turn as 'morning' | 'afternoon',
              description: `Juez "${judgeName}" tiene incompatibilidad declarada con equipo "${conflictTeam?.teams?.name || conflictTid}"`,
              judgeId: j.judge_id,
              judgeName,
              teamId: conflictTid,
              teamName: conflictTeam?.teams?.name || undefined,
            });
          }
        }
      }

      // Over-capacity (teams per subsession)
      const sub1Active = activeTeams.filter(t => t.subsession === 1).length;
      const sub2Active = activeTeams.filter(t => t.subsession === 2).length;
      const teamsPerGroup = config?.teams_per_group || 999;
      if (sub1Active > teamsPerGroup || sub2Active > teamsPerGroup) {
        issues.push({
          type: 'over_capacity',
          severity: 'warning',
          panelCode: panel.panel_code,
          panelId: panel.id,
          sessionNumber: panel.session_number,
          turn: panel.turn as 'morning' | 'afternoon',
          description: `Panel excede capacidad: Sub1=${sub1Active}, Sub2=${sub2Active} (máx ${teamsPerGroup})`,
        });
      }

      // Judge deficit
      const judgesPerGroup = config?.judges_per_group || 0;
      if (judgesPerGroup > 0 && activeJudges.length < judgesPerGroup) {
        issues.push({
          type: 'judge_deficit',
          severity: 'error',
          panelCode: panel.panel_code,
          panelId: panel.id,
          sessionNumber: panel.session_number,
          turn: panel.turn as 'morning' | 'afternoon',
          description: `Panel tiene ${activeJudges.length}/${judgesPerGroup} jueces`,
        });
      }
    }
    return issues;
  }, [assignments, eventJudges, hubsMap, config]);

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
    const judgeData = eventJudges.find(j => j.id === judge.judgeId);
    setJudgeManageDialog({
      open: true,
      judgeId: judge.judgeId,
      judgeName: judge.judgeName,
      hubName: judge.hubName,
      panelJudgeId: judge.panelJudgeId,
      panelId: judge.panelId,
      panelCode: judge.panelCode,
      comments: judgeData?.comments ?? null,
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
      setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null });
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
  const handleDragStart = (e: React.DragEvent, teamId: string, teamName: string, category: string, hubId?: string | null) => {
    setDragTeam({ teamId, teamName, category, hubId: hubId || null });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', teamId);
  };

  const handleDragOver = (e: React.DragEvent, panelId: string, subsession: number) => {
    if (dragTeam) {
      // Hub conflict: block drop if team shares hub with a judge
      if (getPanelHubConflict(panelId, dragTeam.hubId)) {
        e.dataTransfer.dropEffect = 'none';
        setDropTarget({ panelId, subsession });
        return;
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

    // Hub conflict validation (hard block)
    const hubConflictMsg = getPanelHubConflict(panelId, dragTeam.hubId);
    if (hubConflictMsg) {
      toast.error(hubConflictMsg, { duration: 6000 });
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
    const rows = [['Panel', 'Sesión', 'Aula', 'Turno', 'Tipo', 'Nombre', 'HUB', 'Código', 'Subsesión', 'Orden', 'Estado', 'Cambio Manual', 'Comentario', 'Modificado por', 'Fecha modificación']];
    for (const panel of assignments) {
      for (const j of panel.judging_panel_judges || []) {
        const profileName = j.manual_change_by_profile ? `${j.manual_change_by_profile.first_name} ${j.manual_change_by_profile.last_name}`.trim() : '';
        const judgeHubId = j.profiles?.hub_id || '';
        rows.push([
          panel.panel_code,
          String(panel.session_number),
          String(panel.room_number),
          panel.turn === 'morning' ? 'Mañana' : 'Tarde',
          'Juez',
          `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim(),
          judgeHubId ? (hubsMap[judgeHubId] || '') : '',
          '',
          '',
          '',
          j.is_active ? 'Activo' : isSwapOrReplace(j.deactivated_reason) ? 'Cambio' : 'Baja',
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
        const teamHubId = t.teams?.hub_id || '';
        rows.push([
          panel.panel_code,
          String(panel.session_number),
          String(panel.room_number),
          panel.turn === 'morning' ? 'Mañana' : 'Tarde',
          'Equipo',
          t.teams?.name || '',
          teamHubId ? (hubsMap[teamHubId] || '') : '',
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
    const rows = [['Nombre', 'Email', 'HUB', 'Panel', 'Aula', 'Sesión', 'Turno', 'Estado', 'Comentario', 'Modificado por']];
    for (const j of allJudgeRows) {
      const profileName = j.manualByProfile ? `${j.manualByProfile.first_name} ${j.manualByProfile.last_name}`.trim() : '';
      rows.push([
        j.judgeName,
        j.email,
        j.hubName || '',
        j.panelCode,
        String(j.room),
        String(j.session),
        j.turn === 'morning' ? 'Mañana' : 'Tarde',
        j.isActive ? 'Activo' : isSwapOrReplace(j.deactivatedReason) ? 'Cambio' : 'Baja',
        j.manualComment || '',
        profileName,
      ]);
    }
    downloadCSV(rows, 'listado-jueces');
  };

  const exportTeamsCSV = () => {
    const rows = [['Código', 'Nombre Equipo', 'Categoría', 'HUB', 'Panel', 'Aula', 'Sesión', 'Subsesión', 'Turno', 'Orden', 'Estado', 'Comentario']];
    const sorted = [...allTeamRows].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
    for (const t of sorted) {
      rows.push([
        t.teamCode,
        t.teamName,
        t.category,
        t.hubId ? (hubsMap[t.hubId] || '') : '',
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

  // Excel export — visual layout matching the grid
  const exportScheduleExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Escaleta');

    const configRooms = config?.total_rooms || 1;
    const allRooms = Array.from({ length: configRooms }, (_, i) => i + 1);
    const colCount = allRooms.length + 1; // +1 for label column

    // Styles
    const greenHeader: Partial<ExcelJS.Fill> = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16a34a' } };
    const greenLight: Partial<ExcelJS.Fill> = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0fdf4' } };
    const turnBanner: Partial<ExcelJS.Fill> = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803d' } };
    const separatorFill: Partial<ExcelJS.Fill> = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdcfce7' } };
    const whiteFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFd1d5db' } },
      left: { style: 'thin', color: { argb: 'FFd1d5db' } },
      bottom: { style: 'thin', color: { argb: 'FFd1d5db' } },
      right: { style: 'thin', color: { argb: 'FFd1d5db' } },
    };
    const catBg: Record<string, string> = {
      senior: 'FF3b82f6',
      junior: 'FFf59e0b',
      beginner: 'FF22c55e',
    };

    // Column widths
    ws.getColumn(1).width = 14;
    for (let i = 2; i <= colCount; i++) ws.getColumn(i).width = 35;

    // Header row — Aulas
    const headerRow = ws.addRow(['', ...allRooms.map(r => `Aula ${r}`)]);
    headerRow.height = 26;
    headerRow.eachCell((cell, colNum) => {
      cell.fill = greenHeader as ExcelJS.Fill;
      cell.font = { ...whiteFont, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder as ExcelJS.Borders;
      if (colNum === 1) cell.value = '';
    });

    // Helper: format teams as rich text lines inside a cell
    const fillTeamCell = (cell: ExcelJS.Cell, teams: typeof assignments[0]['judging_panel_teams']) => {
      if (!teams || teams.length === 0) return;
      const sorted = [...teams].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const lines = sorted.map(t => {
        const hub = t.teams?.hub_id ? hubsMap[t.teams.hub_id] : '';
        return `${t.team_code}  ${t.teams?.name || ''}${hub ? '  ' + hub : ''}`;
      });
      cell.value = lines.join('\n');
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.font = { size: 9 };
      cell.border = thinBorder as ExcelJS.Borders;
    };

    // Helper: format judges as text lines
    const fillJudgesHeader = (cell: ExcelJS.Cell, panel: typeof assignments[0]) => {
      const judges = (panel.judging_panel_judges || []).filter(j => j.is_active);
      if (judges.length === 0) { cell.value = ''; return; }
      const lines = judges.map(j => {
        const name = `${j.profiles?.first_name || ''} ${j.profiles?.last_name || ''}`.trim();
        const hub = j.profiles?.hub_id ? hubsMap[j.profiles.hub_id] : '';
        return `${name}${hub ? '  (' + hub + ')' : ''}`;
      });
      cell.value = lines.join('\n');
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.font = { size: 8, italic: true, color: { argb: 'FF6b7280' } };
      cell.border = thinBorder as ExcelJS.Borders;
    };

    // Iterate sessions
    let prevTurn: string | undefined;
    for (const session of sessions) {
      const sessionPanels = filteredPanels
        .filter(p => p.session_number === session)
        .sort((a, b) => a.room_number - b.room_number);
      const sessionTurn = sessionPanels[0]?.turn || 'morning';
      const isFirstOfTurn = !prevTurn || prevTurn !== sessionTurn;
      prevTurn = sessionTurn;

      // Turn banner
      if (isFirstOfTurn) {
        const turnRow = ws.addRow([sessionTurn === 'morning' ? 'TURNO MAÑANA' : 'TURNO TARDE']);
        ws.mergeCells(turnRow.number, 1, turnRow.number, colCount);
        turnRow.height = 24;
        turnRow.getCell(1).fill = turnBanner as ExcelJS.Fill;
        turnRow.getCell(1).font = { ...whiteFont, size: 11 };
        turnRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Session + Panel codes row
      const panelCodesRow = ws.addRow([
        `Sesión ${session}`,
        ...allRooms.map(room => {
          const panel = sessionPanels.find(p => p.room_number === room);
          return panel?.panel_code || '';
        }),
      ]);
      panelCodesRow.height = 22;
      panelCodesRow.eachCell((cell) => {
        cell.fill = greenLight as ExcelJS.Fill;
        cell.font = { bold: true, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder as ExcelJS.Borders;
      });
      panelCodesRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

      // Judges row
      const judgesRow = ws.addRow([
        'Jueces',
        ...allRooms.map(() => ''),
      ]);
      for (const room of allRooms) {
        const panel = sessionPanels.find(p => p.room_number === room);
        if (panel) fillJudgesHeader(judgesRow.getCell(room + 1), panel);
      }
      judgesRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF6b7280' } };
      judgesRow.getCell(1).alignment = { vertical: 'top' };
      judgesRow.getCell(1).border = thinBorder as ExcelJS.Borders;

      // Sub 1
      const sub1Row = ws.addRow([
        'Sub 1',
        ...allRooms.map(() => ''),
      ]);
      for (const room of allRooms) {
        const panel = sessionPanels.find(p => p.room_number === room);
        if (panel) {
          const teams = (panel.judging_panel_teams || []).filter(t => t.subsession === 1 && t.is_active);
          fillTeamCell(sub1Row.getCell(room + 1), teams);
        }
      }
      sub1Row.getCell(1).font = { size: 9, color: { argb: 'FF6b7280' } };
      sub1Row.getCell(1).alignment = { vertical: 'top' };
      sub1Row.getCell(1).border = thinBorder as ExcelJS.Borders;

      // Separator
      const sepRow = ws.addRow(Array(colCount).fill(''));
      sepRow.height = 4;
      sepRow.eachCell(cell => { cell.fill = separatorFill as ExcelJS.Fill; });

      // Sub 2
      const sub2Row = ws.addRow([
        'Sub 2',
        ...allRooms.map(() => ''),
      ]);
      for (const room of allRooms) {
        const panel = sessionPanels.find(p => p.room_number === room);
        if (panel) {
          const teams = (panel.judging_panel_teams || []).filter(t => t.subsession === 2 && t.is_active);
          fillTeamCell(sub2Row.getCell(room + 1), teams);
        }
      }
      sub2Row.getCell(1).font = { size: 9, color: { argb: 'FF6b7280' } };
      sub2Row.getCell(1).alignment = { vertical: 'top' };
      sub2Row.getCell(1).border = thinBorder as ExcelJS.Borders;

      // Gap between sessions
      const gapRow = ws.addRow(Array(colCount).fill(''));
      gapRow.height = 8;
    }

    // ============================================================
    // Flat sheet: Jueces (filterable, one judge per row)
    // ============================================================
    const wsJ = wb.addWorksheet('Jueces');
    wsJ.columns = [
      { header: 'Panel', key: 'panel', width: 14 },
      { header: 'Sesión', key: 'session', width: 8 },
      { header: 'Aula', key: 'room', width: 8 },
      { header: 'Turno', key: 'turn', width: 10 },
      { header: 'Nombre Juez', key: 'name', width: 30 },
      { header: 'HUB Juez', key: 'hub', width: 20 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Cambio Manual', key: 'manual', width: 14 },
      { header: 'Comentario', key: 'comment', width: 30 },
      { header: 'Modificado por', key: 'modifiedBy', width: 24 },
      { header: 'Fecha modificación', key: 'modifiedAt', width: 16 },
    ];
    const sortedJudges = [...allJudgeRows].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.session !== b.session) return a.session - b.session;
      if (a.room !== b.room) return a.room - b.room;
      return a.judgeName.localeCompare(b.judgeName);
    });
    for (const j of sortedJudges) {
      const modifiedBy = j.manualByProfile ? `${j.manualByProfile.first_name} ${j.manualByProfile.last_name}`.trim() : '';
      wsJ.addRow({
        panel: j.panelCode,
        session: j.session,
        room: j.room,
        turn: j.turn === 'morning' ? 'Mañana' : 'Tarde',
        name: j.judgeName,
        hub: j.hubName || '',
        email: j.email,
        status: j.isActive ? 'Activo' : isSwapOrReplace(j.deactivatedReason) ? 'Cambio' : 'Baja',
        manual: j.assignmentType === 'manual' ? 'Sí' : 'No',
        comment: j.manualComment || '',
        modifiedBy,
        modifiedAt: j.manualAt ? new Date(j.manualAt).toLocaleDateString('es-ES') : '',
      });
    }
    wsJ.getRow(1).eachCell(cell => {
      cell.fill = greenHeader as ExcelJS.Fill;
      cell.font = { ...whiteFont, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder as ExcelJS.Borders;
    });
    wsJ.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: wsJ.columns.length } };

    // ============================================================
    // Flat sheet: Equipos (filterable, one team per row)
    // ============================================================
    const wsE = wb.addWorksheet('Equipos');
    wsE.columns = [
      { header: 'Panel', key: 'panel', width: 14 },
      { header: 'Sesión', key: 'session', width: 8 },
      { header: 'Aula', key: 'room', width: 8 },
      { header: 'Turno', key: 'turn', width: 10 },
      { header: 'Sub', key: 'sub', width: 6 },
      { header: 'Orden', key: 'order', width: 8 },
      { header: 'Código', key: 'code', width: 10 },
      { header: 'Nombre Equipo', key: 'name', width: 30 },
      { header: 'Categoría', key: 'category', width: 12 },
      { header: 'HUB Equipo', key: 'hub', width: 20 },
      { header: 'Estado', key: 'status', width: 10 },
      { header: 'Cambio Manual', key: 'manual', width: 14 },
      { header: 'Comentario', key: 'comment', width: 30 },
      { header: 'Modificado por', key: 'modifiedBy', width: 24 },
      { header: 'Fecha modificación', key: 'modifiedAt', width: 16 },
    ];
    const sortedTeams = [...allTeamRows].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.session !== b.session) return a.session - b.session;
      if (a.room !== b.room) return a.room - b.room;
      if (a.subsession !== b.subsession) return a.subsession - b.subsession;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
    for (const t of sortedTeams) {
      const modifiedBy = t.manualByProfile ? `${t.manualByProfile.first_name} ${t.manualByProfile.last_name}`.trim() : '';
      wsE.addRow({
        panel: t.panelCode,
        session: t.session,
        room: t.room,
        turn: t.turn === 'morning' ? 'Mañana' : 'Tarde',
        sub: t.subsession,
        order: t.displayOrder || 0,
        code: t.teamCode,
        name: t.teamName,
        category: t.category,
        hub: t.hubId ? (hubsMap[t.hubId] || '') : '',
        status: t.isActive ? 'Activo' : 'Baja',
        manual: t.assignmentType === 'manual' ? 'Sí' : 'No',
        comment: t.manualComment || '',
        modifiedBy,
        modifiedAt: t.manualAt ? new Date(t.manualAt).toLocaleDateString('es-ES') : '',
      });
    }
    wsE.getRow(1).eachCell(cell => {
      cell.fill = greenHeader as ExcelJS.Fill;
      cell.font = { ...whiteFont, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder as ExcelJS.Borders;
    });
    wsE.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: wsE.columns.length } };

    // Download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escaleta-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==========================================================================
  // Accreditation exports — Jueces y Niñas/Mentores
  // ==========================================================================

  const handleExportJudgeAccreditations = async () => {
    if (!eventId) return;
    if (exportingJudgesRef.current) return;
    exportingJudgesRef.current = true;
    setIsExportingJudges(true);
    try {
      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .select('name')
        .eq('id', eventId)
        .single();
      if (eventError) throw eventError;
      const eventName = eventRow?.name?.trim() || 'evento';

      const { data: turnRows, error: turnError } = await supabase
        .from('event_teams')
        .select('turn')
        .eq('event_id', eventId)
        .order('turn', { ascending: true })
        .limit(1);
      if (turnError) throw turnError;
      let turnLabel = '';
      if (!turnRows || turnRows.length === 0) {
        toast.warning('No hay equipos vinculados al evento; la columna Turno quedará vacía.');
      } else {
        turnLabel = mapTurn(turnRows[0]?.turn);
      }

      const { data: judgeRows, error: judgesError } = await supabase
        .from('judge_assignments')
        .select('user_id, is_active, judge_excluded, profiles!judge_assignments_user_id_fkey(first_name, last_name)')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .eq('judge_excluded', false);
      if (judgesError) throw judgesError;

      let skippedCount = 0;
      const rows = (judgeRows || [])
        .map((r: any) => {
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return {
            turno: turnLabel,
            nombre: safeName(profile?.first_name, profile?.last_name),
            apellidoSort: (profile?.last_name ?? '').toString(),
            nombreSort: (profile?.first_name ?? '').toString(),
            perfil: 'Juez',
          };
        })
        .filter(r => {
          if (r.nombre === '') {
            skippedCount += 1;
            console.warn('[acreditaciones] juez con first_name y last_name vacíos, omitido');
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          const c = a.apellidoSort.localeCompare(b.apellidoSort, 'es', { sensitivity: 'base', numeric: true });
          if (c !== 0) return c;
          return a.nombreSort.localeCompare(b.nombreSort, 'es', { sensitivity: 'base', numeric: true });
        });

      if (skippedCount > 0) {
        toast.warning(`${skippedCount} juez(ces) omitido(s) por falta de nombre y apellido.`);
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Hoja1');
      ws.addRow(['Turno', 'Nombre y apellidos', 'Perfil']);
      for (const r of rows) ws.addRow([r.turno, r.nombre, r.perfil]);
      const buffer = await wb.xlsx.writeBuffer();

      const filename = `Acreditaciones-jueces-${sanitizeFilename(eventName)}-${todayMadridDate()}.xlsx`;
      triggerXlsxDownload(buffer as ArrayBuffer, filename);
    } catch (err: any) {
      toast.error('No se pudo generar el Excel de acreditaciones de jueces', {
        description: err?.message ?? String(err),
      });
    } finally {
      setIsExportingJudges(false);
      exportingJudgesRef.current = false;
    }
  };

  const handleExportTeamMembersAccreditations = async () => {
    if (!eventId) return;
    if (exportingTeamsRef.current) return;
    exportingTeamsRef.current = true;
    setIsExportingTeams(true);
    try {
      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .select('name')
        .eq('id', eventId)
        .single();
      if (eventError) throw eventError;
      const eventName = eventRow?.name?.trim() || 'evento';

      const { data: eventTeams, error: eventTeamsError } = await supabase
        .from('event_teams')
        .select('team_id, team_code, turn, teams!inner(name)')
        .eq('event_id', eventId);
      if (eventTeamsError) throw eventTeamsError;

      if (!eventTeams || eventTeams.length === 0) {
        toast.error('No hay equipos vinculados al evento');
        return;
      }

      const turnLabel = mapTurn((eventTeams[0] as any)?.turn);

      const teamById = new Map<string, { code: string; name: string }>();
      const teamIds: string[] = [];
      for (const et of eventTeams as any[]) {
        if (!et.team_id) {
          console.warn('[acreditaciones] event_team sin team_id, omitido', et);
          continue;
        }
        const teamRel = Array.isArray(et.teams) ? et.teams[0] : et.teams;
        teamById.set(et.team_id, {
          code: et.team_code ?? '',
          name: teamRel?.name ?? '',
        });
        teamIds.push(et.team_id);
      }

      if (teamIds.length === 0) {
        toast.error('No hay equipos válidos vinculados al evento');
        return;
      }

      const { data: memberRows, error: membersError } = await supabase
        .from('team_members')
        .select('team_id, member_type, profiles:user_id(first_name, last_name)')
        .in('team_id', teamIds)
        .in('member_type', ['participant', 'mentor']);
      if (membersError) throw membersError;

      let skippedCount = 0;
      const rows = (memberRows || [])
        .map((m: any) => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          const team = teamById.get(m.team_id);
          const nombre = (profile?.first_name ?? '').toString();
          const apellidos = (profile?.last_name ?? '').toString();
          return {
            teamId: m.team_id as string,
            turno: turnLabel,
            nombre: nombre.trim() === '' ? '' : nombre,
            apellidos: apellidos.trim() === '' ? '' : apellidos,
            perfil: m.member_type === 'mentor' ? 'Mentor' : 'Niña participante',
            equipo: team?.code ?? '',
            nombreEquipo: team?.name ?? '',
            _memberType: m.member_type as string,
          };
        })
        .filter(r => {
          if (r.nombre === '' && r.apellidos === '') {
            skippedCount += 1;
            console.warn('[acreditaciones] persona sin nombre ni apellidos, omitido', { teamId: r.teamId, perfil: r.perfil });
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          // Tiebreak con team_id si team_code está vacío para que orfan rows no colapsen.
          const aCode = a.equipo || '￿' + a.teamId;
          const bCode = b.equipo || '￿' + b.teamId;
          const c1 = aCode.localeCompare(bCode, 'es', { sensitivity: 'base', numeric: true });
          if (c1 !== 0) return c1;
          // mentores antes que participantes dentro del mismo equipo
          const rank = (t: string) => (t === 'mentor' ? 0 : 1);
          const c2 = rank(a._memberType) - rank(b._memberType);
          if (c2 !== 0) return c2;
          const c3 = a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base', numeric: true });
          if (c3 !== 0) return c3;
          return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true });
        });

      if (skippedCount > 0) {
        toast.warning(`${skippedCount} persona(s) omitida(s) por falta de nombre y apellidos.`);
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Hoja1');
      ws.addRow(['Turno', 'Nombre', 'Apellidos', 'Perfil', 'Equipo', 'Nombre Equipo']);
      for (const r of rows) {
        ws.addRow([r.turno, r.nombre, r.apellidos, r.perfil, r.equipo, r.nombreEquipo]);
      }
      const buffer = await wb.xlsx.writeBuffer();

      const filename = `Acreditaciones-ninas-mentores-${sanitizeFilename(eventName)}-${todayMadridDate()}.xlsx`;
      triggerXlsxDownload(buffer as ArrayBuffer, filename);
    } catch (err: any) {
      toast.error('No se pudo generar el Excel de acreditaciones de niñas y mentores', {
        description: err?.message ?? String(err),
      });
    } finally {
      setIsExportingTeams(false);
      exportingTeamsRef.current = false;
    }
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
    // Hub conflict check for drop visual
    const hubConflict = dragTeam ? !!getPanelHubConflict(panel.id, dragTeam.hubId) : false;

    return (
      <div
        className={`min-h-[28px] px-1 py-0.5 transition-colors ${
          isOver
            ? hubConflict
              ? 'bg-amber-50 ring-2 ring-inset ring-amber-400'
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
                  hubsMap={hubsMap}
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
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="hide-inactive" className="text-sm text-muted-foreground whitespace-nowrap">
                Ocultar bajas/cambios
              </label>
              <Switch
                id="hide-inactive"
                checked={hideInactive}
                onCheckedChange={setHideInactive}
              />
            </div>
            <div className="flex items-center gap-3 border rounded-md px-3 py-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {turnFilters.size === 0 && (
                <span className="text-sm text-muted-foreground">Todos los turnos</span>
              )}
              {(['morning', 'afternoon'] as const).map(turn => (
                <label key={turn} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={turnFilters.has(turn)}
                    onChange={() => toggleTurnFilter(turn)}
                    className="rounded"
                  />
                  {turn === 'morning' ? 'Mañana' : 'Tarde'}
                </label>
              ))}
            </div>
            {geoFilterOptions.chapters.length > 0 && (
              <Select value={chapterFilter} onValueChange={setChapterFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Chapter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los chapters</SelectItem>
                  {geoFilterOptions.chapters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {geoFilterOptions.states.length > 0 && (
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Comunidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las comunidades</SelectItem>
                  {geoFilterOptions.states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {geoFilterOptions.cities.length > 0 && (
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Ciudad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ciudades</SelectItem>
                  {geoFilterOptions.cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
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
                          <th key={room} className="px-4 py-2 text-center font-semibold border-l border-green-500 min-w-[220px]">
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
                    const team = pt.teams as { id: string; name: string; hub_id?: string | null } | null;
                    return (
                      <div
                        key={pt.team_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, pt.team_id, team?.name || pt.team_code, pt.category, team?.hub_id)}
                        onDragEnd={handleDragEnd}
                        className="flex items-center gap-1.5 px-2 py-1 border border-amber-300 rounded bg-white cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      >
                        <Badge variant="outline" className={`font-mono text-[10px] px-1 py-0 shrink-0 ${catColors[pt.category] || ''}`}>
                          {pt.team_code}
                        </Badge>
                        <span className="text-xs truncate max-w-[150px]">{team?.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDropTeamDialog({ open: true, teamId: pt.team_id, teamName: team?.name || pt.team_code }); }}
                          className="ml-1 p-0.5 rounded hover:bg-red-100 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                          title="Dar de baja"
                          draggable={false}
                        >
                          <UserMinus className="h-3 w-3 text-destructive" />
                        </button>
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
                      <TableHead>HUB</TableHead>
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
                      .filter(t => turnFilters.size === 0 || turnFilters.has(t.turn))
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
                          <TableCell>{t.hubId ? hubsMap[t.hubId] || '—' : '—'}</TableCell>
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
                  .filter(g => turnFilters.size === 0 || turnFilters.has(g.turn))
                  .map(turnData => (
                    <div key={turnData.turn} className="border rounded-lg overflow-x-auto">
                      <div className="bg-emerald-700 text-white px-3 py-2 font-bold text-sm">
                        TURNO {turnData.turnLabel.toUpperCase()}
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-blue-100">
                            <th className="px-3 py-2 text-left w-[120px] border-r font-semibold sticky left-0 bg-blue-100 z-20" />
                            {turnData.sessions[0]?.rooms.map(room => {
                              const visibleCount = (hideInactive
                                ? room.judges.filter(j => j.isActive)
                                : room.judges
                              ).filter(j => matchesGeoFilter(j)).length;
                              return (
                                <th key={room.roomNumber} className="px-4 py-2 text-center font-semibold border-l min-w-[200px]">
                                  Aula {room.roomNumber}
                                  <span className="ml-1 font-normal text-muted-foreground">
                                    {hideInactive
                                      ? `(${visibleCount})`
                                      : `(${visibleCount}/${config?.judges_per_group || '?'})`
                                    }
                                  </span>
                                </th>
                              );
                            })}
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
                                const getVisibleJudges = (judges: typeof room.judges) => {
                                  let result = hideInactive ? judges.filter(j => j.isActive) : judges;
                                  return result.filter(j => matchesGeoFilter(j));
                                };
                                const maxJudges = Math.max(...session.rooms.map(r => getVisibleJudges(r.judges).length), 1);
                                return Array.from({ length: maxJudges }, (_, rowIdx) => (
                                  <tr key={`s${session.sessionNumber}-j-${rowIdx}`} className="border-b hover:bg-blue-50/30">
                                    {rowIdx === 0 ? (
                                      <td rowSpan={maxJudges} className="px-3 py-1 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[11px]">
                                        Jueces
                                      </td>
                                    ) : null}
                                    {session.rooms.map(room => {
                                      const visibleJudges = getVisibleJudges(room.judges);
                                      const judge = visibleJudges[rowIdx];
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
                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                              <div className="flex items-center gap-1">
                                                {isSwapOrReplace(judge.deactivatedReason) ? (
                                                  <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800 border-amber-300">CAMBIO</Badge>
                                                ) : (
                                                  <Badge variant="destructive" className="text-[9px] px-1 py-0">BAJA</Badge>
                                                )}
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleReactivateJudge(judge.judgeId); }}
                                                  className="p-0.5 rounded hover:bg-green-100"
                                                >
                                                  <UserPlus className="h-3 w-3 text-green-600" />
                                                </button>
                                              </div>
                                              {isSwapOrReplace(judge.deactivatedReason) && (
                                                <span className="text-[9px] text-muted-foreground">desde S.{judge.session}</span>
                                              )}
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
                            setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null });
                            setSelectedJudgeId(j.id);
                            setAddJudgeDialog({ open: true, panelId: '', panelCode: '' });
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

                {bajaJudges.length > 0 && (
                  <div className="border border-red-200 bg-red-50/50 rounded-lg p-4 mt-3">
                    <h4 className="text-sm font-bold text-red-800 mb-3">
                      Bajas del evento ({bajaJudges.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {bajaJudges.map(j => (
                        <Badge key={j.id} variant="destructive" className="opacity-75 gap-1">
                          {j.name}
                          {j.hubId && hubsMap[j.hubId] && (
                            <span className="ml-1 opacity-75">({hubsMap[j.hubId]})</span>
                          )}
                          <button
                            onClick={() => handleReactivateJudge(j.id)}
                            className="ml-1 hover:opacity-100 opacity-70"
                            title="Reactivar juez"
                          >
                            <UserPlus className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {unassignedOnboardingPendingJudges.length > 0 && (
                  <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-4 mt-3">
                    <h4 className="text-sm font-bold text-orange-800 mb-3">
                      Pendientes de onboarding ({unassignedOnboardingPendingJudges.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {unassignedOnboardingPendingJudges.map(j => (
                        <Badge
                          key={j.id}
                          variant="outline"
                          className="cursor-pointer border-orange-300 bg-orange-100 text-orange-900 hover:bg-orange-200"
                          onClick={() => {
                            setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null });
                            setSelectedJudgeId(j.id);
                            setAddJudgeDialog({ open: true, panelId: '', panelCode: '' });
                          }}
                        >
                          {j.name}
                          {j.hubId && hubsMap[j.hubId] && (
                            <span className="ml-1 text-orange-700">({hubsMap[j.hubId]})</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {bajaTeams.length > 0 && (
                  <div className="border border-red-200 bg-red-50/50 rounded-lg p-4 mt-3">
                    <h4 className="text-sm font-bold text-red-800 mb-3">
                      Equipos de baja ({bajaTeams.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {bajaTeams.map(et => (
                        <Badge key={et.id} variant="destructive" className="opacity-75 gap-1">
                          {(et.teams as { name?: string } | null)?.name || et.team_code}
                          <button
                            onClick={() => handleReactivateTeam(et.team_id)}
                            className="ml-1 hover:opacity-100 opacity-70"
                            title="Reactivar equipo"
                          >
                            <UserPlus className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Accreditation Exports — independientes de assignments, solo requieren evento */}
        {eventId && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJudgeAccreditations}
              disabled={isExportingJudges}
              aria-busy={isExportingJudges}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {isExportingJudges ? 'Generando…' : 'Acreditaciones Jueces'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTeamMembersAccreditations}
              disabled={isExportingTeams}
              aria-busy={isExportingTeams}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {isExportingTeams ? 'Generando…' : 'Acreditaciones Niñas/Mentores'}
            </Button>
          </div>
        )}

        {/* Export Buttons */}
        {assignments.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Button variant="default" onClick={exportScheduleExcel} disabled={hubsMapLoading} className="bg-green-700 hover:bg-green-800">
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={exportScheduleCSV} disabled={hubsMapLoading}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV Completo
            </Button>
            <Button variant="outline" onClick={exportJudgesCSV} disabled={hubsMapLoading}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Listado de Jueces
            </Button>
            <Button variant="outline" onClick={exportTeamsCSV} disabled={hubsMapLoading}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Listado de Equipos
            </Button>
            <Button
              variant="outline"
              onClick={() => setIncompDialog(true)}
              className={incompatibilities.length > 0 ? 'border-red-300 text-red-700 hover:bg-red-50' : ''}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Incompatibilidades
              {incompatibilities.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                  {incompatibilities.length}
                </Badge>
              )}
            </Button>
          </div>
        )}

        {/* ============ Dialogs ============ */}

        {/* Deactivate Judge Dialog */}
        <Dialog
          open={deactivateDialog.open}
          onOpenChange={(open) => {
            if (!open) setDeactivateDialog({ open: false, panelJudgeId: '', judgeName: '' });
            else setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null });
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
            else setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null });
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {addJudgeDialog.panelCode
                  ? `Añadir juez a ${addJudgeDialog.panelCode}`
                  : 'Añadir juez al panel'}
              </DialogTitle>
              <DialogDescription>
                Selecciona el panel destino y un juez no asignado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Panel destino</Label>
                <Select
                  value={addJudgeDialog.panelId}
                  onValueChange={(v) => {
                    const panel = assignments.find(p => p.id === v);
                    setAddJudgeDialog(prev => ({
                      ...prev,
                      panelId: v,
                      panelCode: panel?.panel_code ?? '',
                    }));
                  }}
                >
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
                    {unassignedOnboardingPendingJudges.map(j => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.name} ({j.email}) — pendiente de onboarding
                      </SelectItem>
                    ))}
                    {unassignedJudges.length === 0 && unassignedOnboardingPendingJudges.length === 0 && (
                      <SelectItem value="_none" disabled>
                        No hay jueces sin asignar
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motivo del cambio (opcional)</Label>
                <Textarea
                  value={addJudgeComment}
                  onChange={(e) => setAddJudgeComment(e.target.value)}
                  placeholder="Motivo del cambio (opcional)"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setAddJudgeDialog({ open: false, panelId: '', panelCode: '' }); setAddJudgeComment(''); }}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddJudge} disabled={!selectedJudgeId || !addJudgeDialog.panelId || isAddingJudge}>
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
            else setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null });
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
            if (!open) setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null });
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

            {judgeManageDialog.comments && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="font-medium text-muted-foreground">Comentario del juez:</span>
                <p className="mt-0.5">{judgeManageDialog.comments}</p>
              </div>
            )}

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
                            {' — '}{j.panelCode} · S.{j.sessionNumber}
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
                onClick={() => setJudgeManageDialog({ open: false, judgeId: '', judgeName: '', hubName: null, panelJudgeId: '', panelId: '', panelCode: '', comments: null })}
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

        {/* Incompatibilities Dialog */}
        <Dialog open={incompDialog} onOpenChange={setIncompDialog}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Incompatibilidades detectadas ({incompatibilities.length})</DialogTitle>
              <DialogDescription>
                Revisa y resuelve manualmente cada conflicto.
              </DialogDescription>
            </DialogHeader>
            {incompatibilities.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No se detectaron incompatibilidades.</p>
            ) : (
              <div className="space-y-3">
                {incompatibilities.map((inc, i) => (
                  <div key={`${inc.panelId}-${inc.type}-${inc.judgeId || ''}-${inc.teamId || ''}-${i}`} className={`p-3 rounded-lg border ${inc.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge className={inc.severity === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                        {inc.type === 'hub_conflict' ? 'Conflicto Hub' :
                         inc.type === 'conflict_team' ? 'Incompatibilidad Declarada' :
                         inc.type === 'over_capacity' ? 'Sobre-capacidad' : 'Déficit Jueces'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {inc.panelCode} · S.{inc.sessionNumber} · {inc.turn === 'morning' ? 'Mañana' : 'Tarde'}
                      </span>
                    </div>
                    <p className="text-sm">{inc.description}</p>
                    {(inc.type === 'hub_conflict' || inc.type === 'conflict_team') && inc.judgeId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setIncompDialog(false);
                          const judgeRow = allJudgeRows.find(
                            j => j.judgeId === inc.judgeId && j.panelId === inc.panelId && j.isActive
                          );
                          if (judgeRow) {
                            openJudgeManageDialog(judgeRow);
                          } else {
                            toast.error('Juez no encontrado en el panel. Es posible que los datos hayan cambiado.');
                          }
                        }}
                      >
                        Gestionar juez
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
