
# Plan: Corregir Política RLS para Permitir a Mentores Ver Registros de su Equipo

## Problema Identificado

El popup de preferencias de talleres no aparece porque la **política RLS de `event_registrations`** impide que el mentor vea los registros de inscripción de los participantes de su equipo.

La política actual dice:

```text
SELECT: user_id = auth.uid() OR has_role(auth.uid(), 'admin')
```

Esto significa que un mentor **solo puede ver sus propias inscripciones**, no las de los participantes de sus equipos.

## Flujo del Hook que Falla

```text
┌─────────────────────────────────────────────────────────┐
│ useWorkshopPreferencesEligibility                       │
├─────────────────────────────────────────────────────────┤
│ 1. Obtener equipos donde soy mentor        ✅ Funciona │
│ 2. Obtener eventos con preferencias open   ✅ Funciona │
│ 3. Obtener participantes del equipo        ✅ Funciona │
│ 4. Consultar registrations de participantes ❌ BLOQUEADO│
│    → RLS devuelve 0 filas porque user_id   │
│      no es auth.uid()                                   │
│ 5. registeredTeamEvents está vacío                      │
│ 6. eligibleTeams = []                                   │
└─────────────────────────────────────────────────────────┘
```

## Solución Propuesta

Añadir una nueva política RLS que permita a los **mentores** ver las inscripciones de los **participantes de sus equipos**.

### Cambio en Base de Datos

Nueva migración SQL:

```sql
-- Permitir a mentores ver registros de participantes de sus equipos
CREATE POLICY "Mentors can view team participant registrations"
ON event_registrations
FOR SELECT
USING (
  -- El usuario inscrito es participante de un equipo donde yo soy mentor
  user_id IN (
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

### Lógica de la Política

1. Obtiene todos los `team_id` donde el usuario actual es mentor
2. Para cada uno de esos equipos, obtiene los `user_id` de los participantes
3. Permite ver inscripciones donde el `user_id` esté en esa lista

## Impacto

- **Seguridad**: Mentores solo ven registros de participantes de SUS equipos, no de todos
- **Funcionalidad**: El hook podrá detectar inscripciones y mostrar el popup correctamente
- **Rendimiento**: La consulta usa índices existentes en `team_members`

## Archivos a Modificar

1. **Nueva migración SQL**: `supabase/migrations/XXXXX_mentor_registration_policy.sql`

## Resultado Esperado

Después del cambio, cuando el mentor entre a su dashboard:
- El hook consultará las inscripciones de sus participantes exitosamente
- Detectará que hay participantes inscritos en el evento con preferencias abiertas
- El popup aparecerá automáticamente
