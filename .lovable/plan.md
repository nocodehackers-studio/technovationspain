
## Plan: Filtros combinados en la tabla de Usuarios

### Problema actual
La tabla de usuarios admin solo tiene filtros por "Estado" y "Rol". Falta poder filtrar por **Hub (Chapter)**, **Equipo** y **Comunidad Autonoma**, y poder combinar varios filtros a la vez (ej: "Hub = Madrid + Sin asignar" y "2026").

### Solucion

#### 1. Anadir filtros por Hub y Equipo a `AdminUsers.tsx`

Agregar nuevas entradas en `filterableColumns` con las opciones dinamicas extraidas de los datos:

- **Hub (Chapter)**: Dropdown con todos los hubs disponibles + opcion "Sin Hub" para usuarios sin chapter asignado. Las opciones se generaran dinamicamente desde los datos cargados.
- **Equipo**: Dropdown con todos los equipos disponibles + opcion "Sin equipo". Tambien dinamico.
- **Comunidad Autonoma**: Dropdown con las comunidades autonomas disponibles en los datos.

#### 2. Modificar `AirtableDataTable.tsx` para soportar multi-seleccion en filtros

Actualmente cada filtro es un `Select` que solo permite un valor. Se cambiara a un sistema donde cada filtro permita seleccionar **multiples valores** simultaneamente:

- Reemplazar los `Select` simples por dropdowns con checkboxes (usando `DropdownMenu` + `DropdownMenuCheckboxItem` ya disponibles).
- El estado `activeFilters` pasara de `Record<string, string>` a `Record<string, string[]>` para almacenar multiples valores por filtro.
- Los tags activos mostraran cada valor seleccionado individualmente y se podran quitar uno a uno.

#### 3. Anadir `filterFn` a las columnas relevantes

Las columnas `hub_name`, `team_name`, `city` y `state` necesitaran funciones de filtro personalizadas que soporten arrays de valores y manejen el caso especial de "sin valor" (null/empty).

### Detalles tecnicos

**Cambios en `AirtableDataTable.tsx`:**
- Tipo `activeFilters`: `Record<string, string>` cambia a `Record<string, string[]>`
- Nuevo componente interno de dropdown multi-select para cada filtro
- `filterFn` personalizada que comprueba si el valor de la fila esta incluido en el array de valores seleccionados
- Los tags de filtro activo muestran cada seleccion individual

**Cambios en `AdminUsers.tsx`:**
- Generar `filterableColumns` dinamicamente con `useMemo` para extraer hubs, equipos y comunidades unicos de los datos
- Anadir `filterFn` a las columnas `hub_name`, `team_name` y `state` que soporte multi-valor y el valor especial `__empty__` para "sin asignar"
- Opciones especiales: "Sin Hub", "Sin equipo", "Sin comunidad" con valor `__empty__`

**Archivos afectados:**
- `src/components/admin/AirtableDataTable.tsx` - Multi-select en filtros
- `src/pages/admin/AdminUsers.tsx` - Nuevos filtros dinamicos + filterFn en columnas
