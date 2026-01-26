

# Plan: Corregir Sistema de Cancelación de Entradas

## Resumen

Implementar la Opción A para permitir re-inscripción después de cancelar una entrada, eliminando la constraint de base de datos que lo impide y filtrando las entradas canceladas del dashboard.

## Cambios

### 1. Migración SQL: Eliminar Constraint Única

Crear migración para eliminar la constraint `event_registrations_event_id_user_id_key`:

```sql
-- Eliminar la constraint que impide re-inscripción tras cancelar
ALTER TABLE public.event_registrations 
DROP CONSTRAINT IF EXISTS event_registrations_event_id_user_id_key;

-- Crear índice parcial para optimizar búsquedas de registros activos
CREATE INDEX IF NOT EXISTS idx_event_registrations_active 
ON public.event_registrations (event_id, user_id) 
WHERE registration_status != 'cancelled';
```

### 2. Dashboard: Filtrar Entradas Canceladas

**Archivo:** `src/pages/ParticipantDashboard.tsx`

Añadir filtro `.neq('registration_status', 'cancelled')` a las queries de registros:

```typescript
// Query principal (líneas 53-62)
const { data: mainRegistrations, error: mainError } = await supabase
  .from('event_registrations')
  .select(`
    *,
    event:events(*),
    ticket_type:event_ticket_types(*)
  `)
  .eq('user_id', user.id)
  .eq('is_companion', false)
  .neq('registration_status', 'cancelled')  // ← Nuevo filtro
  .order('created_at', { ascending: false });

// Query de acompañantes (líneas 69-78)
const { data: companionRegistrations, error: compError } = await supabase
  .from('event_registrations')
  .select(`
    *,
    event:events(*),
    ticket_type:event_ticket_types(*)
  `)
  .in('companion_of_registration_id', mainIds)
  .eq('is_companion', true)
  .neq('registration_status', 'cancelled')  // ← Nuevo filtro
  .order('created_at', { ascending: false });
```

## Flujo Final

```text
1. Usuario tiene entrada confirmada
2. Usuario cancela entrada → Estado = "cancelled"
3. Dashboard oculta la entrada cancelada
4. Usuario puede registrarse de nuevo → Se crea nuevo registro sin errores
5. Los contadores de capacidad reflejan correctamente las plazas disponibles
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Eliminar constraint única + crear índice parcial |
| `src/pages/ParticipantDashboard.tsx` | Añadir `.neq('registration_status', 'cancelled')` a las 2 queries |

