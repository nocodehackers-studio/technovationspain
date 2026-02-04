
## Plan: Validación de Aforo Global en Tipos de Entrada

### Resumen

Añadir validación en el editor de tipos de entrada para que la suma de capacidades de todos los tipos no supere el aforo global del evento. Mostrar warnings visuales y bloquear la creación/edición si se supera el límite.

---

### Estado Actual

| Elemento | Estado |
|----------|--------|
| Campo `max_capacity` en evento | Ya existe y se configura en la pestaña "Lugar" |
| Validación en tipos de entrada | No existe - se pueden crear sin límite |
| Indicador visual de uso | No existe |

---

### Cambios a Realizar

#### 1. Pasar `max_capacity` del evento al TicketTypeManager

El componente necesita conocer el aforo global para validar.

```text
┌──────────────────────────────────────────────────────────┐
│  AdminEventEditor                                        │
│  ├── formData.max_capacity (500)                        │
│  │                                                       │
│  └── <TicketTypeManager                                  │
│         eventId="..."                                    │
│         eventMaxCapacity={500}  ← NUEVO                 │
│      />                                                  │
└──────────────────────────────────────────────────────────┘
```

#### 2. Mostrar indicador de uso del aforo en la lista

```text
┌──────────────────────────────────────────────────────────┐
│  Tipos de Entrada                        [+ Añadir Tipo] │
├──────────────────────────────────────────────────────────┤
│  Aforo global: 500                                       │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░  380/500 (76%) │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Participantes              250/300    [Editar] [X] │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Mentores                   100/130    [Editar] [X] │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

#### 3. Warning en el diálogo de edición/creación

```text
┌──────────────────────────────────────────────────────────┐
│  Nuevo Tipo de Entrada                                   │
├──────────────────────────────────────────────────────────┤
│  Nombre: Acompañantes                                    │
│  Capacidad máxima: 150                                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ⚠️ Esta capacidad superaría el aforo global        │  │
│  │    Aforo total: 500                                 │  │
│  │    Suma actual: 430 + 150 = 580                     │  │
│  │    Exceso: 80 plazas                                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│                         [Cancelar]  [Crear] ← Deshabilitado│
└──────────────────────────────────────────────────────────┘
```

---

### Lógica de Validación

```typescript
// Calcular suma de capacidades actuales (excluyendo el ticket que se edita)
const otherTicketsCapacity = ticketTypes
  ?.filter(t => t.id !== selectedTicket?.id)
  .reduce((sum, t) => sum + t.max_capacity, 0) || 0;

// Capacidad total propuesta
const proposedTotal = otherTicketsCapacity + formData.max_capacity;

// Determinar si hay exceso
const hasExcess = eventMaxCapacity && proposedTotal > eventMaxCapacity;
const excessAmount = hasExcess ? proposedTotal - eventMaxCapacity : 0;

// Deshabilitar botón si hay exceso
const canSubmit = !hasExcess;
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/AdminEventEditor.tsx` | Pasar `eventMaxCapacity` como prop al TicketTypeManager |
| `src/components/admin/events/TicketTypeManager.tsx` | Añadir validación, warnings y barra de progreso |

---

### Sección Técnica

#### Cambios en AdminEventEditor.tsx

```tsx
// Línea ~261, donde se renderiza TicketTypeManager
<TabsContent value="tickets">
  {eventId && (
    <TicketTypeManager 
      eventId={eventId} 
      eventMaxCapacity={formData.max_capacity}  // ← NUEVO
    />
  )}
</TabsContent>
```

#### Cambios en TicketTypeManager.tsx

**1. Actualizar interface de props**
```typescript
interface TicketTypeManagerProps {
  eventId: string;
  eventMaxCapacity?: number | null;  // ← NUEVO
}
```

**2. Calcular uso de aforo**
```typescript
// Suma de capacidades de todos los tipos de entrada
const totalTicketCapacity = ticketTypes?.reduce((sum, t) => sum + t.max_capacity, 0) || 0;

// Para el diálogo: suma excluyendo el ticket que se edita
const otherTicketsCapacity = ticketTypes
  ?.filter(t => t.id !== selectedTicket?.id)
  .reduce((sum, t) => sum + t.max_capacity, 0) || 0;

// Capacidad propuesta con el formulario actual
const proposedTotal = otherTicketsCapacity + formData.max_capacity;

// Estado de validación
const exceedsGlobalCapacity = eventMaxCapacity != null && proposedTotal > eventMaxCapacity;
const excessAmount = exceedsGlobalCapacity ? proposedTotal - eventMaxCapacity : 0;
const remainingCapacity = eventMaxCapacity != null ? eventMaxCapacity - otherTicketsCapacity : null;
```

**3. Indicador en el header de la card**
```tsx
{eventMaxCapacity && (
  <div className="mt-4 space-y-2">
    <div className="flex justify-between text-sm">
      <span>Aforo global asignado</span>
      <span className={totalTicketCapacity > eventMaxCapacity ? "text-destructive font-medium" : ""}>
        {totalTicketCapacity} / {eventMaxCapacity}
      </span>
    </div>
    <Progress 
      value={(totalTicketCapacity / eventMaxCapacity) * 100} 
      className={totalTicketCapacity > eventMaxCapacity ? "bg-destructive/20" : ""}
    />
    {totalTicketCapacity > eventMaxCapacity && (
      <p className="text-sm text-destructive">
        ⚠️ La suma de capacidades supera el aforo global en {totalTicketCapacity - eventMaxCapacity} plazas
      </p>
    )}
  </div>
)}
```

**4. Warning en el diálogo**
```tsx
{exceedsGlobalCapacity && (
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Excede el aforo global</AlertTitle>
    <AlertDescription>
      Esta capacidad superaría el aforo total del evento.
      <br />
      Aforo global: {eventMaxCapacity} | Suma propuesta: {proposedTotal} | Exceso: {excessAmount}
    </AlertDescription>
  </Alert>
)}

{remainingCapacity !== null && remainingCapacity > 0 && !exceedsGlobalCapacity && (
  <p className="text-sm text-muted-foreground">
    Capacidad disponible para este tipo: {remainingCapacity} plazas
  </p>
)}
```

**5. Deshabilitar botón de guardar**
```tsx
<Button
  onClick={handleSubmit}
  disabled={
    createMutation.isPending || 
    updateMutation.isPending || 
    exceedsGlobalCapacity  // ← NUEVO
  }
>
```

---

### Comportamiento Esperado

| Escenario | Resultado |
|-----------|-----------|
| Aforo global: 500, suma de tipos: 450 | ✅ Verde, se puede añadir hasta 50 más |
| Aforo global: 500, suma de tipos: 500 | ✅ Amarillo, aforo completo asignado |
| Aforo global: 500, intentar añadir 100 cuando ya hay 450 | ❌ Warning, botón deshabilitado |
| Sin aforo global configurado | Sin validación (ilimitado) |

---

### Imports Adicionales

```typescript
import { AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
```
