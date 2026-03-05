import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Edit, FlaskConical } from "lucide-react";
import { useEventEmailTemplates, useEventEmailSends, DEFAULT_TEMPLATES, EmailTemplateType } from "@/hooks/useEventEmails";
import { EmailTemplateEditor } from "./EmailTemplateEditor";
import { EmailSendDialog } from "./EmailSendDialog";
import { EmailHistoryTable } from "./EmailHistoryTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EventEmailManagerProps {
  eventId: string;
}

interface TemplateCardProps {
  type: EmailTemplateType;
  title: string;
  description: string;
  icon: React.ReactNode;
  subject: string;
  hasCustomTemplate: boolean;
  onEdit: () => void;
  onSend?: () => void;
  onTestSend?: () => void;
  isTestSending?: boolean;
  showSendButton?: boolean;
  scheduledInfo?: string;
}

function TemplateCard({
  type,
  title,
  description,
  icon,
  subject,
  hasCustomTemplate,
  onEdit,
  onSend,
  onTestSend,
  isTestSending,
  showSendButton,
  scheduledInfo,
}: TemplateCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              {icon}
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
          </div>
          {hasCustomTemplate && (
            <Badge variant="secondary" className="text-xs">
              Personalizado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Asunto: </span>
            <span className="font-medium">{subject}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            {showSendButton && onSend && (
              <Button variant="outline" size="sm" onClick={onSend}>
                <Clock className="mr-2 h-4 w-4" />
                Programar
              </Button>
            )}
            {onTestSend && (
              <Button variant="outline" size="sm" onClick={onTestSend} disabled={isTestSending}>
                <FlaskConical className="mr-2 h-4 w-4" />
                {isTestSending ? "Enviando..." : "Probar"}
              </Button>
            )}
          </div>
          {scheduledInfo && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {scheduledInfo}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function EventEmailManager({ eventId }: EventEmailManagerProps) {
  const { templates, isLoading, getTemplateOrDefault } = useEventEmailTemplates(eventId);
  const { sends, isLoading: isLoadingSends, refetch: refetchSends, cancelSend, isCancelling } = useEventEmailSends(eventId);

  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateType | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) throw new Error("No hay sesión activa");

      const response = await supabase.functions.invoke("send-event-email", {
        body: {
          eventId,
          templateType: "reminder",
          targetAudience: "all_confirmed",
          testRecipientEmail: "alex@nocodehackers.es",
        },
      });

      if (response.error) throw new Error(response.error.message);
      toast.success("Email de prueba enviado a alex@nocodehackers.es");
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const confirmationTemplate = getTemplateOrDefault("confirmation");
  const reminderTemplate = getTemplateOrDefault("reminder");

  const hasCustomConfirmation = templates.some((t) => t.template_type === "confirmation");
  const hasCustomReminder = templates.some((t) => t.template_type === "reminder");

  // Check if there's a scheduled reminder email
  const scheduledReminder = sends.find(
    (s) => s.template_type === "reminder" && s.status === "scheduled" && s.scheduled_for
  );
  const scheduledReminderInfo = scheduledReminder
    ? `Programado para ${new Date(scheduledReminder.scheduled_for!).toLocaleString("es-ES", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })}`
    : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">Cargando configuración de emails...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Plantillas de Email</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <TemplateCard
            type="confirmation"
            title="Email de Confirmación + Entrada"
            description="Se envía automáticamente al registrarse. Incluye QR."
            icon={<Mail className="h-5 w-5" />}
            subject={confirmationTemplate.subject}
            hasCustomTemplate={hasCustomConfirmation}
            onEdit={() => setEditingTemplate("confirmation")}
          />
          <TemplateCard
            type="reminder"
            title="Email Recordatorio"
            description="Para recordar a los asistentes antes del evento"
            icon={<Clock className="h-5 w-5" />}
            subject={reminderTemplate.subject}
            hasCustomTemplate={hasCustomReminder}
            onEdit={() => setEditingTemplate("reminder")}
            onSend={() => setShowSendDialog(true)}
            onTestSend={handleSendTestEmail}
            isTestSending={isSendingTest}
            showSendButton
            scheduledInfo={scheduledReminderInfo}
          />
        </div>
      </div>

      {/* History Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Historial de Envíos</h3>
        <EmailHistoryTable
          sends={sends}
          isLoading={isLoadingSends}
          onCancelSend={cancelSend}
          isCancelling={isCancelling}
        />
      </div>

      {/* Template Editor Sheet */}
      {editingTemplate && (
        <EmailTemplateEditor
          eventId={eventId}
          templateType={editingTemplate}
          open={!!editingTemplate}
          onClose={() => setEditingTemplate(null)}
        />
      )}

      {/* Send Dialog */}
      <EmailSendDialog
        eventId={eventId}
        open={showSendDialog}
        onClose={() => {
          setShowSendDialog(false);
          refetchSends();
        }}
      />
    </div>
  );
}
