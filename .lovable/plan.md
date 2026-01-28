
# Plan: Trigger de Vinculación Automática a Equipos + Estadísticas en Admin

## Resumen

Implementar dos mejoras:
1. **Trigger automático**: Cuando un usuario de la whitelist se registra, vincularlo automáticamente a su equipo (si existe en la BD)
2. **Estadísticas en Admin**: Mostrar en la tabla de equipos cuántos miembros están en la whitelist vs cuántos ya se han registrado

---

## Parte 1: Trigger de Base de Datos

### Lógica a Implementar

Modificar la función `auto_verify_authorized_user_after()` para que, además de asignar el rol, también:

1. Buscar si `authorized_record.team_name` tiene valor
2. Si tiene valor, buscar el equipo en la tabla `teams` por nombre (case-insensitive)
3. Si el equipo existe, insertar un registro en `team_members` con:
   - `team_id`: ID del equipo encontrado
   - `user_id`: ID del perfil recién creado (NEW.id)
   - `member_type`: 'participant' si es estudiante, 'mentor' si es mentor

### Pseudocódigo del Trigger

```text
-- Después de asignar el rol...

-- Si el usuario tiene un equipo asignado en la whitelist
IF authorized_record.team_name IS NOT NULL THEN
  -- Buscar el equipo por nombre
  SELECT id INTO team_id 
  FROM teams 
  WHERE lower(name) = lower(authorized_record.team_name)
  LIMIT 1;
  
  IF FOUND THEN
    -- Determinar member_type según profile_type
    IF authorized_record.profile_type = 'student' THEN
      member_type := 'participant';
    ELSE
      member_type := 'mentor';
    END IF;
    
    -- Insertar en team_members
    INSERT INTO team_members (team_id, user_id, member_type)
    VALUES (team_id, NEW.id, member_type)
    ON CONFLICT DO NOTHING;
  END IF;
END IF;
```

---

## Parte 2: Estadísticas en la Vista de Equipos

### Datos a Mostrar

Para cada equipo, mostrar:
- **Whitelist**: Total de usuarios en `authorized_users` con ese `team_name`
- **Registrados**: Cuántos de esos tienen `matched_profile_id` (ya se registraron)

### Visualización Propuesta

En la columna "Miembros" de la tabla, cambiar de:

```text
👥 3
```

A:

```text
👥 2/5  (registrados/whitelist)
```

Con indicador visual:
- Barra de progreso pequeña mostrando el porcentaje
- Color verde cuando todos están registrados
- Tooltip con detalle: "2 de 5 miembros registrados"

### Consulta SQL Necesaria

```sql
SELECT 
  t.*,
  (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as actual_members,
  (SELECT COUNT(*) FROM authorized_users WHERE lower(team_name) = lower(t.name)) as whitelist_count,
  (SELECT COUNT(*) FROM authorized_users WHERE lower(team_name) = lower(t.name) AND matched_profile_id IS NOT NULL) as registered_from_whitelist
FROM teams t
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Actualizar trigger `auto_verify_authorized_user_after` |
| `src/pages/admin/AdminTeams.tsx` | Modificar consulta y columna de miembros |

---

## Detalles de Implementación

### 1. Migración SQL

Crear una nueva migración que:
- Actualice la función `auto_verify_authorized_user_after()`
- Añada la lógica de vinculación a equipos

### 2. Cambios en AdminTeams.tsx

**Query modificado:**
- Agregar subconsulta para contar usuarios en whitelist por team_name
- Agregar subconsulta para contar registrados

**Nueva columna "Miembros":**
- Mostrar formato "X/Y" donde X = registrados, Y = en whitelist
- Si whitelist_count = 0, mostrar solo los miembros actuales (team_members)
- Añadir barra de progreso mini
- Tooltip explicativo

### 3. Componente Visual

```text
+----------------+
|    Miembros    |
+----------------+
| 👥 2/5         |
| [████░░░░] 40% |
+----------------+
```

---

## Consideraciones Técnicas

### Rendimiento de la Consulta

- Las subconsultas pueden ser costosas con muchos equipos
- Alternativa: usar una vista materializada o consulta separada

### Casos Especiales

1. **Equipo sin whitelist**: Mostrar solo miembros actuales (sin barra)
2. **Whitelist sin equipo**: Usuarios que tienen team_name pero el equipo no existe aún
3. **Múltiples equipos mismo nombre**: Usar LIMIT 1 y log de advertencia

### Constraint de team_members

El trigger debe usar `ON CONFLICT DO NOTHING` para evitar duplicados si el usuario ya fue añadido manualmente.

---

## Secuencia de Implementación

1. Crear migración SQL con el trigger actualizado
2. Modificar la consulta en AdminTeams.tsx para obtener estadísticas
3. Actualizar la columna "Miembros" con el nuevo formato visual
4. Añadir tooltip con información detallada
