import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Save, Info, MapPin, Ticket, Calendar, Eye, Mail, BarChart3 } from "lucide-react";
import { EventBasicInfoForm } from "@/components/admin/events/EventBasicInfoForm";
import { EventLocationForm } from "@/components/admin/events/EventLocationForm";
import { TicketTypeManager } from "@/components/admin/events/TicketTypeManager";
import { AgendaManager } from "@/components/admin/events/AgendaManager";
import { EventPublishSection } from "@/components/admin/events/EventPublishSection";
import { EventEmailManager } from "@/components/admin/events/EventEmailManager";
import { EventStatsView } from "@/components/admin/events/EventStatsView";
import { Event, EventType } from "@/types/database";

interface EventFormData {
  name: string;
  event_type: EventType | null;
  description: string;
  image_url: string;
  date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  location_address: string;
  location_city: string;
  registration_open_date: string;
  registration_close_date: string;
  max_capacity: number | null;
  status: "draft" | "published" | null;
}

const initialFormData: EventFormData = {
  name: "",
  event_type: "intermediate",
  description: "",
  image_url: "",
  date: "",
  start_time: "",
  end_time: "",
  location_name: "",
  location_address: "",
  location_city: "",
  registration_open_date: "",
  registration_close_date: "",
  max_capacity: null,
  status: "draft",
};

export default function AdminEventEditor() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!eventId;
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch event if editing
  const { data: event, isLoading: isLoadingEvent } = useQuery({
    queryKey: ["admin-event", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (error) throw error;
      return data as Event;
    },
    enabled: isEditing,
  });

  // Fetch ticket types to check if any exist
  const { data: ticketTypes } = useQuery({
    queryKey: ["event-ticket-types", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_ticket_types")
        .select("id")
        .eq("event_id", eventId);

      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  // Helper to format ISO timestamp to datetime-local format
  const formatDateTimeLocal = (isoString: string | null): string => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
    } catch {
      return "";
    }
  };

  // Populate form when event loads
  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name || "",
        event_type: event.event_type as EventType || "intermediate",
        description: event.description || "",
        image_url: event.image_url || "",
        date: event.date || "",
        start_time: event.start_time || "",
        end_time: event.end_time || "",
        location_name: event.location_name || "",
        location_address: event.location_address || "",
        location_city: event.location_city || "",
        registration_open_date: formatDateTimeLocal(event.registration_open_date),
        registration_close_date: formatDateTimeLocal(event.registration_close_date),
        max_capacity: event.max_capacity || null,
        status: (event.status as "draft" | "published") || "draft",
      });
    }
  }, [event]);

  // Create event mutation
  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const { data: newEvent, error } = await supabase
        .from("events")
        .insert({
          name: data.name,
          event_type: data.event_type,
          description: data.description || null,
          image_url: data.image_url || null,
          date: data.date,
          start_time: data.start_time || null,
          end_time: data.end_time || null,
          location_name: data.location_name || null,
          location_address: data.location_address || null,
          location_city: data.location_city || null,
          location: data.location_name
            ? `${data.location_name}${data.location_city ? `, ${data.location_city}` : ""}`
            : null,
          registration_open_date: data.registration_open_date || null,
          registration_close_date: data.registration_close_date || null,
          max_capacity: data.max_capacity,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return newEvent;
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Evento creado correctamente");
      setHasUnsavedChanges(false);
      navigate(`/admin/events/${newEvent.id}/edit`);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update event mutation
  const updateMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (!eventId) throw new Error("No event ID");

      const { error } = await supabase
        .from("events")
        .update({
          name: data.name,
          event_type: data.event_type,
          description: data.description || null,
          image_url: data.image_url || null,
          date: data.date,
          start_time: data.start_time || null,
          end_time: data.end_time || null,
          location_name: data.location_name || null,
          location_address: data.location_address || null,
          location_city: data.location_city || null,
          location: data.location_name
            ? `${data.location_name}${data.location_city ? `, ${data.location_city}` : ""}`
            : null,
          registration_open_date: data.registration_open_date || null,
          registration_close_date: data.registration_close_date || null,
          max_capacity: data.max_capacity,
          status: data.status,
        })
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["admin-event", eventId] });
      toast.success("Evento guardado correctamente");
      setHasUnsavedChanges(false);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleUpdateField = (field: string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast.error("El nombre del evento es obligatorio");
      setActiveTab("basic");
      return;
    }
    if (!formData.date) {
      toast.error("La fecha del evento es obligatoria");
      setActiveTab("location");
      return;
    }

    // Validar que hora inicio < hora fin
    if (formData.start_time && formData.end_time) {
      if (formData.start_time >= formData.end_time) {
        toast.error("La hora de inicio debe ser anterior a la hora de fin");
        setActiveTab("location");
        return;
      }
    }

    // Validar fechas de registro
    if (formData.registration_open_date && formData.registration_close_date) {
      if (formData.registration_open_date >= formData.registration_close_date) {
        toast.error("La fecha de apertura de registro debe ser anterior al cierre");
        setActiveTab("location");
        return;
      }
    }

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePublish = () => {
    setFormData((prev) => ({ ...prev, status: "published" }));
    updateMutation.mutate({ ...formData, status: "published" });
  };

  const handleUnpublish = () => {
    setFormData((prev) => ({ ...prev, status: "draft" }));
    updateMutation.mutate({ ...formData, status: "draft" });
  };

  if (isEditing && isLoadingEvent) {
    return (
      <AdminLayout title="Cargando...">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Cargando evento...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={isEditing ? "Editar Evento" : "Crear Evento"}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/events")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isEditing ? formData.name || "Editar Evento" : "Crear Nuevo Evento"}
              </h1>
              <p className="text-muted-foreground">
                {isEditing
                  ? "Modifica los detalles del evento"
                  : "Configura todos los aspectos de tu evento"}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending || updateMutation.isPending
              ? "Guardando..."
              : hasUnsavedChanges
              ? "Guardar cambios"
              : "Guardado"}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="basic" className="gap-2">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">Información</span>
            </TabsTrigger>
            <TabsTrigger value="location" className="gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Fecha y Lugar</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2" disabled={!isEditing}>
              <Ticket className="h-4 w-4" />
              <span className="hidden sm:inline">Entradas</span>
            </TabsTrigger>
            <TabsTrigger value="agenda" className="gap-2" disabled={!isEditing}>
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="emails" className="gap-2" disabled={!isEditing}>
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Emails</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2" disabled={!isEditing}>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Estadísticas</span>
            </TabsTrigger>
            <TabsTrigger value="publish" className="gap-2" disabled={!isEditing}>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Publicar</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="basic">
              <EventBasicInfoForm
                name={formData.name}
                eventType={formData.event_type}
                description={formData.description}
                imageUrl={formData.image_url}
                onUpdate={handleUpdateField}
              />
            </TabsContent>

            <TabsContent value="location">
              <EventLocationForm
                date={formData.date}
                startTime={formData.start_time}
                endTime={formData.end_time}
                locationName={formData.location_name}
                locationAddress={formData.location_address}
                locationCity={formData.location_city}
                registrationOpenDate={formData.registration_open_date}
                registrationCloseDate={formData.registration_close_date}
                maxCapacity={formData.max_capacity}
                onUpdate={handleUpdateField}
              />
            </TabsContent>

            <TabsContent value="tickets">
              {eventId && <TicketTypeManager eventId={eventId} />}
            </TabsContent>

            <TabsContent value="agenda">
              {eventId && <AgendaManager eventId={eventId} />}
            </TabsContent>

            <TabsContent value="emails">
              {eventId && <EventEmailManager eventId={eventId} />}
            </TabsContent>

            <TabsContent value="stats">
              {eventId && <EventStatsView eventId={eventId} />}
            </TabsContent>

            <TabsContent value="publish">
              {eventId && (
                <EventPublishSection
                  eventId={eventId}
                  status={formData.status}
                  name={formData.name}
                  date={formData.date}
                  hasTicketTypes={(ticketTypes?.length || 0) > 0}
                  onPublish={handlePublish}
                  onUnpublish={handleUnpublish}
                  isPublishing={updateMutation.isPending}
                />
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Help text for new events */}
        {!isEditing && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
            <p>
              <strong>Nota:</strong> Guarda primero la información básica para poder configurar las entradas y la agenda del evento.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
