import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Edit, Eye, Send } from "lucide-react";
import { useEventEmailTemplates, useEventEmailSends, DEFAULT_TEMPLATES, EmailTemplateType } from "@/hooks/useEventEmails";
import { EmailTemplateEditor } from "./EmailTemplateEditor";
import { EmailSendDialog } from "./EmailSendDialog";
import { EmailHistoryTable } from "./EmailHistoryTable";

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
  showSendButton?: boolean;
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
  showSendButton,
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
                <Send className="mr-2 h-4 w-4" />
                Enviar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EventEmailManager({ eventId }: EventEmailManagerProps) {
  const { templates, isLoading, getTemplateOrDefault } = useEventEmailTemplates(eventId);
  const { sends, isLoading: isLoadingSends, refetch: refetchSends } = useEventEmailSends(eventId);

  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateType | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);

  const confirmationTemplate = getTemplateOrDefault("confirmation");
  const reminderTemplate = getTemplateOrDefault("reminder");

  const hasCustomConfirmation = templates.some((t) => t.template_type === "confirmation");
  const hasCustomReminder = templates.some((t) => t.template_type === "reminder");

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
            showSendButton
          />
        </div>
      </div>

      {/* History Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Historial de Envíos</h3>
        <EmailHistoryTable
          sends={sends}
          isLoading={isLoadingSends}
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
