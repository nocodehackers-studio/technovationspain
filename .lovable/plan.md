

## Plan: Sistema Completo de Talleres para Evento Intermedio

### Resumen Ejecutivo

Implementar el sistema completo de gestión de talleres según la especificación, incluyendo:
- **Modelo de datos ampliado** (nuevas tablas y campos)
- **Panel de administración** mejorado (configuración de talleres por evento, turnos, ocupación)
- **Flujo de mentor** (selección de preferencias para sus equipos)
- **Algoritmo de asignación** (respeta FIFO y preferencias)
- **Vistas de gestión** (ocupación, cuadrante, reasignación manual)

---

### Estado Actual vs. Requerido

| Componente | Estado Actual | Estado Requerido |
|------------|---------------|------------------|
| Tabla `workshops` | Existe (básica) | Añadir campo `company`, renombrar `max_capacity` a `max_capacity_per_slot` |
| Tabla `workshop_time_slots` | No existe | Crear |
| Tabla `workshop_preferences` | No existe | Crear |
| Tabla `workshop_assignments` | No existe | Crear |
| Tabla `workshop_registrations` | Existe (obsoleta) | Migrar a nuevo modelo |
| Campo `participant_count` en registro | No existe | Añadir a `event_registrations` |
| Admin: Talleres por evento | No existe | Crear pestaña en editor de evento |
| Admin: Configurar turnos | No existe | Crear modal |
| Admin: Panel de ocupación | No existe | Crear vista matriz |
| Admin: Estado de preferencias | No existe | Crear vista |
| Admin: Ejecutar algoritmo | No existe | Crear panel |
| Admin: Cuadrante final | No existe | Crear vista |
| Mentor: Selección preferencias | No existe | Crear página completa |

---

### Fase 1: Modelo de Datos (Migraciones SQL)

#### 1.1 Modificar tabla `workshops`

```sql
-- Añadir campo empresa
ALTER TABLE workshops ADD COLUMN company VARCHAR(255);

-- Renombrar max_capacity para clarificar que es por turno
COMMENT ON COLUMN workshops.max_capacity IS 'Aforo máximo por turno horario';
```

#### 1.2 Crear tabla `workshop_time_slots`

```sql
CREATE TABLE workshop_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, slot_number)
);

CREATE INDEX idx_wts_event ON workshop_time_slots(event_id);

ALTER TABLE workshop_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage time slots" ON workshop_time_slots
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Verified users can view time slots" ON workshop_time_slots
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND verification_status = 'verified')
  OR has_role(auth.uid(), 'admin')
);
```

#### 1.3 Crear tabla `workshop_preferences`

```sql
CREATE TABLE workshop_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  preference_order INTEGER NOT NULL CHECK (preference_order >= 1),
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, event_id, workshop_id),
  UNIQUE(team_id, event_id, preference_order)
);

CREATE INDEX idx_wp_team ON workshop_preferences(team_id);
CREATE INDEX idx_wp_event ON workshop_preferences(event_id);

ALTER TABLE workshop_preferences ENABLE ROW LEVEL SECURITY;

-- Mentores pueden ver preferencias de sus equipos
CREATE POLICY "Mentors can view team preferences" ON workshop_preferences
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = workshop_preferences.team_id 
    AND user_id = auth.uid() 
    AND member_type = 'mentor'
  )
  OR has_role(auth.uid(), 'admin')
);

-- Mentores pueden crear preferencias (una vez)
CREATE POLICY "Mentors can insert preferences" ON workshop_preferences
FOR INSERT WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = workshop_preferences.team_id 
    AND user_id = auth.uid() 
    AND member_type = 'mentor'
  )
);

-- Solo admin puede modificar/eliminar
CREATE POLICY "Admins can manage all preferences" ON workshop_preferences
FOR ALL USING (has_role(auth.uid(), 'admin'));
```

#### 1.4 Crear tabla `workshop_assignments`

```sql
CREATE TABLE workshop_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES workshop_time_slots(id),
  assignment_slot CHAR(1) NOT NULL CHECK (assignment_slot IN ('A', 'B')),
  preference_matched INTEGER,
  assignment_type VARCHAR(20) DEFAULT 'algorithm',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID,
  UNIQUE(team_id, event_id, assignment_slot),
  UNIQUE(team_id, event_id, workshop_id)
);

CREATE INDEX idx_wa_team ON workshop_assignments(team_id);
CREATE INDEX idx_wa_workshop ON workshop_assignments(workshop_id);
CREATE INDEX idx_wa_slot ON workshop_assignments(time_slot_id);
CREATE INDEX idx_wa_event ON workshop_assignments(event_id);

ALTER TABLE workshop_assignments ENABLE ROW LEVEL SECURITY;

-- Solo admin puede gestionar asignaciones
CREATE POLICY "Admins can manage assignments" ON workshop_assignments
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Mentores pueden ver asignaciones de sus equipos (después de publicar)
CREATE POLICY "Mentors can view own team assignments" ON workshop_assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = workshop_assignments.team_id 
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin')
);
```

#### 1.5 Añadir campo `participant_count` a registros

```sql
ALTER TABLE event_registrations 
ADD COLUMN participant_count INTEGER DEFAULT 1;

COMMENT ON COLUMN event_registrations.participant_count IS 
  'Número de participantes del equipo que asistirán al evento';
```

---

### Fase 2: Tipos TypeScript

Actualizar `src/types/database.ts`:

```typescript
// Nuevos tipos
export interface WorkshopTimeSlot {
  id: string;
  event_id: string;
  slot_number: number;
  start_time: string; // TIME as string "HH:mm"
  end_time: string;
  created_at: string;
}

export interface WorkshopPreference {
  id: string;
  team_id: string;
  event_id: string;
  workshop_id: string;
  preference_order: number;
  submitted_by: string;
  submitted_at: string;
}

export interface WorkshopAssignment {
  id: string;
  team_id: string;
  event_id: string;
  workshop_id: string;
  time_slot_id: string;
  assignment_slot: 'A' | 'B';
  preference_matched: number | null;
  assignment_type: 'algorithm' | 'manual';
  assigned_at: string;
  assigned_by: string | null;
}

// Actualizar Workshop existente
export interface Workshop {
  id: string;
  event_id: string;
  name: string;
  description?: string | null;
  company?: string | null;  // NUEVO
  category?: TeamCategory | 'general' | null;
  max_capacity: number;  // Por turno
  current_registrations: number;
  location?: string | null;
  created_at: string;
}
```

---

### Fase 3: Componentes Admin

#### 3.1 Nueva pestaña "Talleres" en Editor de Evento

Ubicación: `src/components/admin/events/WorkshopManager.tsx`

```text
┌─────────────────────────────────────────────────────────────────┐
│ Talleres del Evento                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Turnos Horarios                          [Configurar Turnos]   │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Turno 1: 10:30 - 11:15                                    │   │
│ │ Turno 2: 11:30 - 12:15                                    │   │
│ │ Turno 3: 12:30 - 13:15                                    │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ Talleres                                        [+ Añadir]     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Taller          │ Empresa    │ Aforo/Turno │ Acciones       │ │
│ ├─────────────────┼────────────┼─────────────┼────────────────┤ │
│ │ Ética e IA      │ Santander  │ 30          │ [Editar] [X]   │ │
│ │ Comunicación    │ Repsol     │ 30          │ [Editar] [X]   │ │
│ │ ...             │ ...        │ ...         │ ...            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [📊 Ver Ocupación] [📋 Estado Preferencias] [🔄 Asignación]    │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 Panel de Ocupación

Nueva página: `src/pages/admin/AdminWorkshopCapacity.tsx`

Ruta: `/admin/events/:eventId/workshops/capacity`

Matriz visual con colores por nivel de ocupación.

#### 3.3 Estado de Preferencias

Nueva página: `src/pages/admin/AdminWorkshopPreferences.tsx`

Ruta: `/admin/events/:eventId/workshops/preferences`

Lista de equipos con estado de preferencias + exportación CSV.

#### 3.4 Panel de Asignación

Nueva página: `src/pages/admin/AdminWorkshopAssignment.tsx`

Ruta: `/admin/events/:eventId/workshops/assign`

Pre-validación + ejecución de algoritmo + resultados + reasignación manual.

#### 3.5 Cuadrante Final

Nueva página: `src/pages/admin/AdminWorkshopSchedule.tsx`

Ruta: `/admin/events/:eventId/workshops/schedule`

Vista por turno con lista de equipos por taller.

---

### Fase 4: Flujo de Mentor

#### 4.1 Nueva página de preferencias

Ubicación: `src/pages/events/WorkshopPreferencesPage.tsx`

Ruta: `/events/:eventId/workshop-preferences`

```text
┌─────────────────────────────────────────────────────────────────┐
│ Preferencias de Talleres - Evento Intermedio 2025              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Equipo: [Las Programadoras]  ▼                                 │
│                                                                 │
│ ℹ️ Arrastra para ordenar los talleres (1 = más deseado)        │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [1] 🏦 Ética e IA (Santander)                     ≡ ↑↓     │ │
│ │ [2] 🎤 Comunicación (Repsol)                      ≡ ↑↓     │ │
│ │ [3] 🎨 Diseño y Usabilidad (GFT)                  ≡ ↑↓     │ │
│ │ ...                                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                              [Guardar Preferencias]            │
└─────────────────────────────────────────────────────────────────┘
```

**Lógica clave:**
- Verificar si otro mentor ya envió preferencias
- Bloquear edición después de enviar
- Mostrar modo lectura si ya existe

#### 4.2 Enlace desde MentorDashboard

Añadir card o banner cuando hay evento con preferencias abiertas.

---

### Fase 5: Algoritmo de Asignación

#### 5.1 Hook `useWorkshopAssignment`

Ubicación: `src/hooks/useWorkshopAssignment.ts`

```typescript
interface AssignmentInput {
  eventId: string;
  options: {
    prioritizeFIFO: boolean;
    respectPreferences: boolean;
    balanceSlots: boolean;
  };
}

interface AssignmentResult {
  teamId: string;
  teamName: string;
  participantCount: number;
  workshopA: { workshopId: string; slotNumber: number } | null;
  workshopB: { workshopId: string; slotNumber: number } | null;
  preferenceMatchedA: number | null;
  preferenceMatchedB: number | null;
}

async function runAssignment(input: AssignmentInput): Promise<AssignmentResult[]>
```

**Algoritmo (fiel al especificado):**

1. Obtener equipos ordenados por fecha de inscripción (FIFO)
2. Para cada nivel de preferencia (1→7):
   - Intentar asignar Taller A a equipos sin asignar
   - Buscar turno con capacidad (por participantes, no equipos)
3. Para cada nivel de preferencia (2→7):
   - Asignar Taller B evitando mismo turno y mismo taller que A
4. Validar y reportar errores

---

### Fase 6: Rutas y Navegación

Añadir a `src/App.tsx`:

```typescript
// Rutas de talleres admin
<Route path="/admin/events/:eventId/workshops" element={
  <ProtectedRoute requiredRoles={["admin"]}>
    <AdminEventWorkshops />
  </ProtectedRoute>
} />
<Route path="/admin/events/:eventId/workshops/capacity" element={...} />
<Route path="/admin/events/:eventId/workshops/preferences" element={...} />
<Route path="/admin/events/:eventId/workshops/assign" element={...} />
<Route path="/admin/events/:eventId/workshops/schedule" element={...} />

// Ruta mentor preferencias
<Route path="/events/:eventId/workshop-preferences" element={
  <ProtectedRoute requiredRoles={["mentor", "admin"]}>
    <WorkshopPreferencesPage />
  </ProtectedRoute>
} />
```

---

### Archivos a Crear/Modificar

| Tipo | Archivo | Descripción |
|------|---------|-------------|
| Migración | `supabase/migrations/XXX_workshop_system.sql` | Tablas y políticas RLS |
| Tipos | `src/types/database.ts` | Nuevos tipos |
| Hook | `src/hooks/useWorkshopPreferences.ts` | CRUD preferencias mentor |
| Hook | `src/hooks/useWorkshopAssignment.ts` | Algoritmo de asignación |
| Componente | `src/components/admin/events/WorkshopManager.tsx` | Gestión talleres en evento |
| Componente | `src/components/admin/events/TimeSlotConfig.tsx` | Modal configurar turnos |
| Componente | `src/components/admin/events/WorkshopCapacityMatrix.tsx` | Matriz ocupación |
| Componente | `src/components/workshops/PreferencesSortable.tsx` | Drag & drop preferencias |
| Página | `src/pages/admin/AdminEventWorkshops.tsx` | Vista general talleres |
| Página | `src/pages/admin/AdminWorkshopCapacity.tsx` | Ocupación por turno |
| Página | `src/pages/admin/AdminWorkshopPreferences.tsx` | Estado preferencias |
| Página | `src/pages/admin/AdminWorkshopAssignment.tsx` | Panel asignación |
| Página | `src/pages/admin/AdminWorkshopSchedule.tsx` | Cuadrante final |
| Página | `src/pages/events/WorkshopPreferencesPage.tsx` | Mentor: elegir preferencias |
| Modificar | `src/pages/admin/AdminEventEditor.tsx` | Añadir pestaña Talleres |
| Modificar | `src/pages/mentor/MentorDashboard.tsx` | Enlace a preferencias |
| Modificar | `src/App.tsx` | Nuevas rutas |

---

### Orden de Implementación Sugerido

```text
Semana 1: Base de datos
├── Migraciones SQL
├── Tipos TypeScript
└── Regenerar tipos Supabase

Semana 2: Admin - Configuración
├── WorkshopManager (CRUD talleres en evento)
├── TimeSlotConfig (turnos horarios)
└── Integrar en AdminEventEditor

Semana 3: Admin - Monitoreo
├── WorkshopCapacityMatrix (ocupación)
├── AdminWorkshopPreferences (estado equipos)
└── Exportación CSV

Semana 4: Flujo Mentor
├── PreferencesSortable (drag & drop)
├── WorkshopPreferencesPage
├── Hook useWorkshopPreferences
└── Integrar en MentorDashboard

Semana 5: Algoritmo y Asignación
├── Hook useWorkshopAssignment
├── AdminWorkshopAssignment (panel)
├── Reasignación manual
└── AdminWorkshopSchedule (cuadrante)

Semana 6: Testing y Pulido
├── Tests E2E del flujo completo
├── Exportación PDF cuadrante
└── Ajustes de UX
```

---

### Dependencias Adicionales

Se recomienda añadir para el drag & drop:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

### Consideraciones de Seguridad

1. **RLS estricto**: Solo admin puede ver/modificar asignaciones
2. **Preferencias bloqueadas**: Una vez enviadas, el mentor no puede cambiarlas
3. **Cuadrante oculto**: No visible para mentores hasta que admin lo publique
4. **Validación de capacidad**: En número de participantes, no equipos

