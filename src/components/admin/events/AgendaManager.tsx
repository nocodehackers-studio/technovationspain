import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, GripVertical, Clock } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  color: string | null;
  sort_order: number | null;
}

interface AgendaManagerProps {
  eventId: string;
}

const COLORS = [
  { value: "#f3f4f6", label: "Gris", class: "bg-gray-100" },
  { value: "#dbeafe", label: "Azul", class: "bg-blue-100" },
  { value: "#dcfce7", label: "Verde", class: "bg-green-100" },
  { value: "#fef3c7", label: "Amarillo", class: "bg-yellow-100" },
  { value: "#fce7f3", label: "Rosa", class: "bg-pink-100" },
  { value: "#e9d5ff", label: "Púrpura", class: "bg-purple-100" },
  { value: "#fed7aa", label: "Naranja", class: "bg-orange-100" },
];

export function AgendaManager({ eventId }: AgendaManagerProps) {
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "09:00",
    end_time: "10:00",
    color: "#f3f4f6",
  });

  const { data: agendaItems, isLoading } = useQuery({
    queryKey: ["event-agenda", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_agenda")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data as AgendaItem[];
    },
    enabled: !!eventId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("event_agenda").insert({
        event_id: eventId,
        title: data.title,
        description: data.description || null,
        start_time: data.start_time,
        end_time: data.end_time,
        color: data.color,
        sort_order: (agendaItems?.length || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-agenda", eventId] });
      toast.success("Actividad añadida");
      setEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("event_agenda")
        .update({
          title: data.title,
          description: data.description || null,
          start_time: data.start_time,
          end_time: data.end_time,
          color: data.color,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-agenda", eventId] });
      toast.success("Actividad actualizada");
      setEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_agenda").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-agenda", eventId] });
      toast.success("Actividad eliminada");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      start_time: "09:00",
      end_time: "10:00",
      color: "#f3f4f6",
    });
    setSelectedItem(null);
  };

  const openEditDialog = (item?: AgendaItem) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        title: item.title,
        description: item.description || "",
        start_time: item.start_time,
        end_time: item.end_time,
        color: item.color || "#f3f4f6",
      });
    } else {
      resetForm();
    }
    setEditDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title) {
      toast.error("El título es obligatorio");
      return;
    }
    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Cargando agenda...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agenda del Evento</CardTitle>
              <CardDescription>
                Configura las actividades y horarios del evento
              </CardDescription>
            </div>
            <Button onClick={() => openEditDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir Actividad
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {agendaItems && agendaItems.length > 0 ? (
            <div className="space-y-3">
              {agendaItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                  style={{ backgroundColor: item.color || "#f3f4f6" }}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <div className="flex items-center gap-2 text-sm font-medium min-w-[100px]">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatTime(item.start_time)} - {formatTime(item.end_time)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{item.title}</h4>
                    {item.description && (
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(item)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p>No hay actividades en la agenda.</p>
              <p className="text-sm">Añade actividades para que los asistentes conozcan el programa.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? "Editar Actividad" : "Nueva Actividad"}
            </DialogTitle>
            <DialogDescription>
              Configura los detalles de la actividad
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agenda-title">Título *</Label>
              <Input
                id="agenda-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Recepción y registro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agenda-description">Descripción</Label>
              <Textarea
                id="agenda-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles adicionales de la actividad..."
                rows={2}
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-time">Hora de inicio</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">Hora de fin</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color del bloque</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${color.class} ${
                      formData.color === color.value
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-transparent"
                    }`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Guardando..."
                : selectedItem
                ? "Actualizar"
                : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Eliminar actividad?"
        description={`Esta acción eliminará "${selectedItem?.title}" de la agenda.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
