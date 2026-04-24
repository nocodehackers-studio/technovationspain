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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Users, UserPlus, Settings, AlertTriangle, Ticket } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { generateQRCode, generateRegistrationNumber } from "@/lib/qr-generator";

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
  requires_imported_team: boolean | null;
  requires_team: boolean | null;
  is_active: boolean | null;
  sort_order: number | null;
  required_fields: string[] | null;
  for_judges: boolean;
}

const COMPANION_FIELDS = [
  { value: "first_name", label: "Nombre" },
  { value: "last_name", label: "Apellidos" },
  { value: "dni", label: "DNI/NIE" },
  { value: "relationship", label: "Parentesco" },
];

const REGISTRATION_FIELDS = [
  { value: "dni", label: "DNI/NIE" },
  { value: "phone", label: "Teléfono" },
  { value: "team_name", label: "Nombre del equipo" },
];

interface TicketTypeManagerProps {
  eventId: string;
  eventMaxCapacity?: number | null;
}

const AVAILABLE_ROLES = [
  { value: "participant", label: "Participante" },
  { value: "mentor", label: "Mentor" },
];

export function TicketTypeManager({ eventId, eventMaxCapacity }: TicketTypeManagerProps) {
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [judgeTicketConfirmOpen, setJudgeTicketConfirmOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
const [formData, setFormData] = useState({
    name: "",
    description: "",
    max_capacity: 100,
    max_companions: 0,
    companion_fields_config: ["first_name", "last_name", "relationship"] as string[],
    anonymous_companions: false,
    allowed_roles: [] as string[],
    required_fields: [] as string[],
    requires_verification: true,
    requires_team: false,
    requires_imported_team: false,
    is_active: true,
    for_judges: false,
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

  // Query eligible judges for bulk ticket generation
  const { data: eligibleJudges = [], isLoading: judgesLoading } = useQuery({
    queryKey: ["eligible-judges-for-tickets", eventId],
    queryFn: async () => {
      // Get all active, onboarded judges for this event
      const { data: judges, error: judgesError } = await supabase
        .from("judge_assignments")
        .select("id, user_id, profiles!inner(id, email, first_name, last_name)")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .eq("onboarding_completed", true);
      if (judgesError) throw judgesError;

      if (!judges || judges.length === 0) return [];

      // Get existing registrations for this event to filter out already-registered judges
      const { data: existingRegs, error: regsError } = await supabase
        .from("event_registrations")
        .select("user_id")
        .eq("event_id", eventId)
        .neq("registration_status", "cancelled");
      if (regsError) throw regsError;

      const registeredUserIds = new Set((existingRegs || []).map((r) => r.user_id));
      return judges.filter((j: any) => !registeredUserIds.has(j.user_id));
    },
    enabled: !!eventId,
  });

  const bulkJudgeTicketMutation = useMutation({
    mutationFn: async () => {
      if (eligibleJudges.length === 0) throw new Error("No hay jueces elegibles");

      // 1. Upsert "Jueces" ticket type
      const { data: existingTicketType } = await supabase
        .from("event_ticket_types")
        .select("id, max_capacity")
        .eq("event_id", eventId)
        .eq("name", "Jueces")
        .eq("for_judges", true)
        .maybeSingle();

      let ticketTypeId: string;

      if (existingTicketType) {
        ticketTypeId = existingTicketType.id;
        await supabase
          .from("event_ticket_types")
          .update({ max_capacity: (existingTicketType.max_capacity || 0) + eligibleJudges.length } as any)
          .eq("id", ticketTypeId);
      } else {
        const { data: newTicketType, error: ttError } = await supabase
          .from("event_ticket_types")
          .insert({
            event_id: eventId,
            name: "Jueces",
            description: "Entrada automática para jueces del evento",
            max_capacity: eligibleJudges.length,
            max_companions: 0,
            companion_fields_config: [],
            allowed_roles: null,
            required_fields: ["first_name", "last_name", "email"],
            requires_verification: false,
            requires_team: false,
            requires_imported_team: false,
            is_active: false,
            for_judges: true,
            sort_order: (ticketTypes?.length || 0) + 1,
          } as any)
          .select("id")
          .single();
        if (ttError) throw ttError;
        ticketTypeId = newTicketType.id;
      }

      // 2. Create registrations for each eligible judge
      const registrations = eligibleJudges.map((judge: any) => ({
        event_id: eventId,
        ticket_type_id: ticketTypeId,
        user_id: judge.user_id,
        first_name: judge.profiles.first_name || "",
        last_name: judge.profiles.last_name || "",
        email: judge.profiles.email,
        qr_code: generateQRCode(),
        registration_number: generateRegistrationNumber(),
        registration_status: "confirmed" as const,
        is_companion: false,
        image_consent: true,
        data_consent: true,
      }));

      const { data: createdRegs, error: regError } = await supabase
        .from("event_registrations")
        .insert(registrations)
        .select("id");
      if (regError) throw regError;

      // 3. Update ticket type counter (single call instead of N RPCs)
      const totalCreated = createdRegs?.length || 0;
      if (totalCreated > 0) {
        await supabase.rpc("increment_registration_count", {
          p_event_id: eventId,
          p_ticket_type_id: ticketTypeId,
          p_companions_count: totalCreated - 1,
        });
      }

      // 4. Send confirmation emails (parallel, tolerant of partial failures)
      let emailFailures = 0;
      const emailResults = await Promise.allSettled(
        (createdRegs || []).map(async (reg) => {
          const { error } = await supabase.functions.invoke("send-registration-confirmation", {
            body: { registrationId: reg.id },
          });
          if (error) throw error;
        })
      );
      emailFailures = emailResults.filter((r) => r.status === "rejected").length;

      return { total: createdRegs?.length || 0, emailFailures };
    },
    onSuccess: ({ total, emailFailures }) => {
      queryClient.invalidateQueries({ queryKey: ["event-ticket-types", eventId] });
      queryClient.invalidateQueries({ queryKey: ["eligible-judges-for-tickets", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-registrations"] });
      if (emailFailures > 0) {
        toast.warning(`Se crearon ${total} entradas pero ${emailFailures} correo(s) no se pudieron enviar.`);
      } else {
        toast.success(`Se generaron y enviaron ${total} entradas a los jueces.`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
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
        required_fields: data.required_fields.length > 0
          ? [...['first_name', 'last_name', 'email'], ...data.required_fields]
          : ['first_name', 'last_name', 'email'],
        requires_verification: data.requires_verification,
        requires_team: data.requires_team,
        requires_imported_team: data.requires_imported_team,
        is_active: data.is_active,
        for_judges: data.for_judges,
        sort_order: (ticketTypes?.length || 0) + 1,
      } as any);
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
          required_fields: data.required_fields.length > 0
            ? [...['first_name', 'last_name', 'email'], ...data.required_fields]
            : ['first_name', 'last_name', 'email'],
          requires_verification: data.requires_verification,
          requires_team: data.requires_team,
          requires_imported_team: data.requires_imported_team,
          is_active: data.is_active,
          for_judges: data.for_judges,
        } as any)
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
      required_fields: [],
      requires_verification: true,
      requires_team: false,
      requires_imported_team: false,
      is_active: true,
      for_judges: false,
    });
    setSelectedTicket(null);
  };

const openEditDialog = (ticket?: TicketType) => {
    if (ticket) {
      setSelectedTicket(ticket);
      const configArray = ticket.companion_fields_config || ["first_name", "last_name", "relationship"];
      const isAnonymous = Array.isArray(configArray) && configArray.length === 0;
      // Extract extra required fields (excluding always-required ones)
      const baseFields = ['first_name', 'last_name', 'email'];
      const extraRequired = (ticket.required_fields || []).filter(f => !baseFields.includes(f));
      setFormData({
        name: ticket.name,
        description: ticket.description || "",
        max_capacity: ticket.max_capacity,
        max_companions: ticket.max_companions,
        companion_fields_config: isAnonymous ? ["first_name", "last_name", "relationship"] : configArray,
        anonymous_companions: isAnonymous,
        allowed_roles: ticket.allowed_roles || [],
        required_fields: extraRequired,
        requires_verification: ticket.requires_verification ?? true,
        requires_team: ticket.requires_team ?? false,
        requires_imported_team: ticket.requires_imported_team ?? false,
        is_active: ticket.is_active ?? true,
        for_judges: (ticket as any).for_judges ?? false,
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

  const toggleRequiredField = (field: string) => {
    setFormData((prev) => ({
      ...prev,
      required_fields: prev.required_fields.includes(field)
        ? prev.required_fields.filter((f) => f !== field)
        : [...prev.required_fields, field],
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

  // Capacity validation calculations
  const totalTicketCapacity = ticketTypes?.reduce((sum, t) => sum + t.max_capacity, 0) || 0;
  const otherTicketsCapacity = ticketTypes
    ?.filter(t => t.id !== selectedTicket?.id)
    .reduce((sum, t) => sum + t.max_capacity, 0) || 0;
  const proposedTotal = otherTicketsCapacity + formData.max_capacity;
  const exceedsGlobalCapacity = eventMaxCapacity != null && proposedTotal > eventMaxCapacity;
  const excessAmount = exceedsGlobalCapacity ? proposedTotal - eventMaxCapacity : 0;
  const remainingCapacity = eventMaxCapacity != null ? eventMaxCapacity - otherTicketsCapacity : null;
  const capacityExceeded = eventMaxCapacity != null && totalTicketCapacity > eventMaxCapacity;

  const hasEligibleJudges = eligibleJudges.length > 0;
  const judgeTicketsSending = bulkJudgeTicketMutation.isPending;

  return (
    <>
      {/* Bulk Judge Ticket Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          <div>
            <Label
              htmlFor="judge-tickets"
              className="font-medium text-sm cursor-pointer"
            >
              Generar y enviar entradas a los jueces
            </Label>
            <p className="text-xs text-muted-foreground">
              {judgesLoading
                ? "Cargando..."
                : hasEligibleJudges
                  ? `Esta acción enviará un correo electrónico con la entrada a este evento. ${eligibleJudges.length} juez/jueces elegibles.`
                  : "No hay jueces elegibles. Todos los jueces activos con onboarding completado ya tienen entrada."}
            </p>
          </div>
        </div>
        <Switch
          id="judge-tickets"
          checked={false}
          onCheckedChange={() => setJudgeTicketConfirmOpen(true)}
          disabled={!hasEligibleJudges || judgeTicketsSending || judgesLoading}
        />
      </div>

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
          
          {/* Global capacity indicator */}
          {eventMaxCapacity != null && eventMaxCapacity > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Aforo global asignado</span>
                <span className={capacityExceeded ? "text-destructive font-medium" : ""}>
                  {totalTicketCapacity} / {eventMaxCapacity}
                </span>
              </div>
              <Progress 
                value={Math.min((totalTicketCapacity / eventMaxCapacity) * 100, 100)} 
                className={capacityExceeded ? "[&>div]:bg-destructive" : ""}
              />
              {capacityExceeded && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  La suma de capacidades supera el aforo global en {totalTicketCapacity - eventMaxCapacity} plazas
                </p>
              )}
            </div>
          )}
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
                          {ticket.allowed_roles
                            .map((r) => AVAILABLE_ROLES.find((ar) => ar.value === r)?.label)
                            .filter(Boolean)
                            .join(", ")}
                        </Badge>
                      )}
                      {(ticket as any).for_judges && (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                          Jueces
                        </Badge>
                      )}
                      {ticket.requires_team && (
                        <Badge variant="secondary">Requiere equipo</Badge>
                      )}
                      {ticket.requires_imported_team && (
                        <Badge variant="secondary">Requiere equipo importado</Badge>
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
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket ? "Editar Tipo de Entrada" : "Nuevo Tipo de Entrada"}
            </DialogTitle>
            <DialogDescription>
              Configura los detalles del tipo de entrada
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="companions" disabled={formData.max_companions === 0}>
                <UserPlus className="h-4 w-4 mr-1" />
                Acompañantes
              </TabsTrigger>
              <TabsTrigger value="config">
                <Settings className="h-4 w-4 mr-1" />
                Configuración
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto py-4">
              {/* Tab 1: General */}
              <TabsContent value="general" className="space-y-4 mt-0">
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

                <div className="grid gap-4 grid-cols-2">
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

                {/* Capacity warning */}
                {exceedsGlobalCapacity && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Excede el aforo global</AlertTitle>
                    <AlertDescription>
                      Esta capacidad superaría el aforo total del evento.
                      <br />
                      <span className="font-medium">
                        Aforo global: {eventMaxCapacity} | Suma propuesta: {proposedTotal} | Exceso: {excessAmount}
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                {remainingCapacity !== null && remainingCapacity > 0 && !exceedsGlobalCapacity && (
                  <p className="text-sm text-muted-foreground">
                    Capacidad disponible para este tipo: {remainingCapacity} plazas
                  </p>
                )}
              </TabsContent>
              
              {/* Tab 2: Companions */}
              <TabsContent value="companions" className="space-y-4 mt-0">
                {formData.max_companions > 0 ? (
                  <div className="space-y-4">
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
                      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                        <Label>Campos a solicitar</Label>
                        <p className="text-sm text-muted-foreground">
                          Selecciona qué datos se pedirán a cada acompañante
                        </p>
                        <div className="grid grid-cols-2 gap-3">
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
                    
                    {formData.anonymous_companions && (
                      <div className="p-4 border rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          Los acompañantes recibirán entradas anónimas sin necesidad de introducir datos personales.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Establece un número de acompañantes mayor que 0 en la pestaña General para configurar esta sección.</p>
                  </div>
                )}
              </TabsContent>
              
              {/* Tab 3: Configuration */}
              <TabsContent value="config" className="space-y-4 mt-0">
                <div className="space-y-3">
                  <Label>Roles permitidos</Label>
                  <p className="text-sm text-muted-foreground">
                    Si no seleccionas ninguno, estará disponible para todos los roles.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
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

                <div className="flex items-center justify-between p-3 rounded-md border mt-3">
                  <div>
                    <p className="text-sm font-medium">Exclusivo para jueces</p>
                    <p className="text-xs text-muted-foreground">Solo usuarios con asignación de juez para este evento pueden usar este ticket</p>
                  </div>
                  <Switch
                    checked={formData.for_judges}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, for_judges: checked }))}
                  />
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <Label>Campos obligatorios del titular</Label>
                  <p className="text-sm text-muted-foreground">
                    Además de nombre, apellidos y email (siempre obligatorios)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {REGISTRATION_FIELDS.map((field) => (
                      <div key={field.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`required-${field.value}`}
                          checked={formData.required_fields.includes(field.value)}
                          onCheckedChange={() => toggleRequiredField(field.value)}
                        />
                        <Label htmlFor={`required-${field.value}`} className="font-normal">
                          {field.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
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
                      <Label htmlFor="requires-imported-team">Requiere equipo importado</Label>
                      <p className="text-sm text-muted-foreground">
                        Solo disponible para equipos inscritos en este evento (solo Final Regional)
                      </p>
                    </div>
                    <Switch
                      id="requires-imported-team"
                      checked={formData.requires_imported_team}
                      onCheckedChange={(checked) => setFormData({ ...formData, requires_imported_team: checked })}
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
              </TabsContent>
            </div>
          </Tabs>
          
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || exceedsGlobalCapacity}
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

      {/* Bulk Judge Ticket Confirmation */}
      <ConfirmDialog
        open={judgeTicketConfirmOpen}
        onOpenChange={setJudgeTicketConfirmOpen}
        title="¿Generar y enviar entradas a los jueces?"
        description={`Esta acción es irreversible. Se enviarán entradas a ${eligibleJudges.length} jueces. Cada juez recibirá un correo electrónico con su entrada y código QR para el evento.`}
        confirmText="Enviar entradas"
        variant="warning"
        onConfirm={() => bulkJudgeTicketMutation.mutate()}
        loading={bulkJudgeTicketMutation.isPending}
      />
    </>
  );
}
