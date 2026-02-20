import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMentorTeams } from '@/hooks/useMentorTeams';
import { useWorkshopPreferences } from '@/hooks/useWorkshopPreferences';
import { useWorkshopPreferencesEligibility } from '@/hooks/useWorkshopPreferencesEligibility';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  GripVertical, 
  ArrowLeft, 
  Check, 
  AlertTriangle, 
  Lock, 
  Building2,
  ChevronUp,
  ChevronDown,
  Info
} from 'lucide-react';
import { Workshop } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Sortable Item Component
interface SortableWorkshopItemProps {
  workshop: Workshop;
  index: number;
  disabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function SortableWorkshopItem({ 
  workshop, 
  index, 
  disabled,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SortableWorkshopItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workshop.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 bg-card border rounded-lg ${
        isDragging ? 'shadow-lg ring-2 ring-primary' : ''
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Position Badge */}
      <Badge variant="secondary" className="w-8 h-8 flex items-center justify-center shrink-0">
        {index + 1}
      </Badge>

      {/* Workshop Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{workshop.name}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {(workshop as any).company && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {(workshop as any).company}
            </span>
          )}
          {workshop.description && (
            <span className="truncate hidden sm:inline">
              • {workshop.description}
            </span>
          )}
        </div>
      </div>

      {/* Arrow Buttons (alternative to drag) */}
      {!disabled && (
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={isFirst}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveDown}
            disabled={isLast}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function WorkshopPreferencesPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isVerified } = useAuth();
  const { data: allMentorTeams, isLoading: teamsLoading } = useMentorTeams(user?.id);
  const { eligibleTeams: eligibleForPreferences, isLoading: eligibilityLoading } = useWorkshopPreferencesEligibility(user?.id);

  // Filtrar equipos del mentor que son elegibles para ESTE evento
  const myTeams = allMentorTeams?.filter(team =>
    eligibleForPreferences.some(et => et.teamId === team.id && et.eventId === eventId)
  ) || [];

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [orderedWorkshops, setOrderedWorkshops] = useState<Workshop[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const {
    workshops,
    workshopsLoading,
    teamPreferences,
    submissionStatus,
    isLoading,
    submitPreferences,
    isSubmitting,
  } = useWorkshopPreferences(eventId || '', selectedTeamId);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Auto-select first team
  useEffect(() => {
    if (myTeams && myTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(myTeams[0].id);
    }
  }, [myTeams, selectedTeamId]);

  // Initialize ordered workshops when data loads
  useEffect(() => {
    if (workshops && workshops.length > 0 && !submissionStatus?.submitted) {
      // If preferences exist, sort by them
      if (teamPreferences && teamPreferences.length > 0) {
        const prefsMap = new Map(teamPreferences.map(p => [p.workshop_id, p.preference_order]));
        const sorted = [...workshops].sort((a, b) => {
          const orderA = prefsMap.get(a.id) ?? 999;
          const orderB = prefsMap.get(b.id) ?? 999;
          return orderA - orderB;
        });
        setOrderedWorkshops(sorted);
      } else {
        setOrderedWorkshops(workshops);
      }
    } else if (teamPreferences && teamPreferences.length > 0) {
      // If already submitted, show in order
      const prefsMap = new Map(teamPreferences.map(p => [p.workshop_id, p.preference_order]));
      const workshopsWithPrefs = (workshops || []).filter(w => prefsMap.has(w.id));
      const sorted = [...workshopsWithPrefs].sort((a, b) => {
        const orderA = prefsMap.get(a.id) ?? 999;
        const orderB = prefsMap.get(b.id) ?? 999;
        return orderA - orderB;
      });
      setOrderedWorkshops(sorted);
    }
  }, [workshops, teamPreferences, submissionStatus]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedWorkshops((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        setHasChanges(true);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      setOrderedWorkshops((items) => {
        setHasChanges(true);
        return arrayMove(items, index, index - 1);
      });
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < orderedWorkshops.length - 1) {
      setOrderedWorkshops((items) => {
        setHasChanges(true);
        return arrayMove(items, index, index + 1);
      });
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || !selectedTeamId || orderedWorkshops.length === 0) return;

    try {
      await submitPreferences({
        orderedWorkshopIds: orderedWorkshops.map(w => w.id),
        userId: user.id,
      });
      setHasChanges(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const isReadOnly = submissionStatus?.submitted || false;
  const selectedTeam = myTeams?.find(t => t.id === selectedTeamId);

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Verificación requerida</AlertTitle>
          <AlertDescription>
            Necesitas estar verificado para acceder a las preferencias de talleres.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (eventLoading || teamsLoading || eligibilityLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!myTeams || myTeams.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sin equipos asignados</AlertTitle>
            <AlertDescription>
              No tienes equipos asignados como mentor. Contacta con administración para ser asignado a un equipo.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="mb-2 text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold">Preferencias de Talleres</h1>
          <p className="text-secondary-foreground/80">
            {event?.name} • {event?.date && format(new Date(event.date), "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Team Selector */}
        {myTeams.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Selecciona Equipo</CardTitle>
              <CardDescription>
                Elige el equipo para el que quieres enviar las preferencias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Seleccionar equipo" />
                </SelectTrigger>
                <SelectContent>
                  {myTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Status Alert */}
        {isReadOnly && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Preferencias ya enviadas</AlertTitle>
            <AlertDescription>
              Las preferencias de {selectedTeam?.name} fueron enviadas por {submissionStatus?.submittedBy} 
              {submissionStatus?.submittedAt && (
                <> el {format(new Date(submissionStatus.submittedAt), "d 'de' MMMM 'a las' HH:mm", { locale: es })}</>
              )}.
              Contacta con administración si necesitas hacer cambios.
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <Alert variant="default" className="bg-muted/50 border-muted">
          <Info className="h-4 w-4" />
          <AlertTitle>Instrucciones</AlertTitle>
          <AlertDescription>
            Ordena los talleres según tu preferencia (1 = más deseado). Tu equipo será asignado a <strong>2 talleres</strong> automáticamente según disponibilidad.
            {!isReadOnly && (
              <> Arrastra los talleres o usa las flechas para reordenarlos.</>
            )}
          </AlertDescription>
        </Alert>

        {/* Workshops List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Orden de Preferencia
              {selectedTeam && (
                <Badge variant="outline" className="ml-2">{selectedTeam.name}</Badge>
              )}
            </CardTitle>
            {!isReadOnly && (
              <CardDescription>
                Arrastra para reordenar o usa las flechas ↑↓
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : orderedWorkshops.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedWorkshops.map(w => w.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {orderedWorkshops.map((workshop, index) => (
                      <SortableWorkshopItem
                        key={workshop.id}
                        workshop={workshop}
                        index={index}
                        disabled={isReadOnly}
                        onMoveUp={() => handleMoveUp(index)}
                        onMoveDown={() => handleMoveDown(index)}
                        isFirst={index === 0}
                        isLast={index === orderedWorkshops.length - 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No hay talleres disponibles para este evento.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        {!isReadOnly && orderedWorkshops.length > 0 && (
          <div className="flex justify-end gap-3">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting || !hasChanges}
            >
              {isSubmitting ? (
                'Guardando...'
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Guardar Preferencias
                </>
              )}
            </Button>
          </div>
        )}

        {/* Warning */}
        {!isReadOnly && (
          <p className="text-sm text-muted-foreground text-center">
            ⚠️ Solo puedes enviar preferencias una vez por equipo. Si necesitas hacer cambios después, contacta con administración.
          </p>
        )}
      </main>
    </div>
  );
}
