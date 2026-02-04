

# Plan: Corregir Error de Foreign Key en useWorkshopPreferencesEligibility

## Problema Identificado

La consulta en el Step 5b falla con error 400 porque intenta usar una relación de foreign key que **no existe** en la base de datos:

```typescript
submitter:profiles!workshop_preferences_submitted_by_fkey(id, first_name, last_name, email)
```

El error exacto es:
```
Could not find a relationship between 'workshop_preferences' and 'profiles' in the schema cache
```

## Causa Raíz

La tabla `workshop_preferences` tiene una columna `submitted_by` que guarda un UUID, pero **no hay un constraint de foreign key** definido hacia la tabla `profiles`. PostgREST requiere que exista ese constraint para poder hacer el join automático.

## Solución Propuesta

Modificar el hook para hacer **dos consultas separadas** en lugar de intentar el join:

1. Obtener las preferencias existentes (sin el join)
2. Obtener los perfiles de los submitters por separado

### Cambio en el código

```text
Archivo: src/hooks/useWorkshopPreferencesEligibility.ts

ANTES (líneas 127-136):
const { data: existingPreferences, error: prefsError } = await supabase
  .from('workshop_preferences')
  .select(`
    team_id,
    event_id,
    submitted_by,
    submitter:profiles!workshop_preferences_submitted_by_fkey(id, first_name, last_name, email)
  `)
  .in('team_id', teamIds)
  .in('event_id', eventIds);

DESPUÉS:
// Primero obtener preferencias sin el join
const { data: existingPreferences, error: prefsError } = await supabase
  .from('workshop_preferences')
  .select('team_id, event_id, submitted_by')
  .in('team_id', teamIds)
  .in('event_id', eventIds);

if (prefsError) throw prefsError;

// Luego obtener perfiles de submitters
const submitterIds = [...new Set(
  existingPreferences?.map(p => p.submitted_by).filter(Boolean) || []
)];

let submittersMap = new Map<string, { id: string; firstName: string | null; lastName: string | null; email: string }>();

if (submitterIds.length > 0) {
  const { data: submitters } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', submitterIds);
  
  submitters?.forEach(s => {
    submittersMap.set(s.id, {
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email,
    });
  });
}
```

### Actualizar el mapeo de preferencias

```text
ANTES (línea 150):
const submitter = (pref.submitter as any);

DESPUÉS:
const submitter = submittersMap.get(pref.submitted_by);
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useWorkshopPreferencesEligibility.ts` | Separar consulta en dos: preferencias y perfiles |

## Resultado Esperado

- La consulta dejará de fallar con error 400
- El hook devolverá correctamente los equipos elegibles
- El popup de preferencias de talleres aparecerá para el mentor

