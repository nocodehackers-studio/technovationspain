

## Plan: Sistema de Lista de Espera para Eventos

### Resumen

Implementar un sistema de lista de espera que permita a los usuarios apuntarse cuando un tipo de entrada está agotado. El usuario quedará registrado como "en lista de espera" sin consumir aforo, y se identificará claramente en el sistema.

---

### Estado Actual

| Elemento | Estado |
|----------|--------|
| Estados de registro | `confirmed`, `cancelled`, `checked_in` |
| Comportamiento cuando agotado | Bloquea inscripción, muestra "Agotado" |
| Lista de espera | No existe |

---

### Cambios a Realizar

#### 1. Base de Datos - Nuevo Estado

Añadir el estado `waitlisted` a los registros de eventos.

```sql
-- No requiere migración de schema
-- registration_status ya es tipo string
-- Solo añadir el valor 'waitlisted' en la lógica de la aplicación
```

#### 2. Flujo de Usuario

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Página de Registro de Evento                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Selecciona tu tipo de entrada:                                         │
│                                                                         │
│  ○ Participantes          [Gratis]      ← Disponible                   │
│                                                                         │
│  ○ Mentores               [Lista espera] ← Agotado, pero seleccionable  │
│    ⚠️ No hay plazas disponibles.                                        │
│       Al inscribirte entrarás en lista de espera.                       │
│                                                                         │
│  ○ Acompañantes           [Agotado]      ← Completamente deshabilitado  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3. Confirmación Diferenciada

```text
┌─────────────────────────────────────────────────────────────────────┐
│  LISTA DE ESPERA                                                    │
│                                                                     │
│  ⏳ Te has apuntado a la lista de espera                           │
│                                                                     │
│  Número de registro: TGM-2025-XXXXXX                                │
│                                                                     │
│  Te notificaremos si se libera una plaza.                           │
│  No tienes entrada confirmada todavía.                              │
│                                                                     │
│  (Sin código QR - solo para confirmados)                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Lógica de Negocio

```text
┌────────────────────┐
│ Usuario selecciona │
│ tipo de entrada    │
└─────────┬──────────┘
          │
          ▼
    ┌──────────────┐
    │ ¿Hay plazas  │───Sí──▶ registration_status = 'confirmed'
    │ disponibles? │         + Incrementar contador
    └──────┬───────┘         + Enviar QR por email
           │
          No
           │
           ▼
    ┌──────────────┐
    │ Mostrar      │
    │ advertencia  │
    │ lista espera │
    └──────┬───────┘
           │
           ▼
    registration_status = 'waitlisted'
    + NO incrementar contador
    + NO enviar QR
    + Mostrar página confirmación especial
```

**Importante**: Los registros en lista de espera:
- **NO** consumen aforo (no se incrementa `current_count`)
- **NO** reciben código QR funcional
- **SÍ** reciben número de registro para identificación
- **SÍ** aparecen en el dashboard del usuario

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/types/database.ts` | Añadir `'waitlisted'` al tipo `RegistrationStatus` |
| `src/hooks/useEventRegistration.ts` | Lógica para registrar en lista de espera sin incrementar contadores |
| `src/pages/events/EventRegistrationPage.tsx` | UI para permitir selección de entradas agotadas con advertencia |
| `src/pages/events/RegistrationConfirmationPage.tsx` | Vista diferenciada para lista de espera (sin QR) |
| `src/components/events/RegistrationStatusBadge.tsx` | Añadir badge para estado `waitlisted` |
| `src/pages/ParticipantDashboard.tsx` | Mostrar correctamente registros en lista de espera |

---

### Sección Técnica

#### 1. Actualizar tipo RegistrationStatus

```typescript
// src/types/database.ts línea 12
export type RegistrationStatus = 'confirmed' | 'cancelled' | 'checked_in' | 'waitlisted';
```

#### 2. Modificar useEventRegistration.ts

```typescript
// En registerMutation, después de verificar capacidad:
const availableSpots = (ticketType.max_capacity ?? 0) - (ticketType.current_count ?? 0);
const isWaitlist = availableSpots < totalSpotsNeeded;

// Crear registro con estado apropiado
const { data: registration, error } = await supabase
  .from('event_registrations')
  .insert({
    // ... otros campos
    registration_status: isWaitlist ? 'waitlisted' : 'confirmed',
  })
  .select()
  .single();

// Solo incrementar contadores si es confirmado
if (!isWaitlist) {
  await supabase.rpc('increment_registration_count', { ... });
}

// Solo enviar email con QR si es confirmado
if (!isWaitlist) {
  await supabase.functions.invoke('send-registration-confirmation', { ... });
}
```

#### 3. Modificar EventRegistrationPage.tsx

```typescript
// En el renderizado de tickets (líneas 435-477):
const isSoldOut = available <= 0;
const isWaitlistAvailable = isSoldOut; // Permitir lista de espera cuando agotado

// Cambiar onClick para permitir selección incluso si agotado
onClick={() => field.onChange(ticket.id)}

// Mostrar advertencia si el ticket seleccionado está en lista de espera
{selectedTicket && (selectedTicket.max_capacity || 0) - (selectedTicket.current_count || 0) <= 0 && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      No hay plazas disponibles para este tipo de entrada. 
      Al continuar, te apuntarás a la lista de espera.
    </AlertDescription>
  </Alert>
)}
```

#### 4. Modificar RegistrationConfirmationPage.tsx

```typescript
// Detectar si es lista de espera
const isWaitlisted = registration.registration_status === 'waitlisted';

// Mostrar UI diferenciada
{isWaitlisted ? (
  <div className="text-center space-y-4">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100">
      <Clock className="h-8 w-8 text-amber-600" />
    </div>
    <h1 className="text-2xl font-bold">Te has apuntado a la lista de espera</h1>
    <p className="text-muted-foreground">
      Te notificaremos si se libera una plaza
    </p>
  </div>
) : (
  // Vista actual de confirmación con QR
)}

// Ocultar QR y botones de calendario si es lista de espera
{!isWaitlisted && (
  <>
    <QRTicket code={registration.qr_code} size={180} />
    {/* Botones de descarga y calendario */}
  </>
)}
```

#### 5. Actualizar RegistrationStatusBadge.tsx

```typescript
const statusConfig: Record<string, { label: string; variant: ... }> = {
  pending: { label: 'Pendiente', variant: 'secondary' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  checked_in: { label: 'Check-in realizado', variant: 'outline' },
  waitlisted: { label: 'Lista de espera', variant: 'secondary' },  // ← NUEVO
};
```

#### 6. Actualizar ParticipantDashboard.tsx

```typescript
// En el mapeo de registros (línea 381-385)
<Badge 
  variant={
    reg.registration_status === 'confirmed' ? 'default' : 
    reg.registration_status === 'waitlisted' ? 'secondary' : 
    'outline'
  }
>
  {reg.registration_status === 'confirmed' ? 'Confirmada' : 
   reg.registration_status === 'waitlisted' ? 'Lista de espera' : 
   'Pendiente'}
</Badge>
```

---

### Imports Adicionales

```typescript
// EventRegistrationPage.tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

// RegistrationConfirmationPage.tsx
import { Clock } from 'lucide-react';
```

---

### Comportamiento Esperado

| Escenario | Resultado |
|-----------|-----------|
| Entrada con plazas disponibles | Registro confirmado + QR + Email |
| Entrada agotada | Advertencia visible + Registro en lista de espera |
| Usuario en lista de espera | Ve su registro sin QR, badge "Lista de espera" |
| Dashboard | Muestra registros en lista de espera claramente diferenciados |

---

### Lo que NO se implementa (para el futuro)

| Funcionalidad | Motivo |
|---------------|--------|
| Promoción automática de lista de espera | El usuario indicó "luego decidiremos" |
| Email cuando se libera plaza | Fase posterior |
| Posición en lista de espera | Fase posterior |
| Configuración por tipo de entrada | Todos los tipos permiten lista de espera |

