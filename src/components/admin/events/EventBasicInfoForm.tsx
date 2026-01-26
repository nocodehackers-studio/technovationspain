import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EventType } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Link, X } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen');
      return;
    }
    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 5MB');
      return;
    }

    setUploading(true);
    const fileName = `events/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    const { error } = await supabase.storage
      .from('Assets')
      .upload(fileName, file, { upsert: true });

    if (error) {
      toast.error('Error al subir la imagen');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('Assets')
      .getPublicUrl(fileName);

    onUpdate('image_url', publicUrl);
    setUploading(false);
    toast.success('Imagen subida correctamente');
  };

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
              <SelectItem value="workshop">Taller Presencial</SelectItem>
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
          <Label>Imagen de portada</Label>
          <div className="flex flex-col gap-3">
            {/* Opción 1: Subir archivo */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Subiendo...' : 'Subir imagen'}
              </Button>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <span className="text-sm text-muted-foreground">
                Máx. 5MB
              </span>
            </div>
            
            {/* Opción 2: Pegar URL */}
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="url"
                value={imageUrl}
                onChange={(e) => onUpdate("image_url", e.target.value)}
                placeholder="O pega una URL de imagen"
                className="flex-1"
              />
            </div>
          </div>
          
          {/* Preview */}
          {imageUrl && (
            <div className="mt-3 relative inline-block">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full max-w-md h-48 object-cover rounded-lg border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => onUpdate("image_url", "")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
