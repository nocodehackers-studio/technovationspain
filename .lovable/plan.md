

# Plan: Permitir a Mentores Ver Participantes de sus Equipos + Estado de Asignación de Talleres

## Resumen de Problemas

### Problema 1: RLS bloquea la vista de participantes
Los mentores no pueden ver los datos de los participantes de sus equipos. La política RLS actual en `profiles` solo permite:
- Usuarios ver su **propio** perfil
- Admins ver todos los perfiles

**No existe una política** que permita a los mentores ver los perfiles de participantes en equipos que mentorean.

### Problema 2: No hay visibilidad del estado de asignación de talleres
El mentor no puede ver de un vistazo qué equipos tienen preferencias pendientes de asignar y cuáles ya están asignados.

---

## Solución Propuesta

### Parte 1: Nueva Política RLS en `profiles`

Crear una nueva política que permita a los mentores ver los perfiles de participantes que están en sus equipos:

```sql
CREATE POLICY "Mentors can view team participants profiles"
ON profiles
FOR SELECT
USING (
  -- El perfil pertenece a un participante que está en un equipo donde el usuario actual es mentor
  id IN (
    SELECT tm_participant.user_id
    FROM team_members tm_participant
    WHERE tm_participant.member_type = 'participant'
    AND tm_participant.team_id IN (
      SELECT tm_mentor.team_id
      FROM team_members tm_mentor
      WHERE tm_mentor.user_id = auth.uid()
      AND tm_mentor.member_type = 'mentor'
    )
  )
);
```

### Parte 2: Indicador de Estado de Talleres en el Dashboard del Mentor

Modificar la tarjeta de "Mis Equipos" para mostrar el estado de asignación de preferencias de talleres:

**En cada equipo mostrar:**
- Badge verde "Talleres asignados" si ya se enviaron preferencias
- Badge naranja "Talleres pendientes" si hay evento con preferencias abiertas y no se ha enviado
- Sin badge si no hay eventos con preferencias abiertas

**Añadir un botón/link** que lleve directamente a la página de preferencias de talleres cuando haya preferencias pendientes.

---

## Archivos a Crear/Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/XXXX_mentor_view_profiles.sql` | **Crear** - Nueva política RLS |
| `src/pages/mentor/MentorDashboard.tsx` | Modificar la sección de equipos para mostrar estado de talleres |

---

## Detalles Técnicos

### Migración SQL

```sql
-- Permitir a mentores ver perfiles de participantes de sus equipos
CREATE POLICY "Mentors can view team participants profiles"
ON profiles
FOR SELECT
USING (
  id IN (
    SELECT tm_participant.user_id
    FROM team_members tm_participant
    WHERE tm_participant.member_type = 'participant'
    AND tm_participant.team_id IN (
      SELECT tm_mentor.team_id
      FROM team_members tm_mentor
      WHERE tm_mentor.user_id = auth.uid()
      AND tm_mentor.member_type = 'mentor'
    )
  )
);
```

### Cambios en MentorDashboard.tsx

1. **Importar datos de elegibilidad existentes** (ya están disponibles via `useWorkshopPreferencesEligibility`)

2. **Crear helper para obtener estado de taller por equipo:**
```typescript
// Función para determinar el estado de talleres de un equipo
const getWorkshopStatus = (teamId: string) => {
  const teamEligibility = eligibleTeams.filter(t => t.teamId === teamId);
  
  if (teamEligibility.length === 0) {
    // No hay eventos con preferencias abiertas para este equipo
    return null;
  }
  
  const hasSubmitted = teamEligibility.some(t => t.hasSubmittedPreferences);
  const hasPending = teamEligibility.some(t => !t.hasSubmittedPreferences);
  
  return {
    hasSubmitted,
    hasPending,
    events: teamEligibility,
  };
};
```

3. **Mostrar badges de estado en cada tarjeta de equipo:**
```typescript
// Dentro del render de cada equipo
{workshopStatus?.hasPending && (
  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
    <Clock className="mr-1 h-3 w-3" />
    Talleres pendientes
  </Badge>
)}
{workshopStatus?.hasSubmitted && !workshopStatus?.hasPending && (
  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
    <CheckCircle2 className="mr-1 h-3 w-3" />
    Talleres asignados
  </Badge>
)}
```

4. **Añadir botón para ir a preferencias** cuando haya pendientes:
```typescript
{workshopStatus?.hasPending && (
  <Link 
    to={`/events/${workshopStatus.events.find(e => !e.hasSubmittedPreferences)?.eventId}/workshop-preferences`}
    onClick={(e) => e.stopPropagation()}
  >
    <Button size="sm" variant="secondary">
      Asignar talleres
    </Button>
  </Link>
)}
```

---

## Visualización del Resultado

Cada tarjeta de equipo mostrará:

```text
┌─────────────────────────────────────────────────────────────────┐
│  👥 Tech Innovators                    [Talleres pendientes] 🟠 │
│     3 participantes • beginner                [Asignar talleres]│
├─────────────────────────────────────────────────────────────────┤
│  (contenido expandible con participantes)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  👥 [DEMO] Data Divas                  [Talleres asignados] 🟢   │
│     0 participantes • junior • AECOM                             │
├─────────────────────────────────────────────────────────────────┤
│  (contenido expandible con participantes)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

1. **Perfiles visibles:** Los mentores podrán ver los nombres, emails e iniciales de los participantes de sus equipos
2. **Estado de talleres visible:** Cada equipo mostrará claramente si tiene preferencias pendientes o ya asignadas
3. **Acceso rápido:** Botón directo para ir a asignar talleres cuando haya pendientes
4. **Popup informativo:** El popup existente seguirá mostrándose automáticamente al entrar, pero ahora también habrá indicadores visuales persistentes en cada equipo

