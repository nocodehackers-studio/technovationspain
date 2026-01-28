
# Plan: Métrica de Whitelist en el Dashboard

## Resumen

Añadir una nueva tarjeta de métricas al dashboard de admin que muestre el progreso de registro de usuarios de la whitelist: cuántos se han registrado vs el total en Technovation Global.

---

## Visualización Propuesta

### Nueva MetricCard

```text
+---------------------------+
|  📋  Whitelist            |
|                           |
|       12 / 499            |
|    "Registrados"          |
|                           |
|  [████████░░░░░░░] 2.4%   |
+---------------------------+
```

### Datos a Mostrar

| Métrica | Descripción | Consulta |
|---------|-------------|----------|
| Total Whitelist | Usuarios en `authorized_users` | `COUNT(*)` |
| Registrados | Con `matched_profile_id IS NOT NULL` | `COUNT(*) WHERE matched_profile_id IS NOT NULL` |
| Pendientes | Sin registro | Total - Registrados |

---

## Cambios en el Dashboard

### Nueva Query

Añadir al fetch de métricas:

```typescript
const [
  { count: whitelistTotal },
  { count: whitelistRegistered },
] = await Promise.all([
  supabase.from("authorized_users").select("*", { count: "exact", head: true }),
  supabase.from("authorized_users").select("*", { count: "exact", head: true }).not("matched_profile_id", "is", null),
]);
```

### Grid de Métricas Actualizado

Cambiar de 4 columnas a 5, o reorganizar para incluir la nueva métrica de whitelist en una posición destacada.

**Opción recomendada**: Mostrar como tarjeta especial más grande con barra de progreso:

```text
+------------+------------+------------+------------+
| Total      | Verificados| Pendientes | Equipos    |
| Usuarios   |            |            |            |
+------------+------------+------------+------------+
|                    Whitelist                      |
|              12 / 499 registrados                 |
|          [████░░░░░░░░░░░░░░░░░░] 2.4%           |
|            487 pendientes de registro            |
+--------------------------------------------------+
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminDashboard.tsx` | Añadir query de whitelist y nueva tarjeta |

---

## Implementación

### 1. Extender la Query de Métricas

Añadir conteos de `authorized_users`:
- Total en whitelist
- Registrados (matched_profile_id NOT NULL)

### 2. Nueva Sección Visual

Crear una Card especial debajo de las métricas actuales que muestre:
- Número de registrados / Total whitelist
- Barra de progreso visual
- Número de pendientes destacado
- Posibilidad de hacer clic para ir a la página de importación

### 3. Información Adicional (Opcional)

Desglose por tipo de perfil:
- Estudiantes: X/Y registrados
- Mentores: X/Y registrados
- Jueces: X/Y registrados

---

## Diseño Visual Propuesto

```text
+--------------------------------------------------+
|  📋  Progreso de Registro - Whitelist            |
+--------------------------------------------------+
|                                                  |
|    12 / 499 usuarios registrados                 |
|                                                  |
|    [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 2.4%      |
|                                                  |
|    ⚠️ 487 usuarios pendientes de registro        |
|                                                  |
|    Por tipo:                                     |
|    • Estudiantes: 8/420                          |
|    • Mentores: 3/65                              |
|    • Jueces: 1/14                                |
|                                                  |
+--------------------------------------------------+
```

Esta tarjeta sería clicable para navegar a `/admin/import-users` o mostrar más detalles.
