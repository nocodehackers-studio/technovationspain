
# Plan: Vista de Métricas e Inscripciones del Evento

## Resumen

Añadir una nueva pestaña "Estadísticas" al editor de eventos (`AdminEventEditor`) que muestre:
1. **Tarjetas de métricas clave**: Participantes, Acompañantes, Mentores/Jueces, Entradas restantes
2. **Tabla de inscripciones**: Listado completo con indicador de acompañantes (+1, +2)

## Arquitectura de Datos

### Estructura actual de inscripciones:
- **`event_registrations`**: Contiene los registros principales (participantes, mentores, jueces)
  - `is_companion: false` para registros principales
  - `ticket_type_id` referencia a `event_ticket_types`
- **`companions`**: Tabla separada con acompañantes
  - `event_registration_id` referencia al registro principal
  - Contiene `first_name`, `last_name`, `relationship`
- **`event_ticket_types`**: Define tipos de entrada con `allowed_roles` (participant, mentor, judge)

### Cálculo de métricas:
- **Participantes**: Registros donde `ticket_type.allowed_roles` incluye `participant`
- **Mentores**: Registros donde `ticket_type.allowed_roles` incluye `mentor`
- **Acompañantes**: Conteo de la tabla `companions` del evento
- **Entradas restantes**: `max_capacity - current_registrations` del evento

## Cambios a Implementar

### 1. Nuevo componente: `src/components/admin/events/EventStatsView.tsx`

```typescript
// Props
interface EventStatsViewProps {
  eventId: string;
}

// Queries necesarias
const { data: event } = useQuery({...}); // Para max_capacity y current_registrations
const { data: registrations } = useQuery({...}); // event_registrations con ticket_type
const { data: companions } = useQuery({...}); // companions del evento

// Cálculo de métricas
const participantsCount = registrations.filter(r => 
  r.ticket_type?.allowed_roles?.includes('participant')
).length;

const mentorsCount = registrations.filter(r => 
  r.ticket_type?.allowed_roles?.includes('mentor')
).length;

const judgesCount = registrations.filter(r => 
  r.ticket_type?.allowed_roles?.includes('judge')
).length;

const companionsCount = companions?.length || 0;

const remainingTickets = (event?.max_capacity || 0) - (event?.current_registrations || 0);
```

### 2. Estructura del componente

```text
┌─────────────────────────────────────────────────────────────────┐
│  Estadísticas del Evento                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │   👧 42     │ │   👨‍👩 28   │ │   🎓 12    │ │   🎫 417   ││
│  │ Participan. │ │ Acompañant. │ │  Mentores   │ │  Restantes ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
│                                                                 │
│  Listado de Inscripciones                    [🔍 Buscar...   ] │
│  ──────────────────────────────────────────────────────────────│
│  │ Nombre        │ Tipo Entrada │ Acomp. │ Estado  │ Fecha    ││
│  ├───────────────┼──────────────┼────────┼─────────┼──────────┤│
│  │ Lucía Martín. │ Participante │  +2    │ ✓ Conf. │ 26/01/26 ││
│  │ Elena Rodríg. │ Participante │  +1    │ ✓ Conf. │ 26/01/26 ││
│  │ Carlos Pérez  │ Mentor       │   -    │ ✓ Conf. │ 25/01/26 ││
│  │ Paula Fernán. │ Participante │  +1    │ ✓ Conf. │ 26/01/26 ││
│  └───────────────┴──────────────┴────────┴─────────┴──────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Modificar `AdminEventEditor.tsx`

Añadir nueva pestaña después de "Emails":

```typescript
// Importar
import { EventStatsView } from "@/components/admin/events/EventStatsView";
import { BarChart3 } from "lucide-react";

// En TabsList (ahora 7 tabs)
<TabsTrigger value="stats" className="gap-2" disabled={!isEditing}>
  <BarChart3 className="h-4 w-4" />
  <span className="hidden sm:inline">Estadísticas</span>
</TabsTrigger>

// TabsContent
<TabsContent value="stats">
  {eventId && <EventStatsView eventId={eventId} />}
</TabsContent>
```

### 4. Columnas de la tabla de inscripciones

| Columna | Descripción |
|---------|-------------|
| **Nombre** | `first_name` + `last_name` del registro |
| **Tipo Entrada** | Nombre del `ticket_type` (Participante, Mentor, etc.) |
| **Acompañantes** | Badge con +1, +2 o "-" según count de companions |
| **Estado** | Badge: Confirmada/Cancelada/Check-in |
| **Check-in** | Hora de check-in si aplica |
| **Fecha registro** | Fecha de creación |

### 5. Query de datos con conteo de acompañantes

```typescript
// Query principal de registros
const { data: registrations } = useQuery({
  queryKey: ["event-registrations-stats", eventId],
  queryFn: async () => {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select(`
        id, first_name, last_name, email, registration_status,
        checked_in_at, created_at, registration_number,
        ticket_type:event_ticket_types(id, name, allowed_roles)
      `)
      .eq("event_id", eventId)
      .eq("is_companion", false)
      .neq("registration_status", "cancelled")
      .order("created_at", { ascending: false });

    // Obtener conteo de acompañantes por registro
    const { data: companions } = await supabase
      .from("companions")
      .select("event_registration_id")
      .in("event_registration_id", regs?.map(r => r.id) || []);

    // Mapear conteo a cada registro
    const companionCounts = companions?.reduce((acc, c) => {
      acc[c.event_registration_id] = (acc[c.event_registration_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return regs?.map(r => ({
      ...r,
      companions_count: companionCounts?.[r.id] || 0
    }));
  }
});
```

### 6. Funcionalidad de exportación

Botón "Exportar CSV" que incluya:
- Nombre, Email, Teléfono
- Tipo de entrada
- Número de acompañantes
- Estado de registro
- Check-in (sí/no y hora)

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/components/admin/events/EventStatsView.tsx` | **Crear** | Nuevo componente con métricas y tabla |
| `src/pages/admin/AdminEventEditor.tsx` | **Modificar** | Añadir pestaña "Estadísticas" |

## Componentes Reutilizados

- `MetricCard` - Para las 4 tarjetas de métricas
- `DataTable` - Para el listado de inscripciones
- `Badge` - Para estados y contador de acompañantes

## Iconos a Usar (lucide-react)

- `Users` - Participantes
- `UserPlus` - Acompañantes  
- `GraduationCap` - Mentores
- `Ticket` - Entradas restantes
- `BarChart3` - Pestaña de estadísticas
