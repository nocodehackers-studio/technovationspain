

## Plan: Corregir y mejorar Reportes y Exportaciones

Se han identificado varios problemas concretos que se van a resolver:

---

### 1. Reportes > Usuarios: datos no actualizados

**Problema**: El calculo de "Registros Semanales" tiene un bug. Cada semana empieza desde "hoy menos N*7 dias", lo que significa que registros recientes (ej. de hace 2 dias) caen fuera de la ventana actual porque weekStart = hoy (no el inicio de la semana).

**Solucion**: Recalcular las semanas empezando desde el lunes de la semana actual hacia atras, para que los registros recientes siempre aparezcan en la semana correcta.

---

### 2. Reportes > Eventos: datos incorrectos, solo acompanantes

**Problema**: La pestaña de Eventos en Reportes muestra estadisticas con tarjetas (Total Asistentes, Participantes, etc.) pero los datos pueden no coincidir con lo real porque las queries de estadisticas estan separadas de las del EventStatsView y pueden tener logica ligeramente diferente. Ademas, la exportacion de registros del evento (`exportEventRegistrations`) no incluye los acompanantes (de la tabla `companions`), ni filtra por `is_companion = false`.

**Solucion**: 
- Unificar la logica de estadisticas de eventos para que coincida con EventStatsView
- En la exportacion de registros por evento, anadir filas de acompanantes debajo de cada titular (igual que hace EventStatsView en su CSV)
- Filtrar `is_companion = false` en la query de exportacion

---

### 3. Exportar > Miembros de Equipo incompleto

**Problema**: La exportacion de "Miembros de Equipo" solo exporta miembros registrados (de `team_members`). Falta cruzar con `authorized_users` para incluir miembros pendientes del whitelist que aun no se han registrado.

**Solucion**: Enriquecer la exportacion para incluir tambien los miembros del whitelist no registrados, con una columna "Estado" (Registrado/Pendiente).

---

### 4. Exportar > Equipos: faltan datos de estudiantes y mentores del whitelist

**Problema**: `exportTeamsWithDetails` solo incluye miembros de `team_members` (registrados). No cruza con `authorized_users` para mostrar los que estan en el whitelist pero no registrados.

**Solucion**: Cruzar con `authorized_users` por `team_name` para incluir todos los miembros (registrados + pendientes), con columnas separadas para "Estudiantes registradas", "Estudiantes pendientes", "Mentores registrados", "Mentores pendientes".

---

### 5. Exportacion de stats del evento: falta team_name y acompanantes

**Problema**: En la pagina de stats del evento (EventStatsView), la exportacion CSV ya incluye `team_name` y acompanantes. Este punto ya esta resuelto en el codigo actual.

**Verificacion**: El CSV de EventStatsView ya incluye columna "Equipo" (team_name) y filas anidadas de acompanantes. No requiere cambios.

---

### 6. Exportacion cruzada completa plataforma + CSV importado

**Problema**: No existe una exportacion que cruce datos de `profiles` con `authorized_users` para tener toda la info combinada (datos de la plataforma + datos originales del CSV de importacion como city, state, school_name, parent_name, etc.).

**Solucion**: Anadir un nuevo boton de exportacion "Usuarios Completo (cruzado)" que haga join entre `profiles`, `user_roles`, y `authorized_users` para generar un CSV con todos los campos combinados.

---

### Detalles tecnicos

**Archivo: `src/pages/admin/AdminReports.tsx`**

1. **Bug semanas** (lineas 82-97): Cambiar el calculo para usar inicio de semana (lunes) como referencia en vez de "hoy menos N dias"

2. **Stats eventos** (lineas 115-158): Alinear con la logica de EventStatsView para que los numeros coincidan

3. **`exportEventRegistrations`** (lineas 325-369): 
   - Anadir `.eq("is_companion", false)` al query
   - Fetch companions de la tabla `companions` y anadir filas anidadas al CSV
   - Incluir `team_name` (ya esta en el select)

4. **`exportTeamMembers`** (lineas 233-265): 
   - Fetch adicional de `authorized_users` con `team_name` y `profile_type`
   - Cruzar con `team_members` para identificar registrados vs pendientes
   - Anadir columna "Estado" (Registrado/Pendiente)

5. **`exportTeamsWithDetails`** (lineas 267-323): 
   - Fetch `authorized_users` agrupados por `team_name`
   - Anadir columnas: "Estudiantes pendientes", "Mentores pendientes" con nombres
   - Totales separados de registrados y pendientes

6. **Nueva funcion `exportUsersCrossReferenced`**: 
   - Join `profiles` con `authorized_users` por email (o `matched_profile_id`)
   - Join con `user_roles` para incluir roles
   - Join con `teams`/`team_members` para incluir nombre de equipo
   - Columnas resultantes: Nombre, Apellido, Email, Rol, Estado verificacion, Hub, Equipo, Ciudad, Comunidad, Colegio, Empresa, Edad, Consentimiento parental, Consentimiento media, Fecha registro plataforma, Fecha importacion

7. **Modal exportacion**: Verificar que se usa `toast.loading("Exportacion en curso...")` en todas las exportaciones (ya se usa en la mayoria, confirmar consistencia)

