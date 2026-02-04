import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useWorkshopTimeSlots } from "@/hooks/useWorkshopTimeSlots";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { CapacityBar } from "@/components/admin/CapacityBar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  Layers, 
  ArrowLeft,
  Building2,
  MapPin,
  Users,
  AlertTriangle,
  Shuffle,
  BarChart3,
  Calendar,
  CalendarDays
} from "lucide-react";
import { Workshop, WorkshopTimeSlot } from "@/types/database";

export default function AdminWorkshops() {
  const { eventId } = useParams();
  const queryClient = useQueryClient();
  
  // State for selected event when no eventId in URL
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  // Effective event ID: from URL or selected
  const effectiveEventId = eventId || selectedEventId;
  
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<WorkshopTimeSlot | null>(null);
  const [workshopDialogOpen, setWorkshopDialogOpen] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [deleteWorkshopDialogOpen, setDeleteWorkshopDialogOpen] = useState(false);
  const [deleteSlotDialogOpen, setDeleteSlotDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch all events for selector (only when no eventId in URL)
  const { data: allEvents, isLoading: allEventsLoading } = useQuery({
    queryKey: ['all-events-for-workshops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, 
          name, 
          date, 
          event_type,
          workshops:workshops(count),
          time_slots:workshop_time_slots(count)
        `)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !eventId,
  });

  // Fetch event
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['admin-event', effectiveEventId],
    queryFn: async () => {
      if (!effectiveEventId) return null;
      const { data } = await supabase
        .from('events')
        .select('id, name, date, event_type')
        .eq('id', effectiveEventId)
        .single();
      return data;
    },
    enabled: !!effectiveEventId,
  });

  // Use the time slots hook
  const { 
    timeSlots, 
    isLoading: timeSlotsLoading,
    createSlot,
    updateSlot,
    deleteSlot,
    isCreating: isCreatingSlot,
    isUpdating: isUpdatingSlot,
    isDeleting: isDeletingSlot,
  } = useWorkshopTimeSlots(effectiveEventId || '');

  // Fetch workshops
  const { data: workshops, isLoading: workshopsLoading } = useQuery({
    queryKey: ["event-workshops", effectiveEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("*")
        .eq("event_id", effectiveEventId)
        .order("name");

      if (error) throw error;
      return data as Workshop[];
    },
    enabled: !!effectiveEventId,
  });

  // Create workshop mutation
  const createWorkshopMutation = useMutation({
    mutationFn: async (workshop: Omit<Workshop, "id" | "created_at" | "current_registrations">) => {
      const { error } = await supabase.from("workshops").insert(workshop);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-workshops", effectiveEventId] });
      toast.success("Taller creado correctamente");
      setWorkshopDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update workshop mutation
  const updateWorkshopMutation = useMutation({
    mutationFn: async ({
      workshopId,
      updates,
  }: {
      workshopId: string;
      updates: Partial<Workshop>;
    }) => {
      const { error } = await supabase
        .from("workshops")
        .update(updates)
        .eq("id", workshopId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-workshops", effectiveEventId] });
      toast.success("Taller actualizado correctamente");
      setWorkshopDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete workshop mutation
  const deleteWorkshopMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      const { error } = await supabase.from("workshops").delete().eq("id", workshopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-workshops", effectiveEventId] });
      toast.success("Taller eliminado correctamente");
      setDeleteWorkshopDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleCreateWorkshop = () => {
    setSelectedWorkshop(null);
    setIsEditMode(false);
    setWorkshopDialogOpen(true);
  };

  const handleEditWorkshop = (workshop: Workshop) => {
    setSelectedWorkshop(workshop);
    setIsEditMode(true);
    setWorkshopDialogOpen(true);
  };

  const handleDeleteWorkshop = (workshop: Workshop) => {
    setSelectedWorkshop(workshop);
    setDeleteWorkshopDialogOpen(true);
  };

  const handleCreateSlot = () => {
    setSelectedSlot(null);
    setIsEditMode(false);
    setSlotDialogOpen(true);
  };

  const handleEditSlot = (slot: WorkshopTimeSlot) => {
    setSelectedSlot(slot);
    setIsEditMode(true);
    setSlotDialogOpen(true);
  };

  const handleDeleteSlot = (slot: WorkshopTimeSlot) => {
    setSelectedSlot(slot);
    setDeleteSlotDialogOpen(true);
  };

  const handleSlotSubmit = async (data: { slot_number: number; start_time: string; end_time: string }) => {
    try {
      if (isEditMode && selectedSlot) {
        await updateSlot({ slotId: selectedSlot.id, updates: data });
      } else {
        await createSlot({ event_id: effectiveEventId!, ...data });
      }
      setSlotDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleConfirmDeleteSlot = async () => {
    if (selectedSlot) {
      try {
        await deleteSlot(selectedSlot.id);
        setDeleteSlotDialogOpen(false);
      } catch (error) {
        // Error handled in hook
      }
    }
  };

  const isLoading = eventLoading || timeSlotsLoading || workshopsLoading;

  // Calculate stats
  const totalCapacity = workshops?.reduce((sum, w) => sum + w.max_capacity, 0) || 0;
  const workshopCount = workshops?.length || 0;
  const slotCount = timeSlots?.length || 0;

  // Show event selector when no eventId
  if (!effectiveEventId) {
    return (
      <AdminLayout title="Talleres">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="h-6 w-6" />
              Talleres
            </h1>
            <p className="text-muted-foreground mt-1">
              Selecciona un evento para ver y gestionar sus talleres
            </p>
          </div>

          {/* Event Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecciona un Evento</CardTitle>
              <CardDescription>
                Elige el evento del que quieres gestionar los talleres
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allEventsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : allEvents && allEvents.length > 0 ? (
                <div className="grid gap-3">
                  {allEvents.map((evt) => {
                    const workshopCount = (evt.workshops as any)?.[0]?.count || 0;
                    const slotCount = (evt.time_slots as any)?.[0]?.count || 0;
                    
                    return (
                      <Card 
                        key={evt.id} 
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => setSelectedEventId(evt.id)}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <CalendarDays className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold">{evt.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(evt.date), "d 'de' MMMM, yyyy", { locale: es })}
                                  {evt.event_type && (
                                    <Badge variant="outline" className="ml-2">
                                      {evt.event_type}
                                    </Badge>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Layers className="h-4 w-4" />
                                <span>{workshopCount} talleres</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{slotCount} turnos</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay eventos disponibles</p>
                  <Button className="mt-4" asChild>
                    <Link to="/admin/events">
                      <Plus className="mr-2 h-4 w-4" />
                      Crear un evento
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gestión de Talleres">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (selectedEventId && !eventId) {
                  setSelectedEventId(null);
                }
              }}
              asChild={!!eventId}
            >
              {eventId ? (
                <Link to={`/admin/events/${effectiveEventId}/edit`}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              ) : (
                <span><ArrowLeft className="h-5 w-5" /></span>
              )}
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Layers className="h-6 w-6" />
                Talleres
              </h1>
              <p className="text-muted-foreground">{event?.name}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/admin/events/${effectiveEventId}/workshops/preferences`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Estado Preferencias
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/admin/events/${effectiveEventId}/workshops/assign`}>
                <Shuffle className="mr-2 h-4 w-4" />
                Asignar
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/admin/events/${effectiveEventId}/workshops/schedule`}>
                <Calendar className="mr-2 h-4 w-4" />
                Cuadrante
              </Link>
            </Button>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="workshops" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workshops" className="gap-2">
              <Layers className="h-4 w-4" />
              Talleres ({workshopCount})
            </TabsTrigger>
            <TabsTrigger value="slots" className="gap-2">
              <Clock className="h-4 w-4" />
              Turnos Horarios ({slotCount})
            </TabsTrigger>
          </TabsList>

          {/* Time Slots Tab */}
          <TabsContent value="slots" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Turnos Horarios</h2>
                <p className="text-sm text-muted-foreground">
                  Define los bloques horarios en los que se realizarán los talleres
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-[60px_1fr_1fr_40px] gap-4 text-sm font-medium text-muted-foreground px-2">
                    <span>Turno</span>
                    <span>Hora inicio</span>
                    <span>Hora fin</span>
                    <span></span>
                  </div>
                  
                  {/* Slots list */}
                  {timeSlots && timeSlots.map((slot) => (
                    <div 
                      key={slot.id} 
                      className="grid grid-cols-[60px_1fr_1fr_40px] gap-4 items-center p-2 rounded-lg hover:bg-muted/50"
                    >
                      <Badge variant="secondary" className="justify-center">
                        T{slot.slot_number}
                      </Badge>
                      <Input
                        type="time"
                        defaultValue={slot.start_time.slice(0, 5)}
                        className="font-mono"
                        onBlur={(e) => {
                          if (e.target.value !== slot.start_time.slice(0, 5)) {
                            updateSlot({ 
                              slotId: slot.id, 
                              updates: { start_time: e.target.value + ':00' } 
                            });
                          }
                        }}
                      />
                      <Input
                        type="time"
                        defaultValue={slot.end_time.slice(0, 5)}
                        className="font-mono"
                        onBlur={(e) => {
                          if (e.target.value !== slot.end_time.slice(0, 5)) {
                            updateSlot({ 
                              slotId: slot.id, 
                              updates: { end_time: e.target.value + ':00' } 
                            });
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSlot(slot)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* Add new slot row */}
                  <div className="pt-2 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handleCreateSlot}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Añadir Turno {(timeSlots?.length || 0) + 1}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workshops Tab */}
          <TabsContent value="workshops" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Talleres Disponibles</h2>
                <p className="text-sm text-muted-foreground">
                  Estos talleres se realizan simultáneamente en cada turno
                </p>
              </div>
              <Button onClick={handleCreateWorkshop}>
                <Plus className="mr-2 h-4 w-4" />
                Añadir Taller
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : workshops && workshops.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-medium text-muted-foreground border-b uppercase tracking-wide">
                          <th className="pb-2 pr-3">Nombre</th>
                          <th className="pb-2 pr-3">Empresa</th>
                          <th className="pb-2 pr-3">Sala</th>
                          <th className="pb-2 pr-3 text-center w-16">Aforo</th>
                          <th className="pb-2 pr-3">Turnos</th>
                          <th className="pb-2 w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {workshops.map((workshop) => (
                          <tr 
                            key={workshop.id} 
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => handleEditWorkshop(workshop)}
                          >
                            <td className="py-2 pr-3">
                              <span className="font-medium">{workshop.name}</span>
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {workshop.company || '-'}
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {workshop.location || '-'}
                            </td>
                            <td className="py-2 pr-3 text-center">
                              {workshop.max_capacity}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1">
                                {timeSlots && timeSlots.length > 0 ? (
                                  timeSlots.map((slot) => (
                                    <Badge 
                                      key={slot.id} 
                                      variant="secondary"
                                      className="text-xs font-normal px-1.5 py-0"
                                    >
                                      T{slot.slot_number}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditWorkshop(workshop)}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteWorkshop(workshop)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No hay talleres configurados</p>
                    <Button className="mt-4" onClick={handleCreateWorkshop}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear primer taller
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Workshop Form Dialog */}
      <Dialog open={workshopDialogOpen} onOpenChange={setWorkshopDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Editar Taller" : "Crear Taller"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? "Modifica los datos del taller"
                : "Añade un nuevo taller al evento"}
            </DialogDescription>
          </DialogHeader>
          <WorkshopForm
            workshop={selectedWorkshop}
            timeSlots={timeSlots || []}
            onSubmit={(data) => {
              if (isEditMode && selectedWorkshop) {
                updateWorkshopMutation.mutate({
                  workshopId: selectedWorkshop.id,
                  updates: data,
                });
              } else {
                createWorkshopMutation.mutate({
                  ...data,
                  event_id: effectiveEventId!,
                });
              }
            }}
            loading={createWorkshopMutation.isPending || updateWorkshopMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Time Slot Form Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Editar Turno" : "Crear Turno"}
            </DialogTitle>
            <DialogDescription>
              Define el horario de este turno
            </DialogDescription>
          </DialogHeader>
          <TimeSlotForm
            slot={selectedSlot}
            existingSlots={timeSlots || []}
            onSubmit={handleSlotSubmit}
            loading={isCreatingSlot || isUpdatingSlot}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Workshop Confirmation */}
      <ConfirmDialog
        open={deleteWorkshopDialogOpen}
        onOpenChange={setDeleteWorkshopDialogOpen}
        title="¿Eliminar taller?"
        description={`Esta acción eliminará permanentemente "${selectedWorkshop?.name}" y todas las preferencias/asignaciones asociadas.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => selectedWorkshop && deleteWorkshopMutation.mutate(selectedWorkshop.id)}
        loading={deleteWorkshopMutation.isPending}
      />

      {/* Delete Slot Confirmation */}
      <ConfirmDialog
        open={deleteSlotDialogOpen}
        onOpenChange={setDeleteSlotDialogOpen}
        title="¿Eliminar turno?"
        description={`Esta acción eliminará el Turno ${selectedSlot?.slot_number} y todas las asignaciones en ese horario.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleConfirmDeleteSlot}
        loading={isDeletingSlot}
      />
    </AdminLayout>
  );
}

// Workshop Form Component
function WorkshopForm({
  workshop,
  timeSlots,
  onSubmit,
  loading,
}: {
  workshop?: Workshop | null;
  timeSlots: WorkshopTimeSlot[];
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  // All slots selected by default (current model: all workshops in all slots)
  const [selectedSlots, setSelectedSlots] = useState<string[]>(
    timeSlots.map(s => s.id)
  );

  const handleSlotToggle = (slotId: string) => {
    setSelectedSlots(prev => 
      prev.includes(slotId) 
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId]
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          name: formData.get("name") as string,
          company: formData.get("company") as string || null,
          category: formData.get("category") as string || null,
          max_capacity: parseInt(formData.get("max_capacity") as string) || 20,
          location: formData.get("location") as string || null,
          description: formData.get("description") as string || null,
          // selectedSlots is ready for future use
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del taller *</Label>
          <Input
            id="name"
            name="name"
            placeholder="Ej: Ética e IA"
            defaultValue={workshop?.name || ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Empresa/Patrocinador</Label>
          <Input
            id="company"
            name="company"
            placeholder="Ej: Santander"
            defaultValue={workshop?.company || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Sala/Ubicación</Label>
          <Input
            id="location"
            name="location"
            placeholder="Ej: Sala 1"
            defaultValue={workshop?.location || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_capacity">Aforo Máximo *</Label>
          <Input
            id="max_capacity"
            name="max_capacity"
            type="number"
            min="1"
            placeholder="30"
            defaultValue={workshop?.max_capacity || 30}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Categoría (opcional)</Label>
          <Select name="category" defaultValue={workshop?.category || ""}>
            <SelectTrigger>
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General (todas)</SelectItem>
              <SelectItem value="beginner">Beginner (8-12)</SelectItem>
              <SelectItem value="junior">Junior (13-15)</SelectItem>
              <SelectItem value="senior">Senior (16-18)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Time Slots Selector */}
      {timeSlots.length > 0 && (
        <div className="space-y-3">
          <Label>Turnos en los que se imparte</Label>
          <div className="rounded-md border p-3 space-y-2">
            {timeSlots.map((slot) => (
              <label
                key={slot.id}
                className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-md -mx-2"
              >
                <Checkbox
                  checked={selectedSlots.includes(slot.id)}
                  onCheckedChange={() => handleSlotToggle(slot.id)}
                />
                <span className="text-sm">
                  Turno {slot.slot_number} ({slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)})
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Por ahora, todos los talleres se imparten en todos los turnos
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Descripción breve del taller..."
          defaultValue={workshop?.description || ""}
          rows={3}
        />
      </div>
      
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : workshop ? "Actualizar" : "Crear Taller"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Time Slot Form Component
function TimeSlotForm({
  slot,
  existingSlots,
  onSubmit,
  loading,
}: {
  slot?: WorkshopTimeSlot | null;
  existingSlots: WorkshopTimeSlot[];
  onSubmit: (data: { slot_number: number; start_time: string; end_time: string }) => void;
  loading: boolean;
}) {
  const nextSlotNumber = slot?.slot_number || (existingSlots.length > 0 
    ? Math.max(...existingSlots.map(s => s.slot_number)) + 1 
    : 1);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          slot_number: parseInt(formData.get("slot_number") as string),
          start_time: formData.get("start_time") as string,
          end_time: formData.get("end_time") as string,
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slot_number">Número de Turno</Label>
          <Input
            id="slot_number"
            name="slot_number"
            type="number"
            min="1"
            defaultValue={nextSlotNumber}
            required
          />
        </div>
        <div className="grid gap-4 grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start_time">Hora Inicio</Label>
            <Input
              id="start_time"
              name="start_time"
              type="time"
              defaultValue={slot?.start_time?.slice(0, 5) || "10:30"}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_time">Hora Fin</Label>
            <Input
              id="end_time"
              name="end_time"
              type="time"
              defaultValue={slot?.end_time?.slice(0, 5) || "11:15"}
              required
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : slot ? "Actualizar" : "Crear Turno"}
        </Button>
      </DialogFooter>
    </form>
  );
}
