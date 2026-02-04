import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkshopTimeSlots } from '@/hooks/useWorkshopTimeSlots';
import { Workshop } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Clock, 
  Settings,
  Building2,
  Users,
  BarChart3,
  ClipboardList,
  Shuffle
} from 'lucide-react';
import { CapacityBar } from '../CapacityBar';
import { ConfirmDialog } from '../ConfirmDialog';
import { Link } from 'react-router-dom';

interface WorkshopManagerProps {
  eventId: string;
}

export function WorkshopManager({ eventId }: WorkshopManagerProps) {
  const queryClient = useQueryClient();
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [workshopDialogOpen, setWorkshopDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [timeSlotsDialogOpen, setTimeSlotsDialogOpen] = useState(false);

  const { timeSlots, isLoading: timeSlotsLoading, saveAllSlots, isSaving } = useWorkshopTimeSlots(eventId);

  // Fetch workshops for this event
  const { data: workshops, isLoading: workshopsLoading } = useQuery({
    queryKey: ['event-workshops', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('event_id', eventId)
        .order('name');

      if (error) throw error;
      return data as Workshop[];
    },
  });

  // Create workshop mutation
  const createWorkshopMutation = useMutation({
    mutationFn: async (workshop: {
      name: string;
      company?: string | null;
      description?: string | null;
      category?: string | null;
      max_capacity: number;
      location?: string | null;
    }) => {
      const { error } = await supabase.from('workshops').insert({
        name: workshop.name,
        company: workshop.company,
        description: workshop.description,
        category: workshop.category,
        max_capacity: workshop.max_capacity,
        location: workshop.location,
        event_id: eventId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-workshops', eventId] });
      toast.success('Taller creado correctamente');
      setWorkshopDialogOpen(false);
      setSelectedWorkshop(null);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update workshop mutation
  const updateWorkshopMutation = useMutation({
    mutationFn: async ({ workshopId, updates }: { 
      workshopId: string; 
      updates: {
        name?: string;
        company?: string | null;
        description?: string | null;
        category?: string | null;
        max_capacity?: number;
        location?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from('workshops')
        .update(updates)
        .eq('id', workshopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-workshops', eventId] });
      toast.success('Taller actualizado');
      setWorkshopDialogOpen(false);
      setSelectedWorkshop(null);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete workshop mutation
  const deleteWorkshopMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      const { error } = await supabase.from('workshops').delete().eq('id', workshopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-workshops', eventId] });
      toast.success('Taller eliminado');
      setDeleteDialogOpen(false);
      setSelectedWorkshop(null);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSubmitWorkshop = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const workshopData = {
      name: formData.get('name') as string,
      company: formData.get('company') as string || null,
      description: formData.get('description') as string || null,
      category: formData.get('category') as string || null,
      max_capacity: parseInt(formData.get('max_capacity') as string) || 30,
      location: formData.get('location') as string || null,
    };

    if (selectedWorkshop) {
      updateWorkshopMutation.mutate({ workshopId: selectedWorkshop.id, updates: workshopData });
    } else {
      createWorkshopMutation.mutate(workshopData);
    }
  };

  const categoryColors: Record<string, string> = {
    beginner: 'bg-green-100 text-green-800 border-green-200',
    junior: 'bg-blue-100 text-blue-800 border-blue-200',
    senior: 'bg-purple-100 text-purple-800 border-purple-200',
    general: 'bg-muted text-muted-foreground border-muted-foreground/20',
  };

  const categoryLabels: Record<string, string> = {
    beginner: 'Beginner',
    junior: 'Junior',
    senior: 'Senior',
    general: 'General',
  };

  return (
    <div className="space-y-6">
      {/* Time Slots Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Turnos Horarios
              </CardTitle>
              <CardDescription>
                Define los turnos en los que se impartirán los talleres
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTimeSlotsDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Configurar Turnos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {timeSlotsLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : timeSlots && timeSlots.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {timeSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="px-4 py-2 bg-muted rounded-lg flex items-center gap-2"
                >
                  <Badge variant="outline">Turno {slot.slot_number}</Badge>
                  <span className="font-mono text-sm">
                    {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No hay turnos configurados. Configura los turnos antes de añadir talleres.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Workshops Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Talleres
              </CardTitle>
              <CardDescription>
                {workshops?.length || 0} talleres configurados para este evento
              </CardDescription>
            </div>
            <Button onClick={() => { setSelectedWorkshop(null); setWorkshopDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir Taller
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {workshopsLoading ? (
            <p className="text-muted-foreground">Cargando talleres...</p>
          ) : workshops && workshops.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Taller</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Aforo/Turno</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workshops.map((workshop) => (
                  <TableRow key={workshop.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{workshop.name}</p>
                        {workshop.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {workshop.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {workshop.company ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3" />
                          {workshop.company}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {workshop.category ? (
                        <Badge variant="outline" className={categoryColors[workshop.category]}>
                          {categoryLabels[workshop.category]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="w-24">
                        <CapacityBar
                          current={workshop.current_registrations || 0}
                          max={workshop.max_capacity}
                          size="sm"
                          showPercentage={false}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{workshop.location || '—'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedWorkshop(workshop);
                            setWorkshopDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedWorkshop(workshop);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">No hay talleres configurados</p>
              <p className="text-sm text-muted-foreground">
                Añade talleres para que los equipos puedan elegir sus preferencias
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {workshops && workshops.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link to={`/admin/events/${eventId}/workshops/capacity`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Ver Ocupación
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/admin/events/${eventId}/workshops/preferences`}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Estado Preferencias
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/admin/events/${eventId}/workshops/assign`}>
              <Shuffle className="mr-2 h-4 w-4" />
              Ejecutar Asignación
            </Link>
          </Button>
        </div>
      )}

      {/* Workshop Form Dialog */}
      <Dialog open={workshopDialogOpen} onOpenChange={setWorkshopDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedWorkshop ? 'Editar Taller' : 'Añadir Taller'}
            </DialogTitle>
            <DialogDescription>
              {selectedWorkshop 
                ? 'Modifica los datos del taller'
                : 'Añade un nuevo taller al evento'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitWorkshop} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={selectedWorkshop?.name || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  name="company"
                  defaultValue={(selectedWorkshop as any)?.company || ''}
                  placeholder="Ej: Santander, Repsol..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select name="category" defaultValue={selectedWorkshop?.category || 'general'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General (todas)</SelectItem>
                    <SelectItem value="beginner">Beginner (8-12)</SelectItem>
                    <SelectItem value="junior">Junior (13-15)</SelectItem>
                    <SelectItem value="senior">Senior (16-18)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_capacity">Aforo por turno *</Label>
                <Input
                  id="max_capacity"
                  name="max_capacity"
                  type="number"
                  min="1"
                  defaultValue={selectedWorkshop?.max_capacity || 30}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="Ej: Sala A, Aula 101..."
                  defaultValue={selectedWorkshop?.location || ''}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={selectedWorkshop?.description || ''}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWorkshopDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createWorkshopMutation.isPending || updateWorkshopMutation.isPending}
              >
                {createWorkshopMutation.isPending || updateWorkshopMutation.isPending 
                  ? 'Guardando...' 
                  : selectedWorkshop ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Time Slots Dialog */}
      <TimeSlotsDialog
        open={timeSlotsDialogOpen}
        onOpenChange={setTimeSlotsDialogOpen}
        timeSlots={timeSlots || []}
        onSave={saveAllSlots}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Eliminar taller?"
        description={`Esta acción eliminará permanentemente "${selectedWorkshop?.name}" y sus asignaciones. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => selectedWorkshop && deleteWorkshopMutation.mutate(selectedWorkshop.id)}
        loading={deleteWorkshopMutation.isPending}
      />
    </div>
  );
}

// Time Slots Configuration Dialog
interface TimeSlotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeSlots: { slot_number: number; start_time: string; end_time: string }[];
  onSave: (slots: { slot_number: number; start_time: string; end_time: string }[]) => Promise<void>;
  isSaving: boolean;
}

function TimeSlotsDialog({ open, onOpenChange, timeSlots, onSave, isSaving }: TimeSlotsDialogProps) {
  const [slots, setSlots] = useState<{ slot_number: number; start_time: string; end_time: string }[]>([]);

  // Initialize when dialog opens
  useState(() => {
    if (open) {
      setSlots(timeSlots.length > 0 ? timeSlots : [
        { slot_number: 1, start_time: '10:30', end_time: '11:15' },
        { slot_number: 2, start_time: '11:30', end_time: '12:15' },
        { slot_number: 3, start_time: '12:30', end_time: '13:15' },
      ]);
    }
  });

  // Reset when timeSlots change or dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSlots(timeSlots.length > 0 ? timeSlots : [
        { slot_number: 1, start_time: '10:30', end_time: '11:15' },
        { slot_number: 2, start_time: '11:30', end_time: '12:15' },
        { slot_number: 3, start_time: '12:30', end_time: '13:15' },
      ]);
    }
    onOpenChange(newOpen);
  };

  const addSlot = () => {
    const nextNumber = slots.length + 1;
    setSlots([...slots, { slot_number: nextNumber, start_time: '', end_time: '' }]);
  };

  const removeSlot = (index: number) => {
    const newSlots = slots.filter((_, i) => i !== index).map((slot, i) => ({
      ...slot,
      slot_number: i + 1,
    }));
    setSlots(newSlots);
  };

  const updateSlot = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
  };

  const handleSave = async () => {
    // Validar que todos los turnos tengan horas
    const valid = slots.every(s => s.start_time && s.end_time);
    if (!valid) {
      toast.error('Todos los turnos deben tener hora de inicio y fin');
      return;
    }
    await onSave(slots);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Turnos Horarios</DialogTitle>
          <DialogDescription>
            Define los turnos en los que se impartirán los talleres. 
            Cada equipo será asignado a 2 de estos turnos.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {slots.map((slot, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Badge variant="secondary">Turno {slot.slot_number}</Badge>
              <Input
                type="time"
                value={slot.start_time}
                onChange={(e) => updateSlot(index, 'start_time', e.target.value)}
                className="w-28"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="time"
                value={slot.end_time}
                onChange={(e) => updateSlot(index, 'end_time', e.target.value)}
                className="w-28"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => removeSlot(index)}
                disabled={slots.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" onClick={addSlot} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Añadir Turno
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
