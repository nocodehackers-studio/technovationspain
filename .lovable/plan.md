

## Plan: Mejorar la informacion de miembros en la tabla de Equipos

### Problema actual
La columna "Miembros" solo muestra un ratio de registrados/whitelist sin desglosar cuantas son estudiantes y cuantas son mentoras. Tampoco se ven los nombres directamente. El concepto de "equipo completo" se basa solo en si todos los del whitelist se han registrado, lo cual no es suficiente.

### Solucion

#### 1. Enriquecer la query principal con datos de miembros reales

Modificar la query de equipos para obtener por separado:
- Numero de **estudiantes** registradas (member_type = 'participant' en team_members)
- Numero de **mentores** registrados (member_type = 'mentor' en team_members)
- Nombres de estudiantes y mentores desde la whitelist (authorized_users con profile_type)

Se hara una segunda query a `team_members` con join a `profiles` para obtener nombres reales de los miembros ya vinculados.

#### 2. Redisenar la columna "Miembros" en la tabla

Reemplazar el ratio simple por una celda mas informativa que muestre:
- Iconos/badges con el conteo: ej. "3 estudiantes, 1 mentor"  
- Indicador visual de estado (completo/incompleto) basado en datos reales
- Al hacer hover (tooltip), mostrar los nombres de las estudiantes y mentores

#### 3. Enriquecer el dialogo de "Ver Miembros"

Actualmente ya muestra los miembros vinculados. Se anadira una seccion adicional que muestre los **miembros pendientes** (del whitelist que aun no se han registrado), con su nombre, tipo y estado.

### Detalles tecnicos

**Cambios en `TeamWithStats`:**
```text
+ participant_count: number
+ mentor_count: number
+ members_detail: { name: string; type: 'student' | 'mentor'; registered: boolean }[]
```

**Cambios en la query principal (`AdminTeams.tsx`):**
- Fetch adicional de `team_members` con join a `profiles` agrupado por team_id para obtener conteos y nombres de miembros registrados
- Enriquecer `authorized_users` query para incluir `profile_type`, `first_name`, `last_name` por equipo
- Combinar ambas fuentes: miembros registrados (de team_members) + pendientes (de authorized_users sin matched_profile_id)

**Cambios en la columna "Miembros":**
- Mostrar "X estudiantes, Y mentores" con iconos
- Progress bar basada en miembros registrados vs total whitelist
- Tooltip con lista de nombres

**Cambios en el dialogo de miembros:**
- Separar visualmente estudiantes de mentores con secciones
- Anadir seccion "Pendientes de registro" con nombres del whitelist que no se han registrado aun
- Mostrar badge de estado (registrado/pendiente) junto a cada nombre

**Archivos afectados:**
- `src/pages/admin/AdminTeams.tsx` - Query enriquecida, columna rediseñada, dialogo mejorado

