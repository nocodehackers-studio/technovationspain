import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Users, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  max_capacity: number;
  current_count: number | null;
  max_companions: number;
  companion_fields_config: string[] | null;
  allowed_roles: string[] | null;
  requires_verification: boolean | null;
  requires_team: boolean | null;
  is_active: boolean | null;
  sort_order: number | null;
}

const COMPANION_FIELDS = [
  { value: "first_name", label: "Nombre" },
  { value: "last_name", label: "Apellidos" },
  { value: "dni", label: "DNI/NIE" },
  { value: "relationship", label: "Parentesco" },
];

interface TicketTypeManagerProps {
  eventId: string;
}

const AVAILABLE_ROLES = [
  { value: "participant", label: "Participante" },
  { value: "mentor", label: "Mentor" },
  { value: "judge", label: "Juez" },
  { value: "volunteer", label: "Voluntario" },
];

export function TicketTypeManager({ eventId }: TicketTypeManagerProps) {
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
const [formData, setFormData] = useState({
    name: "",
    description: "",
    max_capacity: 100,
    max_companions: 0,
    companion_fields_config: ["first_name", "last_name", "relationship"] as string[],
    anonymous_companions: false,
    allowed_roles: [] as string[],
    requires_verification: true,
    requires_team: false,
    is_active: true,
  });

  const { data: ticketTypes, isLoading } = useQuery({
    queryKey: ["event-ticket-types", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_ticket_types")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as TicketType[];
    },
    enabled: !!eventId,
  });

const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const companionConfig = data.anonymous_companions ? [] : data.companion_fields_config;
      const { error } = await supabase.from("event_ticket_types").insert({
        event_id: eventId,
        name: data.name,
        description: data.description || null,
        max_capacity: data.max_capacity,
        max_companions: data.max_companions,
        companion_fields_config: companionConfig,
        allowed_roles: data.allowed_roles.length > 0 ? data.allowed_roles : null,
        requires_verification: data.requires_verification,
        requires_team: data.requires_team,
        is_active: data.is_active,
        sort_order: (ticketTypes?.length || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-ticket-types", eventId] });
      toast.success("Tipo de entrada creado");
      setEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const companionConfig = data.anonymous_companions ? [] : data.companion_fields_config;
      const { error } = await supabase
        .from("event_ticket_types")
        .update({
          name: data.name,
          description: data.description || null,
          max_capacity: data.max_capacity,
          max_companions: data.max_companions,
          companion_fields_config: companionConfig,
          allowed_roles: data.allowed_roles.length > 0 ? data.allowed_roles : null,
          requires_verification: data.requires_verification,
          requires_team: data.requires_team,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-ticket-types", eventId] });
      toast.success("Tipo de entrada actualizado");
      setEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_ticket_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-ticket-types", eventId] });
      toast.success("Tipo de entrada eliminado");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      max_capacity: 100,
      max_companions: 0,
      companion_fields_config: ["first_name", "last_name", "relationship"],
      anonymous_companions: false,
      allowed_roles: [],
      requires_verification: true,
      requires_team: false,
      is_active: true,
    });
    setSelectedTicket(null);
  };

const openEditDialog = (ticket?: TicketType) => {
    if (ticket) {
      setSelectedTicket(ticket);
      const configArray = ticket.companion_fields_config || ["first_name", "last_name", "relationship"];
      const isAnonymous = Array.isArray(configArray) && configArray.length === 0;
      setFormData({
        name: ticket.name,
        description: ticket.description || "",
        max_capacity: ticket.max_capacity,
        max_companions: ticket.max_companions,
        companion_fields_config: isAnonymous ? ["first_name", "last_name", "relationship"] : configArray,
        anonymous_companions: isAnonymous,
        allowed_roles: ticket.allowed_roles || [],
        requires_verification: ticket.requires_verification ?? true,
        requires_team: ticket.requires_team ?? false,
        is_active: ticket.is_active ?? true,
      });
    } else {
      resetForm();
    }
    setEditDialogOpen(true);
  };

  const toggleCompanionField = (field: string) => {
    setFormData((prev) => ({
      ...prev,
      companion_fields_config: prev.companion_fields_config.includes(field)
        ? prev.companion_fields_config.filter((f) => f !== field)
        : [...prev.companion_fields_config, field],
    }));
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (selectedTicket) {
      updateMutation.mutate({ id: selectedTicket.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      allowed_roles: prev.allowed_roles.includes(role)
        ? prev.allowed_roles.filter((r) => r !== role)
        : [...prev.allowed_roles, role],
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Cargando tipos de entrada...
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
              <CardTitle>Tipos de Entrada</CardTitle>
              <CardDescription>
                Configura los diferentes tipos de tickets para el evento
              </CardDescription>
            </div>
            <Button onClick={() => openEditDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir Tipo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ticketTypes && ticketTypes.length > 0 ? (
            <div className="space-y-4">
              {ticketTypes.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{ticket.name}</h4>
                      {!ticket.is_active && (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </div>
                    {ticket.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {ticket.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" />
                        {ticket.current_count || 0}/{ticket.max_capacity}
                      </Badge>
                      {ticket.max_companions > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <UserPlus className="h-3 w-3" />
                          Hasta {ticket.max_companions} acompañante{ticket.max_companions > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {ticket.allowed_roles && ticket.allowed_roles.length > 0 && (
                        <Badge variant="secondary">
                          {ticket.allowed_roles.map((r) => AVAILABLE_ROLES.find((ar) => ar.value === r)?.label).join(", ")}
                        </Badge>
                      )}
                      {ticket.requires_team && (
                        <Badge variant="secondary">Requiere equipo</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(ticket)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTicket(ticket);
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
              <p>No hay tipos de entrada configurados.</p>
              <p className="text-sm">Añade al menos un tipo de entrada para que los usuarios puedan registrarse.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket ? "Editar Tipo de Entrada" : "Nuevo Tipo de Entrada"}
            </DialogTitle>
            <DialogDescription>
              Configura los detalles del tipo de entrada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-name">Nombre *</Label>
              <Input
                id="ticket-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Entrada Participante"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-description">Descripción</Label>
              <Textarea
                id="ticket-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe quién puede usar esta entrada..."
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max-capacity">Capacidad máxima</Label>
                <Input
                  id="max-capacity"
                  type="number"
                  min="1"
                  value={formData.max_capacity}
                  onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-companions">Máx. acompañantes</Label>
                <Input
                  id="max-companions"
                  type="number"
                  min="0"
                  value={formData.max_companions}
                  onChange={(e) => setFormData({ ...formData, max_companions: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {formData.max_companions > 0 && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <Label>Datos requeridos de acompañantes</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonymous-companions"
                    checked={formData.anonymous_companions}
                    onCheckedChange={(checked) => setFormData({ ...formData, anonymous_companions: !!checked })}
                  />
                  <Label htmlFor="anonymous-companions" className="font-normal">
                    Sin datos (entradas anónimas)
                  </Label>
                </div>
                
                {!formData.anonymous_companions && (
                  <div className="space-y-2 pt-2">
                    <p className="text-sm text-muted-foreground">Campos a solicitar:</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {COMPANION_FIELDS.map((field) => (
                        <div key={field.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`companion-field-${field.value}`}
                            checked={formData.companion_fields_config.includes(field.value)}
                            onCheckedChange={() => toggleCompanionField(field.value)}
                          />
                          <Label htmlFor={`companion-field-${field.value}`} className="font-normal">
                            {field.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Roles permitidos</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Si no seleccionas ninguno, estará disponible para todos los roles.
              </p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role.value}`}
                      checked={formData.allowed_roles.includes(role.value)}
                      onCheckedChange={() => toggleRole(role.value)}
                    />
                    <Label htmlFor={`role-${role.value}`} className="font-normal">
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requires-verification">Requiere verificación</Label>
                  <p className="text-sm text-muted-foreground">
                    Solo usuarios verificados pueden registrarse
                  </p>
                </div>
                <Switch
                  id="requires-verification"
                  checked={formData.requires_verification}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_verification: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requires-team">Requiere equipo</Label>
                  <p className="text-sm text-muted-foreground">
                    El usuario debe pertenecer a un equipo
                  </p>
                </div>
                <Switch
                  id="requires-team"
                  checked={formData.requires_team}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_team: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is-active">Activo</Label>
                  <p className="text-sm text-muted-foreground">
                    Mostrar esta entrada en el formulario de registro
                  </p>
                </div>
                <Switch
                  id="is-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
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
                : selectedTicket
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
        title="¿Eliminar tipo de entrada?"
        description={`Esta acción eliminará "${selectedTicket?.name}". Los registros existentes con este tipo de entrada no se verán afectados.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => selectedTicket && deleteMutation.mutate(selectedTicket.id)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
