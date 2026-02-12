import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Eye, Code } from "lucide-react";
import {
  useEventEmailTemplates,
  EmailTemplateType,
  TEMPLATE_VARIABLES,
  DEFAULT_TEMPLATES,
} from "@/hooks/useEventEmails";

interface EmailTemplateEditorProps {
  eventId: string;
  templateType: EmailTemplateType;
  open: boolean;
  onClose: () => void;
}

export function EmailTemplateEditor({
  eventId,
  templateType,
  open,
  onClose,
}: EmailTemplateEditorProps) {
  const { getTemplateOrDefault, upsertTemplate, isUpsertingTemplate } =
    useEventEmailTemplates(eventId);

  const [subject, setSubject] = useState("");
  const [bodyContent, setBodyContent] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [activeTab, setActiveTab] = useState("edit");

  const templateTitle =
    templateType === "confirmation"
      ? "Email de Confirmación + Entrada"
      : "Email Recordatorio";

  useEffect(() => {
    if (open) {
      const template = getTemplateOrDefault(templateType);
      setSubject(template.subject);
      setBodyContent(template.body_content);
      setReplyToEmail(template.reply_to_email || "");
    }
  }, [open, templateType]);

  const handleSave = () => {
    upsertTemplate({
      event_id: eventId,
      template_type: templateType,
      subject,
      body_content: bodyContent,
      reply_to_email: replyToEmail || null,
    });
    onClose();
  };

  const handleReset = () => {
    const defaults = DEFAULT_TEMPLATES[templateType];
    setSubject(defaults.subject);
    setBodyContent(defaults.body_content);
    setReplyToEmail("");
  };

  const insertVariable = (variable: string) => {
    setBodyContent((prev) => prev + variable);
  };

  // Preview with sample data
  const getPreviewContent = () => {
    let preview = bodyContent;
    const sampleData: Record<string, string> = {
      "{nombre}": "María",
      "{apellido}": "García",
      "{nombre_completo}": "María García",
      "{evento}": "Final Regional Madrid 2025",
      "{fecha}": "Sábado, 8 de marzo de 2025",
      "{hora}": "09:00 - 18:00",
      "{ubicacion}": "Campus Google Madrid",
      "{direccion}": "Paseo de la Castellana 123",
      "{ciudad}": "Madrid",
      "{numero_registro}": "TGM-2025-ABC123",
      "{tipo_entrada}": "Participante",
      "{enlace_entrada}": "https://app.powertocode.org/tickets/xxx",
    };

    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.split(key).join(value);
    });

    return preview;
  };

  const getPreviewSubject = () => {
    let preview = subject;
    preview = preview.split("{evento}").join("Final Regional Madrid 2025");
    return preview;
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{templateTitle}</SheetTitle>
          <SheetDescription>
            Personaliza el contenido del email. Usa las variables disponibles para
            insertar datos dinámicos.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit" className="gap-2">
              <Code className="h-4 w-4" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Vista previa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4 mt-4">
            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Asunto del email</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: ¡Tu inscripción a {evento} está confirmada!"
              />
            </div>

            {/* Reply To */}
            <div className="space-y-2">
              <Label htmlFor="replyTo">Email de respuesta (opcional)</Label>
              <Input
                id="replyTo"
                type="email"
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
                placeholder="Ej: technovation.madrid@gmail.com"
              />
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label>Variables disponibles</Label>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <Badge
                    key={v.key}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => insertVariable(v.key)}
                    title={v.description}
                  >
                    {v.key}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Haz clic en una variable para insertarla en el contenido
              </p>
            </div>

            {/* Body Content */}
            <div className="space-y-2">
              <Label htmlFor="body">Contenido del email</Label>
              <Textarea
                id="body"
                value={bodyContent}
                onChange={(e) => setBodyContent(e.target.value)}
                placeholder="Escribe el contenido del email..."
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <Button variant="ghost" size="sm" onClick={handleReset}>
              Restaurar plantilla por defecto
            </Button>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="border rounded-lg overflow-hidden">
              {/* Email Header Preview */}
              <div className="bg-muted px-4 py-3 border-b">
                <div className="text-sm">
                  <span className="text-muted-foreground">Asunto: </span>
                  <span className="font-medium">{getPreviewSubject()}</span>
                </div>
                <div className="text-sm mt-1">
                  <span className="text-muted-foreground">Para: </span>
                  <span>maria.garcia@ejemplo.com</span>
                </div>
              </div>
              {/* Email Body Preview */}
              <div className="p-4 bg-background">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {getPreviewContent()}
                </pre>
                {templateType === "confirmation" && (
                  <div className="mt-6 p-4 bg-muted rounded-lg text-center">
                    <div className="w-32 h-32 mx-auto bg-white border rounded-lg flex items-center justify-center mb-2">
                      <span className="text-muted-foreground text-xs">
                        [Código QR]
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El código QR se generará automáticamente
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isUpsertingTemplate}>
            <Save className="mr-2 h-4 w-4" />
            {isUpsertingTemplate ? "Guardando..." : "Guardar plantilla"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
