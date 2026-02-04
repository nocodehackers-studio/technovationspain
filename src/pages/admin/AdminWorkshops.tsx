import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
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
  Calendar
} from "lucide-react";
import { Workshop, WorkshopTimeSlot } from "@/types/database";

export default function AdminWorkshops() {
  const { eventId } = useParams();
  const queryClient = useQueryClient();
  
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<WorkshopTimeSlot | null>(null);
  const [workshopDialogOpen, setWorkshopDialogOpen] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [deleteWorkshopDialogOpen, setDeleteWorkshopDialogOpen] = useState(false);
  const [deleteSlotDialogOpen, setDeleteSlotDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch event
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['admin-event', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data } = await supabase
        .from('events')
        .select('id, name, date, event_type')
        .eq('id', eventId)
        .single();
      return data;
    },
    enabled: !!eventId,
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
  } = useWorkshopTimeSlots(eventId || '');

  // Fetch workshops
  const { data: workshops, isLoading: workshopsLoading } = useQuery({
    queryKey: ["event-workshops", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("*")
        .eq("event_id", eventId)
        .order("name");

      if (error) throw error;
      return data as Workshop[];
    },
    enabled: !!eventId,
  });

  // Create workshop mutation
  const createWorkshopMutation = useMutation({
    mutationFn: async (workshop: Omit<Workshop, "id" | "created_at" | "current_registrations">) => {
      const { error } = await supabase.from("workshops").insert(workshop);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-workshops", eventId] });
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
      queryClient.invalidateQueries({ queryKey: ["event-workshops", eventId] });
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
      queryClient.invalidateQueries({ queryKey: ["event-workshops", eventId] });
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
        await createSlot({ event_id: eventId!, ...data });
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

  if (!eventId) {
    return (
      <AdminLayout title="Talleres">
        <div className="text-center py-12 text-muted-foreground">
          Selecciona un evento para gestionar sus talleres
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
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/admin/events/${eventId}/edit`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
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
              <Link to={`/admin/events/${eventId}/workshops/preferences`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Estado Preferencias
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/admin/events/${eventId}/workshops/assign`}>
                <Shuffle className="mr-2 h-4 w-4" />
                Asignar
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/admin/events/${eventId}/workshops/schedule`}>
                <Calendar className="mr-2 h-4 w-4" />
                Cuadrante
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Turnos</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{slotCount}</div>
              <p className="text-xs text-muted-foreground">
                turnos horarios configurados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Talleres</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workshopCount}</div>
              <p className="text-xs text-muted-foreground">
                talleres simultáneos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Aforo Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCapacity}</div>
              <p className="text-xs text-muted-foreground">
                plazas por turno
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info about how it works */}
        <Card className="bg-muted/50 border-muted-foreground/20">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-foreground">
                <p className="font-medium mb-1">¿Cómo funciona?</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li><strong className="text-foreground">{workshopCount} talleres</strong> se realizan <strong className="text-foreground">simultáneamente</strong> en cada turno</li>
                  <li>Hay <strong className="text-foreground">{slotCount} turnos horarios</strong> a lo largo del evento</li>
                  <li>Cada equipo será asignado a <strong className="text-foreground">2 talleres diferentes</strong> en turnos distintos</li>
                  <li>Los mentores eligen sus <strong className="text-foreground">preferencias</strong> y el algoritmo asigna automáticamente</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="slots" className="space-y-4">
          <TabsList>
            <TabsTrigger value="slots" className="gap-2">
              <Clock className="h-4 w-4" />
              Turnos Horarios
            </TabsTrigger>
            <TabsTrigger value="workshops" className="gap-2">
              <Layers className="h-4 w-4" />
              Talleres
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
              <Button onClick={handleCreateSlot}>
                <Plus className="mr-2 h-4 w-4" />
                Añadir Turno
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : timeSlots && timeSlots.length > 0 ? (
              <div className="grid gap-3">
                {timeSlots.map((slot) => (
                  <Card key={slot.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            Turno {slot.slot_number}
                          </Badge>
                          <div>
                            <p className="font-mono text-lg font-medium">
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {workshopCount} talleres simultáneos
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSlot(slot)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSlot(slot)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No hay turnos configurados</p>
                  <Button className="mt-4" onClick={handleCreateSlot}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear primer turno
                  </Button>
                </CardContent>
              </Card>
            )}
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

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : workshops && workshops.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workshops.map((workshop) => (
                  <Card key={workshop.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base font-semibold">
                            {workshop.name}
                          </CardTitle>
                          {workshop.company && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {workshop.company}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditWorkshop(workshop)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteWorkshop(workshop)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {workshop.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{workshop.location}</span>
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Aforo</span>
                          <span className="font-medium">{workshop.max_capacity} personas</span>
                        </div>
                        <CapacityBar
                          current={workshop.current_registrations || 0}
                          max={workshop.max_capacity}
                          size="sm"
                        />
                      </div>

                      {workshop.category && (
                        <Badge variant="outline" className="text-xs">
                          {workshop.category}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No hay talleres configurados</p>
                  <Button className="mt-4" onClick={handleCreateWorkshop}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear primer taller
                  </Button>
                </CardContent>
              </Card>
            )}
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
            onSubmit={(data) => {
              if (isEditMode && selectedWorkshop) {
                updateWorkshopMutation.mutate({
                  workshopId: selectedWorkshop.id,
                  updates: data,
                });
              } else {
                createWorkshopMutation.mutate({
                  ...data,
                  event_id: eventId!,
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
  onSubmit,
  loading,
}: {
  workshop?: Workshop | null;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
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
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Descripción breve del taller..."
            defaultValue={workshop?.description || ""}
            rows={3}
          />
        </div>
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
