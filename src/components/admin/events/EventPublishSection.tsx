import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EventPublishSectionProps {
  eventId: string;
  status: "draft" | "published" | null;
  name: string;
  date: string;
  hasTicketTypes: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  isPublishing: boolean;
}

export function EventPublishSection({
  eventId,
  status,
  name,
  date,
  hasTicketTypes,
  onPublish,
  onUnpublish,
  isPublishing,
}: EventPublishSectionProps) {
  const isPublished = status === "published";
  const canPublish = name && date && hasTicketTypes;

  const issues = [];
  if (!name) issues.push("El evento no tiene nombre");
  if (!date) issues.push("El evento no tiene fecha");
  if (!hasTicketTypes) issues.push("El evento no tiene tipos de entrada configurados");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Estado de Publicación</CardTitle>
          <CardDescription>
            Controla la visibilidad del evento para los usuarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {isPublished ? (
                <Eye className="h-5 w-5 text-green-600" />
              ) : (
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <h4 className="font-medium">
                  {isPublished ? "Publicado" : "Borrador"}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {isPublished
                    ? "El evento es visible para los usuarios"
                    : "Solo los administradores pueden ver el evento"}
                </p>
              </div>
            </div>
            <Badge variant={isPublished ? "default" : "secondary"}>
              {isPublished ? "Público" : "Privado"}
            </Badge>
          </div>

          {!canPublish && !isPublished && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No se puede publicar</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {canPublish && !isPublished && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Listo para publicar</AlertTitle>
              <AlertDescription>
                El evento tiene toda la información necesaria para ser publicado.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            {isPublished ? (
              <Button
                variant="outline"
                onClick={onUnpublish}
                disabled={isPublishing}
              >
                <EyeOff className="mr-2 h-4 w-4" />
                {isPublishing ? "Despublicando..." : "Despublicar"}
              </Button>
            ) : (
              <Button
                onClick={onPublish}
                disabled={!canPublish || isPublishing}
              >
                <Eye className="mr-2 h-4 w-4" />
                {isPublishing ? "Publicando..." : "Publicar Evento"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isPublished && (
        <Card>
          <CardHeader>
            <CardTitle>Vista Previa</CardTitle>
            <CardDescription>
              Visualiza cómo ven los usuarios el evento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <a
                href={`/events/${eventId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir página del evento
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumen del Evento</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nombre:</dt>
              <dd className="font-medium">{name || "Sin nombre"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Fecha:</dt>
              <dd className="font-medium">
                {date
                  ? new Date(date).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Sin fecha"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tipos de entrada:</dt>
              <dd className="font-medium">
                {hasTicketTypes ? "Configurados" : "Sin configurar"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
