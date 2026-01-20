import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EventType } from "@/types/database";

interface EventBasicInfoFormProps {
  name: string;
  eventType: EventType | null;
  description: string;
  imageUrl: string;
  onUpdate: (field: string, value: string) => void;
}

export function EventBasicInfoForm({
  name,
  eventType,
  description,
  imageUrl,
  onUpdate,
}: EventBasicInfoFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Básica</CardTitle>
        <CardDescription>
          Define los detalles principales del evento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del evento *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => onUpdate("name", e.target.value)}
            placeholder="Ej: Evento Intermedio Madrid 2025"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="event_type">Tipo de evento *</Label>
          <Select
            value={eventType || "intermediate"}
            onValueChange={(value) => onUpdate("event_type", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="intermediate">Evento Intermedio</SelectItem>
              <SelectItem value="regional_final">Final Regional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => onUpdate("description", e.target.value)}
            placeholder="Describe el evento, qué actividades habrá, a quién va dirigido..."
            rows={5}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="image_url">URL de imagen de portada</Label>
          <Input
            id="image_url"
            type="url"
            value={imageUrl}
            onChange={(e) => onUpdate("image_url", e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
          />
          {imageUrl && (
            <div className="mt-2">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full max-w-md h-48 object-cover rounded-lg border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
