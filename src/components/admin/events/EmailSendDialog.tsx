import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { AlertCircle, Send, Clock, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useEventRegistrationsCount, useEventEmailTemplates } from "@/hooks/useEventEmails";
import { toast } from "sonner";

interface EmailSendDialogProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
}

type TargetAudience = "all_confirmed" | "ticket_type";

export function EmailSendDialog({ eventId, open, onClose }: EmailSendDialogProps) {
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("all_confirmed");
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data: registrationsCount, isLoading: isLoadingCount } =
    useEventRegistrationsCount(eventId);

  const { getTemplateOrDefault } = useEventEmailTemplates(eventId);
  const reminderTemplate = getTemplateOrDefault("reminder");

  // Fetch ticket types
  const { data: ticketTypes } = useQuery({
    queryKey: ["event-ticket-types", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_ticket_types")
        .select("id, name, current_count")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getRecipientsCount = () => {
    if (isLoadingCount || !registrationsCount) return 0;

    if (targetAudience === "all_confirmed") {
      return registrationsCount.total;
    }

    if (targetAudience === "ticket_type" && selectedTicketTypeId) {
      return registrationsCount.byTicketType[selectedTicketTypeId] || 0;
    }

    return 0;
  };

  const recipientsCount = getRecipientsCount();

  const handleSend = async () => {
    if (recipientsCount === 0) {
      toast.error("No hay destinatarios para enviar el email");
      return;
    }

    if (isScheduled && !scheduledDateTime) {
      toast.error("Selecciona una fecha y hora para programar el envío");
      return;
    }

    setIsSending(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error("No hay sesión activa");
      }

      const response = await supabase.functions.invoke("send-event-email", {
        body: {
          eventId,
          templateType: "reminder",
          targetAudience,
          ticketTypeId: targetAudience === "ticket_type" ? selectedTicketTypeId : undefined,
          scheduleFor: isScheduled ? scheduledDateTime : undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (isScheduled) {
        toast.success("Envío programado correctamente");
      } else {
        toast.success(`Email enviado a ${recipientsCount} destinatarios`);
      }

      onClose();
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setTargetAudience("all_confirmed");
    setSelectedTicketTypeId("");
    setIsScheduled(false);
    setScheduledDateTime("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Email Recordatorio</DialogTitle>
          <DialogDescription>
            Asunto: {reminderTemplate.subject.replace("{evento}", "...")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Target Audience */}
          <div className="space-y-3">
            <Label>Destinatarios</Label>
            <RadioGroup
              value={targetAudience}
              onValueChange={(v) => setTargetAudience(v as TargetAudience)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all_confirmed" id="all_confirmed" />
                <Label htmlFor="all_confirmed" className="font-normal cursor-pointer">
                  Todos los confirmados ({registrationsCount?.total || 0})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ticket_type" id="ticket_type" />
                <Label htmlFor="ticket_type" className="font-normal cursor-pointer">
                  Por tipo de entrada
                </Label>
              </div>
            </RadioGroup>

            {targetAudience === "ticket_type" && (
              <Select value={selectedTicketTypeId} onValueChange={setSelectedTicketTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tipo de entrada" />
                </SelectTrigger>
                <SelectContent>
                  {ticketTypes?.map((tt) => (
                    <SelectItem key={tt.id} value={tt.id}>
                      {tt.name} ({registrationsCount?.byTicketType[tt.id] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Schedule Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="schedule">Programar envío</Label>
              <p className="text-sm text-muted-foreground">
                Enviar en una fecha y hora específica
              </p>
            </div>
            <Switch
              id="schedule"
              checked={isScheduled}
              onCheckedChange={setIsScheduled}
            />
          </div>

          {isScheduled && (
            <div className="space-y-2">
              <Label htmlFor="datetime">Fecha y hora de envío</Label>
              <Input
                id="datetime"
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          {/* Recipients Summary */}
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              {isScheduled ? (
                <>
                  Se programará el envío a <strong>{recipientsCount}</strong>{" "}
                  destinatario{recipientsCount !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  Se enviará ahora a <strong>{recipientsCount}</strong>{" "}
                  destinatario{recipientsCount !== 1 ? "s" : ""}
                </>
              )}
            </AlertDescription>
          </Alert>

          {recipientsCount === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No hay destinatarios que coincidan con los criterios seleccionados.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || recipientsCount === 0}
          >
            {isSending ? (
              "Enviando..."
            ) : isScheduled ? (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Programar envío
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar ahora
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
