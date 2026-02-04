
## Plan: Corregir Página de Talleres con Selector de Eventos

### Problema Identificado

La página `/admin/workshops` muestra "Selecciona un evento para gestionar sus talleres" pero NO hay ningún selector de eventos visible. El componente espera un `eventId` de los parámetros de URL, pero cuando el usuario navega desde el sidebar a `/admin/workshops`, no hay ningún `eventId`.

### Solución

Modificar `AdminWorkshops.tsx` para que cuando no haya `eventId`:
1. Muestre un selector dropdown de eventos disponibles
2. Una vez seleccionado, cargue toda la información de talleres

Cuando sí hay `eventId`, mostrar la interfaz completa como ya está diseñada.

### Cambios a Realizar

**Archivo: `src/pages/admin/AdminWorkshops.tsx`**

1. Añadir estado para evento seleccionado
2. Añadir query para obtener lista de eventos
3. Modificar la condición `if (!eventId)` para mostrar un selector en lugar de solo texto

### Diseño de Interfaz (Sin eventId)

```text
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard > Talleres                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Talleres                                                       │
│                                                                 │
│  Selecciona un evento para ver y gestionar sus talleres        │
│                                                                 │
│  Evento: [ Evento Intermedio 2025          ▼ ]                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Lista de eventos disponibles con talleres               │   │
│  │ • Evento Intermedio 2025 - 7 talleres, 3 turnos        │   │
│  │ • Final Nacional 2025 - Sin talleres                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Diseño de Interfaz (Con eventId seleccionado)

Una vez seleccionado el evento (o si viene por URL directa), se muestra:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard > Talleres > Evento Intermedio 2025                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [← Volver]  Talleres - Evento Intermedio 2025                  │
│                                                                 │
│ [Estado Preferencias] [Asignar] [Cuadrante]                    │
│                                                                 │
│ ┌────────┐  ┌────────┐  ┌────────┐                             │
│ │ 3      │  │ 7      │  │ 310    │                             │
│ │ Turnos │  │Talleres│  │ Aforo  │                             │
│ └────────┘  └────────┘  └────────┘                             │
│                                                                 │
│ ℹ️ ¿Cómo funciona? ...                                         │
│                                                                 │
│ [Turnos Horarios] [Talleres] ← Tabs                            │
│                                                                 │
│ Turnos:                                                         │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Turno 1: 10:30 - 11:15  |  7 talleres simultáneos          │ │
│ │ Turno 2: 11:30 - 12:15  |  7 talleres simultáneos          │ │
│ │ Turno 3: 12:30 - 13:00  |  7 talleres simultáneos          │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Talleres:                                                       │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐      │
│ │ Ética e IA  │ Comunicación│ Diseño UX   │ Diseña logo │      │
│ │ Santander   │ Repsol      │ GFT         │ Dell        │      │
│ │ 30 plazas   │ 30 plazas   │ 30 plazas   │ 30 plazas   │      │
│ └─────────────┴─────────────┴─────────────┴─────────────┘      │
│ ┌─────────────┬─────────────┬─────────────┐                    │
│ │ ML 4 Kids   │Accesibilidad│ Prompting   │                    │
│ │ Verisure    │ Inditex     │ Amazon      │                    │
│ │ 30 plazas   │ 70 plazas   │ 100 plazas  │                    │
│ └─────────────┴─────────────┴─────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cambios Técnicos

```typescript
// Nuevo estado
const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

// Usar eventId de URL o el seleccionado
const effectiveEventId = eventId || selectedEventId;

// Nueva query para lista de eventos
const { data: allEvents, isLoading: eventsLoading } = useQuery({
  queryKey: ['all-events-for-workshops'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, date, event_type')
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  },
  enabled: !eventId,  // Solo cargar si no hay eventId en URL
});

// Si no hay eventId, mostrar selector
if (!effectiveEventId) {
  return (
    <AdminLayout title="Talleres">
      <EventSelector 
        events={allEvents}
        onSelect={(id) => setSelectedEventId(id)}
        loading={eventsLoading}
      />
    </AdminLayout>
  );
}

// Si hay effectiveEventId, mostrar la vista completa actual
// (el resto del código permanece igual pero usando effectiveEventId)
```

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminWorkshops.tsx` | Añadir selector de eventos cuando no hay eventId |

### Beneficios

1. El usuario puede navegar desde el sidebar y seleccionar un evento
2. Se mantiene la funcionalidad de acceso directo por URL (`/admin/events/:eventId/workshops`)
3. Una vez seleccionado, se muestra toda la información: turnos, talleres, estadísticas, links a preferencias/asignación/cuadrante
