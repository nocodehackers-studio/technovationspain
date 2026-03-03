import { useParams, Link } from 'react-router-dom';
import { useAllTeamsPreferences, useWorkshopPreferences } from '@/hooks/useWorkshopPreferences';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
  ClipboardList,
  Check,
  Clock,
  Download,
  Pencil,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { Workshop } from '@/types/database';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable workshop item for admin preferences dialog
function SortableWorkshopItem({
  workshop,
  index,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  workshop: Workshop;
  index: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workshop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-card border rounded-lg ${
        isDragging ? 'shadow-lg ring-2 ring-primary' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Badge variant="secondary" className="w-7 h-7 flex items-center justify-center shrink-0 text-xs">
        {index + 1}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{workshop.name}</p>
        {workshop.description && (
          <p className="text-xs text-muted-foreground truncate">{workshop.description}</p>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onMoveUp} disabled={isFirst}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onMoveDown} disabled={isLast}>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminWorkshopPreferences() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const { data: teamsData, isLoading } = useAllTeamsPreferences(eventId || '');
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Edit preferences state
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editOrderedWorkshops, setEditOrderedWorkshops] = useState<Workshop[]>([]);

  const {
    workshops,
    teamPreferences,
    isLoading: prefsLoading,
    submitPreferences,
    updatePreferences,
    isSubmitting,
    isUpdating,
  } = useWorkshopPreferences(eventId || '', editingTeamId || undefined);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Initialize ordered workshops when edit dialog opens and data loads
  useEffect(() => {
    if (!editDialogOpen || !workshops || workshops.length === 0) return;

    if (teamPreferences && teamPreferences.length > 0) {
      // Sort workshops by existing preference order
      const prefsMap = new Map(teamPreferences.map(p => [p.workshop_id, p.preference_order]));
      const sorted = [...workshops].sort((a, b) => {
        const orderA = prefsMap.get(a.id) ?? 999;
        const orderB = prefsMap.get(b.id) ?? 999;
        return orderA - orderB;
      });
      setEditOrderedWorkshops(sorted);
    } else {
      setEditOrderedWorkshops([...workshops]);
    }
  }, [editDialogOpen, workshops, teamPreferences]);

  const validatedTeams = teamsData?.filter(t => t.validated) || [];
  const teamsWithPrefs = validatedTeams.filter(t => t.hasPreferences).length;
  const totalTeams = validatedTeams.length;
  const progressPercentage = totalTeams > 0 ? (teamsWithPrefs / totalTeams) * 100 : 0;

  const handleExportCSV = () => {
    if (validatedTeams.length === 0) return;

    const headers = ['Equipo', 'Categoría', 'Estado', 'Enviado por', 'Fecha envío', 'Pref 1', 'Pref 2', 'Pref 3', 'Pref 4', 'Pref 5', 'Pref 6', 'Pref 7'];
    const rows = validatedTeams.map(team => {
      const prefs = team.preferencesData?.preferences || [];
      const prefNames: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const pref = prefs.find(p => p.order === i);
        prefNames.push(pref?.workshopName || '');
      }

      return [
        team.name,
        team.category || '',
        team.hasPreferences ? 'Enviado' : 'Pendiente',
        team.preferencesData?.submittedBy || '',
        team.preferencesData?.submittedAt
          ? format(new Date(team.preferencesData.submittedAt), 'dd/MM/yyyy HH:mm')
          : '',
        ...prefNames,
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

    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `preferencias-talleres-${event?.name || 'evento'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenEditDialog = (teamId: string) => {
    setEditingTeamId(teamId);
    setEditOrderedWorkshops([]);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingTeamId(null);
    setEditOrderedWorkshops([]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEditOrderedWorkshops((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      setEditOrderedWorkshops((items) => arrayMove(items, index, index - 1));
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < editOrderedWorkshops.length - 1) {
      setEditOrderedWorkshops((items) => arrayMove(items, index, index + 1));
    }
  };

  const handleSavePreferences = async () => {
    if (!editingTeamId || !user?.id || editOrderedWorkshops.length === 0) return;

    const orderedWorkshopIds = editOrderedWorkshops.map(w => w.id);
    const teamData = validatedTeams.find(t => t.id === editingTeamId);

    try {
      if (teamData?.hasPreferences) {
        await updatePreferences({ orderedWorkshopIds, userId: user.id });
      } else {
        await submitPreferences({ orderedWorkshopIds, userId: user.id });
      }
      handleCloseEditDialog();
    } catch (error) {
      // Error handled in hook via toast
    }
  };

  const editingTeamData = validatedTeams.find(t => t.id === editingTeamId);

  return (
    <AdminLayout title="Estado de Preferencias">
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
                <ClipboardList className="h-6 w-6" />
                Estado de Preferencias
              </h1>
              <p className="text-muted-foreground">{event?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExportCSV} disabled={validatedTeams.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Progress Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resumen</CardTitle>
            <CardDescription>
              {teamsWithPrefs} de {totalTeams} equipos han enviado preferencias ({Math.round(progressPercentage)}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>{teamsWithPrefs} enviadas</span>
              <span>{totalTeams - teamsWithPrefs} pendientes</span>
            </div>
          </CardContent>
        </Card>

        {/* Teams Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Equipos</CardTitle>
            <CardDescription>
              Click en un equipo para ver sus preferencias detalladas, o usa el botón de edición para gestionar preferencias
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : validatedTeams.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Participantes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead className="w-[60px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell
                        className="font-medium cursor-pointer hover:underline"
                        onClick={() => {
                          setSelectedTeam(team);
                          setDetailDialogOpen(true);
                        }}
                      >
                        {team.name}
                      </TableCell>
                      <TableCell>
                        {team.category ? (
                          <Badge variant="outline">{team.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{team.participantCount}</TableCell>
                      <TableCell>
                        {team.hasPreferences ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Check className="mr-1 h-3 w-3" />
                            Enviado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="mr-1 h-3 w-3" />
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {team.preferencesData?.submittedAt ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(team.preferencesData.submittedAt), "d MMM HH:mm", { locale: es })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditDialog(team.id);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay equipos registrados para este evento.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog (read-only view) */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Preferencias: {selectedTeam?.name}</DialogTitle>
              <DialogDescription>
                {selectedTeam?.hasPreferences ? (
                  <>
                    Enviado por: {selectedTeam.preferencesData?.submittedBy}
                    <br />
                    Fecha: {selectedTeam.preferencesData?.submittedAt &&
                      format(new Date(selectedTeam.preferencesData.submittedAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                  </>
                ) : (
                  'Este equipo aún no ha enviado sus preferencias'
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedTeam?.hasPreferences && selectedTeam.preferencesData?.preferences && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Orden de preferencia:</p>
                <div className="space-y-2">
                  {selectedTeam.preferencesData.preferences
                    .sort((a: any, b: any) => a.order - b.order)
                    .map((pref: any) => (
                      <div
                        key={pref.order}
                        className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                      >
                        <Badge variant="secondary" className="shrink-0">
                          {pref.order}
                        </Badge>
                        <span className="text-sm">{pref.workshopName}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Preferences Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) handleCloseEditDialog(); }}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {editingTeamData?.hasPreferences ? 'Editar' : 'Enviar'} Preferencias: {editingTeamData?.name}
              </DialogTitle>
              <DialogDescription>
                Ordena los talleres arrastrando o usando las flechas. El orden 1 es el más prioritario.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-2">
              {prefsLoading || editOrderedWorkshops.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={editOrderedWorkshops.map(w => w.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {editOrderedWorkshops.map((workshop, index) => (
                        <SortableWorkshopItem
                          key={workshop.id}
                          workshop={workshop}
                          index={index}
                          onMoveUp={() => handleMoveUp(index)}
                          onMoveDown={() => handleMoveDown(index)}
                          isFirst={index === 0}
                          isLast={index === editOrderedWorkshops.length - 1}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseEditDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleSavePreferences}
                disabled={isSubmitting || isUpdating || editOrderedWorkshops.length === 0}
              >
                {isSubmitting || isUpdating ? 'Guardando...' : 'Guardar Preferencias'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
