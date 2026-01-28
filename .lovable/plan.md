
# Plan: Refactorizar Importacion CSV para Multi-Rol con Gestion de Conflictos

## Resumen

Adaptar el sistema de importacion para procesar el CSV unificado de Technovation Global que contiene mentores, estudiantes y jueces. El sistema debe:
- Separar los registros por tipo de perfil (profile_type)
- Aplicar logica diferente segun el rol
- Detectar y mostrar conflictos para resolucion manual
- Nunca sobreescribir datos de usuarios activos en la plataforma

---

## Analisis del CSV

### Columnas Clave

| Columna CSV | Proposito | Mapeo |
|-------------|-----------|-------|
| `Participant ID` | ID unico de Technovation Global | `tg_id` |
| `Profile type` | Tipo: student, mentor, judge, chapter_ambassador | Determina el rol |
| `Email` | Email del usuario | `email` |
| `Team division` | Solo estudiantes: Beginner, Junior, Senior | `team_division` |
| `Team name(s)` | Nombre del equipo | `team_name` |
| `Company name` | Solo mentores/jueces | Nuevo campo |
| `School name` | Solo estudiantes | `school_name` |
| `Parent guardian name/email` | Solo estudiantes | `parent_name`, `parent_email` |

### Tipos de Perfil Detectados

| Profile Type | Rol en Plataforma | Cantidad (aprox) |
|--------------|-------------------|------------------|
| `student` | participant | ~1,500 |
| `mentor` | mentor | ~1,800 |
| `judge` | judge | ~350 |
| `chapter_ambassador` | mentor (con flag) | ~30 |

---

## Cambios en Base de Datos

### 1. Nueva tabla: `authorized_users` (reemplaza `authorized_students`)

Esta tabla almacenara la whitelist para TODOS los tipos de usuarios, no solo estudiantes.

```text
+-------------------------+-------------+--------------------------------------+
| Columna                 | Tipo        | Descripcion                          |
+-------------------------+-------------+--------------------------------------+
| id                      | uuid        | PK                                   |
| email                   | text        | Email (unico)                        |
| tg_id                   | text        | ID Technovation Global               |
| profile_type            | text        | student, mentor, judge               |
| first_name              | text        | Nombre                               |
| last_name               | text        | Apellidos                            |
| phone                   | text        | Telefono                             |
| company_name            | text        | Empresa (mentores/jueces)            |
| school_name             | text        | Centro educativo (estudiantes)       |
| team_name               | text        | Nombre del equipo                    |
| team_division           | text        | Beginner, Junior, Senior             |
| parent_name             | text        | Nombre tutor (estudiantes)           |
| parent_email            | text        | Email tutor (estudiantes)            |
| city                    | text        | Ciudad                               |
| state                   | text        | Comunidad/Estado                     |
| age                     | integer     | Edad                                 |
| parental_consent        | text        | Estado consentimiento parental       |
| media_consent           | text        | Estado consentimiento medios         |
| signed_up_at            | date        | Fecha registro en TG                 |
| matched_profile_id      | uuid        | FK a profiles si ya se registro      |
| imported_at             | timestamptz | Fecha de importacion                 |
| created_at              | timestamptz | Fecha creacion                       |
| updated_at              | timestamptz | Fecha actualizacion                  |
+-------------------------+-------------+--------------------------------------+
```

### 2. Migracion de datos existentes

Migrar todos los datos de `authorized_students` a `authorized_users` con `profile_type = 'student'`.

---

## Arquitectura del Sistema de Importacion

### Flujo General

```text
                    +------------------+
                    |  Subir CSV       |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |  Validar         |
                    |  estructura      |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |  Separar por     |
                    |  profile_type    |
                    +--------+---------+
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
   +-----------+      +-----------+      +-----------+
   | Students  |      | Mentors   |      | Judges    |
   +-----------+      +-----------+      +-----------+
          |                  |                  |
          +------------------+------------------+
                             |
                             v
                    +------------------+
                    |  Detectar        |
                    |  Conflictos      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
              v                             v
     +----------------+            +----------------+
     | Sin conflictos |            | Con conflictos |
     | Importar       |            | Mostrar UI     |
     +----------------+            +----------------+
```

### Tipos de Conflicto a Detectar

| Tipo | Descripcion | Accion |
|------|-------------|--------|
| Duplicado en CSV | Mismo email aparece 2+ veces en el CSV | Mostrar para elegir cual importar |
| Ya existe en plataforma | Usuario ya registrado y activo | NO importar, mostrar info |
| Ya en whitelist | Email ya en authorized_users | Opcion de actualizar o ignorar |
| Email de padre como estudiante | Email de parent coincide con email de estudiante | Alerta |

---

## Interfaz de Usuario

### Nueva Pagina: Importacion Unificada

Reemplazar la pagina actual de importacion de estudiantes por una version que:

1. **Paso 1 - Subir CSV**
   - Zona de drag & drop
   - Validacion de estructura

2. **Paso 2 - Resumen Pre-importacion**
   - Mostrar conteo por tipo: X mentores, Y estudiantes, Z jueces
   - Mostrar conteo de divisiones: X Senior, Y Junior, Z Beginner
   - Detectar y listar conflictos ANTES de importar

3. **Paso 3 - Resolver Conflictos** (si existen)
   - Tabla con conflictos agrupados por tipo
   - Para duplicados: selector de cual version mantener
   - Para existentes: mostrar "Este usuario ya esta activo" (no editable)
   - Checkbox "Ignorar todos los existentes"

4. **Paso 4 - Confirmar e Importar**
   - Barra de progreso
   - Log en tiempo real

5. **Paso 5 - Resultados**
   - Resumen: creados, actualizados, ignorados, errores
   - Descarga de errores como CSV

### Componentes a Crear

| Componente | Funcion |
|------------|---------|
| `ImportSummaryCard` | Muestra resumen antes de importar |
| `ConflictResolver` | UI para resolver conflictos |
| `ConflictTable` | Tabla con filas conflictivas |
| `ProfileTypeBadge` | Badge para student/mentor/judge |

---

## Logica de Negocio

### Regla Principal: Nunca Sobreescribir Usuarios Activos

```text
Para cada registro del CSV:
  1. Buscar en profiles por email o tg_email
  2. Si existe Y tiene matched_profile_id:
     -> NUNCA actualizar el profile
     -> Solo actualizar whitelist si hay datos nuevos de TG
  3. Si existe en whitelist pero no en profiles:
     -> Actualizar whitelist con nuevos datos
  4. Si no existe en ninguno:
     -> Crear en whitelist
```

### Asignacion de Rol

| profile_type CSV | Rol Asignado | Notas |
|------------------|--------------|-------|
| `student` | `participant` | Division se guarda en authorized_users |
| `mentor` | `mentor` | |
| `judge` | `judge` | |
| `chapter_ambassador` | `mentor` | Se trata como mentor |

### Triggers de Base de Datos

Adaptar los triggers existentes de auto-verificacion para que:
- Funcionen con la nueva tabla `authorized_users`
- Asignen el rol correcto segun `profile_type`
- Asocien al equipo si `team_name` coincide

---

## Archivos a Modificar/Crear

### Nuevos Archivos

| Archivo | Proposito |
|---------|-----------|
| `src/pages/admin/AdminImportUnified.tsx` | Nueva pagina de importacion |
| `src/components/admin/import/ImportSummaryCard.tsx` | Resumen pre-importacion |
| `src/components/admin/import/ConflictResolver.tsx` | UI resolucion conflictos |
| `src/components/admin/import/ConflictTable.tsx` | Tabla de conflictos |
| `src/components/admin/import/ProfileTypeBadge.tsx` | Badge visual por tipo |

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/AdminImportCSV.tsx` | Redirigir a nueva pagina o eliminar |
| `src/components/admin/AdminSidebar.tsx` | Actualizar enlace de importacion |
| `src/hooks/useAuth.tsx` | Sin cambios (judge ya existe en AppRole) |
| `supabase/migrations/` | Migracion para nueva tabla |

### Migraciones SQL

1. Crear tabla `authorized_users`
2. Migrar datos de `authorized_students`
3. Actualizar triggers de auto-verificacion
4. Actualizar RLS policies

---

## Secuencia de Implementacion

### Fase 1: Base de Datos
1. Crear migracion para `authorized_users`
2. Migrar datos existentes
3. Actualizar triggers

### Fase 2: Backend (Logica)
4. Crear funcion de parsing del CSV
5. Crear detector de conflictos
6. Crear logica de importacion por tipo

### Fase 3: Frontend
7. Crear componentes de UI
8. Crear pagina de importacion unificada
9. Integrar con sidebar

### Fase 4: Pruebas
10. Probar con CSV proporcionado
11. Verificar deteccion de conflictos
12. Verificar que no se sobreescriben usuarios

---

## Consideraciones Tecnicas

### Rendimiento

- El CSV tiene ~3,679 filas
- Procesar en lotes de 50 registros para evitar timeouts
- Mostrar progreso en tiempo real

### Validacion de Datos

- Email: validar formato basico
- Division: solo Beginner, Junior, Senior
- Profile type: solo student, mentor, judge, chapter_ambassador

### Seguridad

- Solo admins pueden acceder
- RLS en authorized_users igual que authorized_students
- Logs de auditoria para cada importacion
