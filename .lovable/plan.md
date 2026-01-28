
# Plan: Configuracion de Campos de Acompanantes por Evento

## Resumen

Implementar la configuracion dinamica de que campos solicitar para acompanantes en el registro de eventos. Esto permitira:
- Eventos que no piden datos de acompanantes (entradas anonimas)
- Eventos que piden nombre completo + DNI + parentesco (como el Evento Intermedio)
- Cualquier combinacion de campos segun necesidad del evento

---

## Estado Actual vs Propuesto

| Aspecto | Actual | Propuesto |
|---------|--------|-----------|
| Campos | Fijos: nombre, apellidos, parentesco | Configurable por tipo de entrada |
| Validacion | Siempre requiere todos | Solo campos configurados |
| DB companions | first_name/last_name NOT NULL | Todos nullable |
| Sin datos | No soportado | Entradas anonimas permitidas |

---

## Campos Disponibles para Configurar

| Campo | Clave | Descripcion |
|-------|-------|-------------|
| Nombre | `first_name` | Nombre del acompanante |
| Apellidos | `last_name` | Apellidos del acompanante |
| DNI | `dni` | Documento de identidad |
| Parentesco | `relationship` | Relacion con el participante |

---

## Cambios en Base de Datos

### 1. Nueva columna en event_ticket_types

```sql
ALTER TABLE event_ticket_types 
ADD COLUMN companion_fields_config JSONB DEFAULT '["first_name", "last_name", "relationship"]';
```

Valores posibles:
- `null` o `[]` - No pedir datos (entradas anonimas)
- `["first_name", "last_name"]` - Solo nombre
- `["first_name", "last_name", "dni", "relationship"]` - Todos los campos

### 2. Nueva columna en companions

```sql
ALTER TABLE companions ADD COLUMN dni TEXT;
```

### 3. Hacer campos nullable

```sql
ALTER TABLE companions 
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL;
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/events/TicketTypeManager.tsx` | Anadir UI para configurar campos |
| `src/components/events/CompanionFields.tsx` | Renderizado dinamico segun config |
| `src/pages/events/EventRegistrationPage.tsx` | Pasar config a CompanionFields |
| `src/hooks/useEventRegistration.ts` | Incluir dni en insert |
| `src/types/database.ts` | Actualizar tipos Companion |

---

## Implementacion del Admin (TicketTypeManager)

Nueva seccion en el dialogo de edicion cuando `max_companions > 0`:

```text
+--------------------------------------------------+
|  Datos requeridos de acompanantes                |
|                                                  |
|  [ ] Sin datos (entradas anonimas)               |
|                                                  |
|  Campos a solicitar:                             |
|  [x] Nombre                                      |
|  [x] Apellidos                                   |
|  [ ] DNI                                         |
|  [x] Parentesco                                  |
+--------------------------------------------------+
```

Si "Sin datos" esta marcado, se deshabilitan los checkboxes de campos y se guarda `[]` en la DB.

---

## Implementacion del CompanionFields

### Props actualizados

```typescript
interface CompanionFieldsProps {
  form: UseFormReturn<any>;
  maxCompanions: number;
  companions: CompanionData[];
  requiredFields: string[]; // Nuevo: ['first_name', 'last_name', 'dni', 'relationship']
  onAddCompanion: () => void;
  onRemoveCompanion: (index: number) => void;
  onUpdateCompanion: (index: number, field: keyof CompanionData, value: string) => void;
}
```

### Logica de renderizado

```typescript
// Si no hay campos requeridos, mostrar version simplificada
if (requiredFields.length === 0) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acompanantes</CardTitle>
        <CardDescription>
          Puedes anadir hasta {maxCompanions} acompanante(s). 
          Cada uno recibira su propia entrada con codigo QR.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Tienes {companions.length} acompanante(s)</p>
        {/* Botones +/- para anadir/quitar sin formulario */}
      </CardContent>
    </Card>
  );
}

// Renderizar solo los campos configurados
{requiredFields.includes('first_name') && (
  <Input placeholder="Nombre" ... />
)}
{requiredFields.includes('dni') && (
  <Input placeholder="DNI/NIE" ... />
)}
```

---

## Flujo de Validacion Actualizado

### En EventRegistrationPage

```typescript
const validateCompanions = (): boolean => {
  const requiredFields = selectedTicket?.companion_fields_config || [];
  
  // Si no hay campos requeridos, siempre valido
  if (requiredFields.length === 0) return true;
  
  for (const companion of companions) {
    if (requiredFields.includes('first_name') && !companion.first_name?.trim()) {
      toast.error('Completa el nombre de todos los acompanantes');
      return false;
    }
    if (requiredFields.includes('dni') && !companion.dni?.trim()) {
      toast.error('Completa el DNI de todos los acompanantes');
      return false;
    }
    // ... etc
  }
  return true;
};
```

---

## Actualizacion del Hook useEventRegistration

```typescript
// En el insert de companions
const companionsToInsert = formData.companions.map(companion => ({
  event_registration_id: registration.id,
  first_name: companion.first_name || null,
  last_name: companion.last_name || null,
  dni: companion.dni || null,
  relationship: companion.relationship || null,
  qr_code: generateQRCode(),
}));
```

---

## Ejemplos de Configuracion por Evento

### Evento Intermedio (Marzo 2025)
```json
{
  "max_companions": 2,
  "companion_fields_config": ["first_name", "last_name", "dni", "relationship"]
}
```
Resultado: Formulario completo con nombre, apellidos, DNI y parentesco.

### Final Regional
```json
{
  "max_companions": 1,
  "companion_fields_config": []
}
```
Resultado: Solo contador "+1 Acompanante" sin formulario de datos.

### Solo nombre (sin DNI)
```json
{
  "max_companions": 2,
  "companion_fields_config": ["first_name", "last_name"]
}
```
Resultado: Solo pide nombre y apellidos.

---

## Secuencia de Implementacion

1. **Migracion DB**: Anadir columnas y modificar constraints
2. **TicketTypeManager**: UI para configurar campos
3. **CompanionFields**: Renderizado dinamico
4. **EventRegistrationPage**: Pasar config al componente
5. **useEventRegistration**: Soportar dni y campos opcionales
6. **Tipos TypeScript**: Actualizar interfaces

---

## Consideraciones

- **Retrocompatibilidad**: Si `companion_fields_config` es null, usar los campos actuales por defecto
- **Email de confirmacion**: Adaptar para mostrar solo los campos que tienen valor
- **Check-in**: El QR sigue funcionando igual independientemente de los campos solicitados
- **Validacion servidor**: Aunque los campos sean opcionales en DB, la validacion se hace segun la config del ticket
