import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EmailTemplateType = "confirmation" | "reminder";

export interface EventEmailTemplate {
  id: string;
  event_id: string;
  template_type: EmailTemplateType;
  subject: string;
  body_content: string;
  reply_to_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventEmailSend {
  id: string;
  event_id: string;
  template_type: string;
  subject: string;
  body_content: string | null;
  recipients_count: number;
  target_audience: "all_confirmed" | "ticket_type" | "custom";
  target_ticket_type_id: string | null;
  status: "scheduled" | "processing" | "sent" | "failed" | "cancelled";
  scheduled_for: string | null;
  sent_at: string | null;
  sent_by: string | null;
  error_message: string | null;
  created_at: string;
}

// Default templates
export const DEFAULT_TEMPLATES: Record<EmailTemplateType, { subject: string; body_content: string }> = {
  confirmation: {
    subject: "Inscripción confirmada: {nombre_completo} - {evento}",
    body_content: `Hola,

Hemos registrado correctamente a la participante cuyo nombre figura en el asunto de este mensaje en el evento "{evento}" que tendrá lugar en {ubicacion} el próximo {fecha} de {hora}.

Para poder participar en el evento, necesitamos que respondas a este mensaje adjuntando el consentimiento de cesión de imágenes firmado correspondiente a la chica que has inscrito. Si has inscrito a otros menores de edad como acompañantes, también deberás enviar otro consentimiento de cesión de imágenes firmado para él o ella.

Te adjuntamos un formulario en pdf cuyos campos puedes rellenar con los datos del titular y los del padre, madre o tutor, así como un campo para la firma. Si pudieras utilizar Adobe Acrobat Reader para la firma nos facilitarías a los voluntarios de PowertoCode la labor de validar los documentos recibidos.

Adjuntamos también un pdf con las instrucciones paso a paso para instalar Adobe Acrobat Reader y utilizarlo para rellenar y firmar el formulario (puedes usar otra plataforma para firmar, sobre todo si tienes certificado digital para la firma).

Te agradecemos si nos puedes hacer llegar el/los documento(s) firmado(s) a lo largo de esta semana para darnos tiempo a procesarlo, ya que los que no lo hayan enviado antes de la celebración del evento tendrán que hacerlo in-situ antes de entrar, lo que impactará en el trabajo necesario para comenzar el evento.

Tu número de registro es: {numero_registro}
Puedes acceder a tu entrada en cualquier momento desde: {enlace_entrada}

Si tienes dificultades para seguir estas instrucciones, no dudes en contactarnos.

Muchísimas gracias desde Power to Code por colaborar a que Technovation Girls 2026 sea un éxito.

Saludos cordiales,
Equipo de Technovation Girls España`,
  },
  reminder: {
    subject: "¡Te esperamos mañana en {evento}!",
    body_content: `Hola {nombre},

Te recordamos que mañana es el evento "{evento}".

📅 Fecha: {fecha}
🕐 Horario: {hora}
📍 Lugar: {ubicacion}
   {direccion}, {ciudad}

No olvides llevar:
- Tu entrada (la encontrarás en {enlace_entrada})
- Documento de identidad
- Muchas ganas de aprender

¡Nos vemos pronto!

Equipo de Technovation Girls España`,
  },
};

// Template variables info
export const TEMPLATE_VARIABLES = [
  { key: "{nombre}", description: "Nombre del asistente" },
  { key: "{apellido}", description: "Apellido del asistente" },
  { key: "{nombre_completo}", description: "Nombre y apellido" },
  { key: "{evento}", description: "Nombre del evento" },
  { key: "{fecha}", description: "Fecha formateada del evento" },
  { key: "{hora}", description: "Horario (inicio - fin)" },
  { key: "{ubicacion}", description: "Nombre del lugar" },
  { key: "{direccion}", description: "Dirección completa" },
  { key: "{ciudad}", description: "Ciudad" },
  { key: "{numero_registro}", description: "Número de registro" },
  { key: "{tipo_entrada}", description: "Tipo de entrada" },
  { key: "{enlace_entrada}", description: "Link a ver entrada online" },
];

export function useEventEmailTemplates(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ["event-email-templates", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from("event_email_templates")
        .select("*")
        .eq("event_id", eventId);

      if (error) throw error;
      return data as EventEmailTemplate[];
    },
    enabled: !!eventId,
  });

  const upsertTemplateMutation = useMutation({
    mutationFn: async (template: {
      event_id: string;
      template_type: EmailTemplateType;
      subject: string;
      body_content: string;
      reply_to_email?: string | null;
    }) => {
      // Check if template exists
      const { data: existing } = await supabase
        .from("event_email_templates")
        .select("id")
        .eq("event_id", template.event_id)
        .eq("template_type", template.template_type)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("event_email_templates")
          .update({
            subject: template.subject,
            body_content: template.body_content,
            reply_to_email: template.reply_to_email || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_email_templates")
          .insert({
            event_id: template.event_id,
            template_type: template.template_type,
            subject: template.subject,
            body_content: template.body_content,
            reply_to_email: template.reply_to_email || null,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-email-templates", eventId] });
      toast.success("Plantilla guardada correctamente");
    },
    onError: (error) => {
      toast.error(`Error al guardar plantilla: ${error.message}`);
    },
  });

  // Helper to get template or default
  const getTemplate = (type: EmailTemplateType): EventEmailTemplate | null => {
    return templatesQuery.data?.find((t) => t.template_type === type) || null;
  };

  const getTemplateOrDefault = (type: EmailTemplateType) => {
    const template = getTemplate(type);
    if (template) {
      return {
        subject: template.subject,
        body_content: template.body_content,
        reply_to_email: template.reply_to_email,
      };
    }
    return {
      ...DEFAULT_TEMPLATES[type],
      reply_to_email: null,
    };
  };

  return {
    templates: templatesQuery.data || [],
    isLoading: templatesQuery.isLoading,
    getTemplate,
    getTemplateOrDefault,
    upsertTemplate: upsertTemplateMutation.mutate,
    isUpsertingTemplate: upsertTemplateMutation.isPending,
  };
}

export function useEventEmailSends(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const sendsQuery = useQuery({
    queryKey: ["event-email-sends", eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from("event_email_sends")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EventEmailSend[];
    },
    enabled: !!eventId,
  });

  const cancelSendMutation = useMutation({
    mutationFn: async (sendId: string) => {
      const { error } = await supabase
        .from("event_email_sends")
        .update({ status: "cancelled" })
        .eq("id", sendId)
        .eq("status", "scheduled");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-email-sends", eventId] });
      toast.success("Envío cancelado");
    },
    onError: (error) => {
      toast.error(`Error al cancelar: ${error.message}`);
    },
  });

  return {
    sends: sendsQuery.data || [],
    isLoading: sendsQuery.isLoading,
    refetch: sendsQuery.refetch,
    cancelSend: cancelSendMutation.mutate,
    isCancelling: cancelSendMutation.isPending,
  };
}

export function useEventRegistrationsCount(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-registrations-count", eventId],
    queryFn: async () => {
      if (!eventId) return { total: 0, byTicketType: {} as Record<string, number> };

      const { data, error } = await supabase
        .from("event_registrations")
        .select("ticket_type_id")
        .eq("event_id", eventId)
        .eq("registration_status", "confirmed")
        .eq("is_companion", false);

      if (error) throw error;

      const byTicketType: Record<string, number> = {};
      data?.forEach((reg) => {
        const key = reg.ticket_type_id || "unknown";
        byTicketType[key] = (byTicketType[key] || 0) + 1;
      });

      return {
        total: data?.length || 0,
        byTicketType,
      };
    },
    enabled: !!eventId,
  });
}
