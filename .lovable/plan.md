

## Plan: Refactorizar Gestión de Equipos

### Resumen
Modificar la pestaña de Equipos para que funcione como vista de solo lectura de los equipos importados vía CSV, eliminando la creación/edición manual y añadiendo filtros avanzados y un campo de notas interno.

---

### Cambios a realizar

#### 1. Base de datos - Añadir campo de notas a equipos

Añadir una columna `notes` a la tabla `teams` para que los administradores puedan añadir comentarios internos sin modificar datos importados.

```sql
ALTER TABLE teams ADD COLUMN notes TEXT;
```

---

#### 2. Interfaz - Eliminar creación manual de equipos

- Eliminar el botón "Crear Equipo" de la barra de herramientas
- Eliminar el diálogo `createDialogOpen` y la mutación `createTeamMutation`
- Mantener solo el botón "Importar CSV" como forma de añadir equipos

---

#### 3. Interfaz - Restringir edición a solo campos internos

Modificar el diálogo de edición para:
- Mostrar nombre, categoría y TG Team ID como campos de solo lectura (información)
- Permitir editar solo:
  - Hub (selector)
  - Notas (campo de texto)

Esto respeta que los datos vienen del CSV de Technovation Global y no deberían modificarse.

---

#### 4. Añadir filtros avanzados en la toolbar

Añadir dropdowns de filtrado adicionales:

| Filtro | Opciones |
|--------|----------|
| **Hub** | Ya existe |
| **Categoría** | Beginner, Junior, Senior, Todas |
| **Estado de registro** | Todos, Completos (100%), Incompletos (<100%), Sin miembros |

Los filtros se aplicarán en cascada sobre los datos ya cargados.

---

#### 5. Añadir columna de Ciudad en la tabla

Obtener la ciudad desde `authorized_users` agrupando por `team_name` y mostrarla como columna informativa.

---

### Cambios visuales

**Antes:**
```text
[Buscar] [Hub ▼] [Importar CSV] [Crear Equipo]
```

**Despues:**
```text
[Buscar] [Categoria ▼] [Hub ▼] [Estado ▼] [Importar CSV]
```

**Diálogo de edición (antes):**
- Nombre (editable)
- Categoría (editable)
- TG Team ID (editable)
- Hub (editable)

**Diálogo de edición (despues):**
- Datos del CSV (solo lectura): Nombre, Categoría, TG ID
- Configuración interna (editable): Hub, Notas

---

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/AdminTeams.tsx` | Eliminar crear equipo, modificar edición, añadir filtros, añadir columna ciudad |
| `src/types/database.ts` | Añadir campo `notes` al tipo Team |
| Nueva migración SQL | Añadir columna `notes` a tabla teams |

---

### Secciones tecnicas

#### Filtro de estado de registro
Se calculará en base a `whitelist_count` y `registered_count`:
```typescript
const filterByCompletionStatus = (team: TeamWithStats, status: string) => {
  if (status === "all") return true;
  if (status === "complete") return team.registered_count === team.whitelist_count && team.whitelist_count > 0;
  if (status === "incomplete") return team.registered_count < team.whitelist_count;
  if (status === "empty") return team.whitelist_count === 0;
  return true;
};
```

#### Obtener ciudad de authorized_users
Se añadirá una consulta agregada para obtener la ciudad más común por equipo:
```typescript
const { data: teamCities } = await supabase
  .from("authorized_users")
  .select("team_name, city")
  .not("team_name", "is", null);

// Agrupar por team_name y obtener ciudad más frecuente
```

