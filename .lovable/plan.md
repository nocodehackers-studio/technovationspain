

# Plan: Mejoras en el Editor de Eventos

## Resumen de Cambios

| Cambio | Descripción | Complejidad |
|--------|-------------|-------------|
| 1. Tipo de evento | Añadir "Taller presencial" como opción | Baja |
| 2. Subida de imagen | Permitir upload al bucket "Assets" existente | Media |
| 3. Fechas con hora | Cambiar inputs date a datetime-local | Media |
| 4. Validación horarios | Verificar hora inicio < hora fin | Baja |

---

## 1. Añadir Tipo de Evento "Taller Presencial"

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/types/database.ts` | Añadir `'workshop'` al tipo `EventType` |
| `src/components/admin/events/EventBasicInfoForm.tsx` | Añadir opción en el Select |

### Implementación

```typescript
// src/types/database.ts - línea 10
export type EventType = 'intermediate' | 'regional_final' | 'workshop';
```

```tsx
// EventBasicInfoForm.tsx - dentro del SelectContent
<SelectItem value="intermediate">Evento Intermedio</SelectItem>
<SelectItem value="regional_final">Final Regional</SelectItem>
<SelectItem value="workshop">Taller Presencial</SelectItem>
```

---

## 2. Subida de Imagen de Portada

### Contexto
Ya existe un bucket público llamado **"Assets"** en Supabase Storage. Se modificará el formulario para permitir:
- Subir una imagen directamente
- O pegar una URL manualmente

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/events/EventBasicInfoForm.tsx` | Añadir input de archivo + lógica de upload |

### Implementación

```tsx
// Añadir imports
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Link } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dentro del componente, añadir estado
const [uploading, setUploading] = useState(false);

// Función de upload
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validar tipo y tamaño
  if (!file.type.startsWith('image/')) {
    toast.error('Por favor selecciona un archivo de imagen');
    return;
  }
  if (file.size > 5 * 1024 * 1024) { // 5MB
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
```

### UI del componente

```tsx
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
    </div>
    
    {/* Opción 2: Pegar URL */}
    <div className="flex items-center gap-2">
      <Link className="h-4 w-4 text-muted-foreground" />
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
    <div className="mt-3 relative">
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
        size="sm"
        className="absolute top-2 right-2"
        onClick={() => onUpdate("image_url", "")}
      >
        Eliminar
      </Button>
    </div>
  )}
</div>
```

---

## 3. Fechas de Registro con Hora

### Problema actual
Las columnas `registration_open_date` y `registration_close_date` son tipo `DATE` en la base de datos, sin componente de hora.

### Solución

#### Paso 1: Migración de base de datos

```sql
-- Convertir a timestamp with time zone
ALTER TABLE events 
  ALTER COLUMN registration_open_date TYPE timestamp with time zone 
    USING registration_open_date::timestamp with time zone,
  ALTER COLUMN registration_close_date TYPE timestamp with time zone 
    USING registration_close_date::timestamp with time zone;
```

#### Paso 2: Actualizar formulario

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/events/EventLocationForm.tsx` | Cambiar inputs de `date` a `datetime-local` |
| `src/pages/admin/AdminEventEditor.tsx` | Formatear correctamente los valores al cargar/guardar |

```tsx
// EventLocationForm.tsx - líneas 119-136
<div className="grid gap-4 md:grid-cols-2">
  <div className="space-y-2">
    <Label htmlFor="registration_open_date">Apertura de registro</Label>
    <Input
      id="registration_open_date"
      type="datetime-local"
      value={registrationOpenDate}
      onChange={(e) => onUpdate("registration_open_date", e.target.value)}
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="registration_close_date">Cierre de registro</Label>
    <Input
      id="registration_close_date"
      type="datetime-local"
      value={registrationCloseDate}
      onChange={(e) => onUpdate("registration_close_date", e.target.value)}
    />
  </div>
</div>
```

#### Paso 3: Formateo en AdminEventEditor

Al cargar datos del evento, formatear timestamps ISO a formato datetime-local:

```typescript
// Función helper
const formatDateTimeLocal = (isoString: string | null): string => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
};

// En useEffect al cargar evento
registration_open_date: formatDateTimeLocal(event.registration_open_date),
registration_close_date: formatDateTimeLocal(event.registration_close_date),
```

---

## 4. Validación Hora Inicio < Hora Fin

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminEventEditor.tsx` | Añadir validación en `handleSave` |

### Implementación

```typescript
// En handleSave, después de validar fecha (línea 212)
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

  // NUEVA VALIDACIÓN: hora inicio < hora fin
  if (formData.start_time && formData.end_time) {
    if (formData.start_time >= formData.end_time) {
      toast.error("La hora de inicio debe ser anterior a la hora de fin");
      setActiveTab("location");
      return;
    }
  }

  // También validar fechas de registro
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
```

---

## Resumen de Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/types/database.ts` | Añadir `'workshop'` a EventType |
| `src/components/admin/events/EventBasicInfoForm.tsx` | Nueva opción tipo + upload de imagen |
| `src/components/admin/events/EventLocationForm.tsx` | Inputs datetime-local |
| `src/pages/admin/AdminEventEditor.tsx` | Formateo timestamps + validaciones |

### Migración de Base de Datos

```sql
ALTER TABLE events 
  ALTER COLUMN registration_open_date TYPE timestamp with time zone 
    USING registration_open_date::timestamp with time zone,
  ALTER COLUMN registration_close_date TYPE timestamp with time zone 
    USING registration_close_date::timestamp with time zone;
```

---

## Orden de Implementación

1. Migración de base de datos (fechas a timestamp)
2. Tipo de evento "Taller presencial" (cambio sencillo)
3. Validación hora inicio < hora fin 
4. Subida de imagen de portada
5. Inputs datetime-local para fechas de registro

