
# Plan: Pagina Dedicada de Importacion de Equipos (Team CSV)

## Resumen

Crear una nueva pagina `/admin/import-teams` dedicada a la importacion de equipos desde el CSV de Technovation Global. Esta pagina funcionara de forma similar a `AdminImportUnified` pero enfocada en equipos, con la capacidad de:
- Crear/actualizar equipos por `tg_team_id`
- Vincular usuarios existentes (estudiantes y mentores) a los equipos
- Actualizar la whitelist `authorized_users` con informacion de equipo para usuarios pendientes

---

## Analisis del CSV de Equipos

### Columnas del CSV

| Columna CSV | Uso | Mapeo |
|-------------|-----|-------|
| `Team ID` | ID unico de TG | `tg_team_id` |
| `Name` | Nombre del equipo | `name` |
| `Division` | Beginner/Junior/Senior | `category` |
| `Student emails` | Lista separada por comas | Vincular como `participant` |
| `Mentor emails` | Lista separada por comas | Vincular como `mentor` |
| `City` | Ciudad | Informativo |
| `State` | Comunidad/Estado | Informativo |
| `Has mentor?` / `Has students?` | Indicadores | Validacion |
| `Number of students` / `Number of mentors` | Conteos | Validacion |
| `Qualified` | Estado de calificacion | Informativo |

### Datos del CSV Proporcionado

- Total de equipos: ~451
- Divisiones: Beginner, Junior, Senior
- Emails separados por comas dentro de cada celda

---

## Flujo de Importacion

```text
+------------------+
|   Subir CSV      |
+--------+---------+
         |
         v
+------------------+
| Validar headers  |
| Team ID, Name,   |
| Division         |
+--------+---------+
         |
         v
+------------------+
| Verificar en BD  |
| - Equipos exist? |
| - Usuarios exist?|
+--------+---------+
         |
         v
+------------------+
| Preview con      |
| estadisticas     |
+--------+---------+
         |
         v
+------------------+
| Procesar:        |
| - Crear/Update   |
| - Vincular users |
| - Update whitelist|
+--------+---------+
         |
         v
+------------------+
|   Resultados     |
+------------------+
```

---

## Logica de Vinculacion de Usuarios

### Para cada email en el CSV:

```text
1. Buscar en `profiles` por email o tg_email
   |
   +-- SI existe:
   |     - Verificar si ya es miembro del equipo
   |     - Si no, insertar en `team_members` con member_type correcto
   |
   +-- NO existe:
         - Buscar en `authorized_users` por email
         - Si existe, actualizar team_name y team_division
         - (Cuando se registre, el trigger lo asignara)
```

### Tipos de miembro

| Email Source | member_type |
|--------------|-------------|
| Student emails | `participant` |
| Mentor emails | `mentor` |

---

## Estadisticas a Mostrar

### Pre-importacion

| Metrica | Descripcion |
|---------|-------------|
| Total equipos | Cantidad de filas en CSV |
| Equipos nuevos | No existen en BD por tg_team_id |
| Equipos a actualizar | Ya existen en BD |
| Por division | Beginner: X, Junior: Y, Senior: Z |
| Estudiantes en CSV | Total de emails de estudiantes |
| Estudiantes encontrados | Cuantos ya tienen perfil |
| Mentores en CSV | Total de emails de mentores |
| Mentores encontrados | Cuantos ya tienen perfil |

### Post-importacion

| Metrica | Descripcion |
|---------|-------------|
| Equipos creados | Nuevos equipos insertados |
| Equipos actualizados | Equipos existentes modificados |
| Miembros vinculados | Registros nuevos en team_members |
| Whitelist actualizada | Registros de authorized_users modificados |
| Errores | Lista de problemas encontrados |

---

## Archivos a Crear/Modificar

### Nuevos Archivos

| Archivo | Proposito |
|---------|-----------|
| `src/pages/admin/AdminImportTeams.tsx` | Nueva pagina de importacion de equipos |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar ruta `/admin/import-teams` |
| `src/components/admin/AdminSidebar.tsx` | Agregar enlace "Importar Equipos" |

---

## Estructura de la Nueva Pagina

### Pasos de la UI

1. **Upload** - Zona de drag & drop para CSV
2. **Preview** - Resumen estadistico y tabla con equipos
3. **Processing** - Barra de progreso
4. **Results** - Resumen final con errores si los hay

### Componentes a Reutilizar

- `AdminLayout` - Layout de admin
- `Card`, `Button`, `Progress` - UI basica
- `Table` - Vista previa de equipos
- `Badge` - Categorias (Beginner/Junior/Senior)
- `ScrollArea` - Lista de errores

---

## Validaciones

### Estructura del CSV

- Columnas requeridas: `Team ID`, `Name`, `Division`
- Limite de filas: 1,000 equipos
- Team ID: no vacio, alfanumerico

### Datos

- Division valida: Beginner, Junior, Senior
- Emails con formato correcto
- Duplicados de Team ID en CSV (advertencia)

---

## Actualizacion del Sidebar

Agregar nuevo item en la seccion "Gestion":

```text
Gestion:
  - Dashboard
  - Usuarios
  - Equipos
  - Hubs
  - Eventos
  - Talleres
  - Importar Usuarios    <-- existente
  - Importar Equipos     <-- NUEVO
  - Reportes
```

---

## Consideraciones Tecnicas

### Rendimiento

- Procesar en lotes de 50 equipos
- Consultas batch para buscar perfiles
- Mostrar progreso en tiempo real

### Seguridad

- Solo admins pueden acceder
- Validacion de estructura antes de procesar
- Logs de auditoria en `csv_imports`

### Tablas Afectadas

| Tabla | Operacion |
|-------|-----------|
| `teams` | INSERT / UPDATE |
| `team_members` | INSERT |
| `authorized_users` | UPDATE (team_name, team_division) |
| `csv_imports` | INSERT (log) |

---

## Diferencias con TeamCSVImport Existente

| Aspecto | Modal Existente | Nueva Pagina |
|---------|-----------------|--------------|
| Ubicacion | Dialog en AdminTeams | Pagina dedicada |
| Navegacion | Desde boton en Teams | Desde sidebar |
| Espacio | Limitado | Pantalla completa |
| Consistencia | Diferente a importacion usuarios | Mismo estilo |

La nueva pagina reemplazara la funcionalidad del modal pero con mejor UX y consistencia visual con la importacion de usuarios.
