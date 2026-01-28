
# Plan: Proteger Datos Sensibles en authorized_students y authorized_users

## Resumen del Problema

Las tablas `authorized_students` y `authorized_users` contienen datos sensibles de menores y adultos que están siendo expuestos a través de las políticas RLS actuales:

| Tabla | Datos Expuestos | Riesgo |
|-------|-----------------|--------|
| authorized_students | email, teléfono, email padres, nombre padres, escuela, edad | CRÍTICO (menores) |
| authorized_users | email, teléfono, email padres, nombre padres, empresa, escuela | ALTO |

### Problema de Seguridad Actual

La política `"Users can check their own authorization"` permite a los usuarios ver **todas las columnas** de su registro cuando buscan por email:

```sql
-- Política actual (INSEGURA)
CREATE POLICY "Users can check their own authorization"
ON public.authorized_students FOR SELECT
USING (lower(email) = lower((SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())));
```

Un usuario autenticado puede ejecutar:
```sql
SELECT * FROM authorized_students WHERE email ILIKE 'mi@email.com'
-- Devuelve: email, phone, parent_name, parent_email, school_name, age, etc.
```

---

## Solución Propuesta

### Enfoque: Vistas Seguras + RLS Restringido

1. **Crear vistas públicas** que solo exponen columnas no sensibles
2. **Restringir RLS** en tablas base para denegar SELECT directo a no-admins
3. **Actualizar código** para usar las vistas seguras
4. **Mantener triggers** que usan `SECURITY DEFINER` (ya tienen acceso admin interno)

---

## Arquitectura

```text
Usuario Normal                    Admin
     |                              |
     v                              v
Vista: authorized_students_safe   Tabla: authorized_students
(solo: id, email, tg_id,          (acceso completo)
 matched_profile_id)
```

---

## Cambios en Base de Datos

### 1. Crear Vistas Seguras

```sql
-- Vista segura para authorized_students
-- Solo expone datos necesarios para verificación
CREATE VIEW public.authorized_students_safe
WITH (security_invoker=on) AS
  SELECT 
    id,
    email,
    tg_id,
    matched_profile_id
    -- EXCLUYE: phone, parent_name, parent_email, school_name, age, etc.
  FROM public.authorized_students;

-- Vista segura para authorized_users
CREATE VIEW public.authorized_users_safe
WITH (security_invoker=on) AS
  SELECT 
    id,
    email,
    tg_id,
    profile_type,
    matched_profile_id
    -- EXCLUYE: phone, parent_name, parent_email, school_name, company_name, etc.
  FROM public.authorized_users;
```

### 2. Actualizar Políticas RLS en Tablas Base

```sql
-- AUTHORIZED_STUDENTS
-- Eliminar política de usuarios que expone datos sensibles
DROP POLICY IF EXISTS "Users can check their own authorization" ON public.authorized_students;

-- Nueva política: Solo admins pueden SELECT directamente
-- Los usuarios normales usarán la vista authorized_students_safe
CREATE POLICY "Only admins can select authorized_students"
ON public.authorized_students FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Mantener política de admins para ALL operations
-- (ya existe: "Admins can manage authorized students")

-- AUTHORIZED_USERS
DROP POLICY IF EXISTS "Users can check their own authorization" ON public.authorized_users;

CREATE POLICY "Only admins can select authorized_users"
ON public.authorized_users FOR SELECT
USING (has_role(auth.uid(), 'admin'));
```

### 3. Crear Políticas RLS para las Vistas

```sql
-- Política para vista authorized_students_safe
CREATE POLICY "Users can check own authorization via safe view"
ON public.authorized_students_safe FOR SELECT
USING (
  lower(email) = lower((SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()))
  OR has_role(auth.uid(), 'admin')
);

-- Política para vista authorized_users_safe
CREATE POLICY "Users can check own authorization via safe view"
ON public.authorized_users_safe FOR SELECT
USING (
  lower(email) = lower((SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()))
  OR has_role(auth.uid(), 'admin')
);
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Onboarding.tsx` | Usar `authorized_students_safe` y `authorized_users_safe` |

**Nota**: Las páginas de admin (`AdminUsers.tsx`, `AdminDashboard.tsx`, `AdminImportCSV.tsx`, etc.) **no necesitan cambios** porque ya requieren rol admin y la política de admin sigue permitiendo acceso completo.

---

## Cambios en Código

### Onboarding.tsx

**Antes (líneas 243-247):**
```typescript
const { data: authorized } = await supabase
  .from('authorized_students')
  .select('*')  // ← INSEGURO: obtiene todos los datos
  .ilike('email', formData.tg_email.trim())
  .maybeSingle();
```

**Después:**
```typescript
const { data: authorized } = await supabase
  .from('authorized_students_safe')  // ← Vista segura
  .select('id, tg_id, matched_profile_id')  // Solo datos necesarios
  .ilike('email', formData.tg_email.trim())
  .maybeSingle();
```

---

## Triggers Existentes (No Requieren Cambios)

Los triggers de auto-verificación ya usan `SECURITY DEFINER`, lo que significa que se ejecutan con permisos elevados y no se ven afectados por las políticas RLS:

- `auto_verify_authorized_student_before` - SECURITY DEFINER ✓
- `auto_verify_authorized_student_after` - SECURITY DEFINER ✓
- `auto_verify_authorized_user_before` - SECURITY DEFINER ✓
- `auto_verify_authorized_user_after` - SECURITY DEFINER ✓

Estos triggers pueden seguir accediendo a las tablas base directamente.

---

## Resumen de Seguridad

| Aspecto | Antes | Después |
|---------|-------|---------|
| Usuario ve email padres | Sí | No |
| Usuario ve teléfono | Sí | No |
| Usuario ve escuela | Sí | No |
| Usuario ve edad | Sí | No |
| Admin accede a todo | Sí | Sí |
| Auto-verificación funciona | Sí | Sí |
| Dashboard admin funciona | Sí | Sí |

---

## Orden de Implementación

1. Crear migración SQL con vistas y políticas actualizadas
2. Actualizar `Onboarding.tsx` para usar vistas seguras
3. Actualizar tipos TypeScript (se generarán automáticamente)
4. Probar flujo de onboarding para participantes
5. Probar acceso admin a datos completos
6. Verificar que triggers de auto-verificación siguen funcionando

---

## Consideraciones Adicionales

### Compatibilidad con Código Existente

Las páginas de admin (`AdminUsers.tsx`, `AdminImportCSV.tsx`, `AdminImportUnified.tsx`, `AdminImportTeams.tsx`, `AdminReports.tsx`, `AdminDashboard.tsx`) seguirán funcionando porque:

1. Solo usuarios con rol `admin` pueden acceder a estas páginas
2. La política `"Admins can manage authorized students/users"` sigue activa
3. El rol admin puede hacer SELECT, INSERT, UPDATE, DELETE en las tablas base

### Datos que Siguen Accesibles para Admins

Los admins seguirán pudiendo ver y exportar todos los datos sensibles:
- Listado de estudiantes con emails de padres (AdminImportCSV)
- Exportación CSV completa (AdminReports)
- Estadísticas de whitelist (AdminDashboard)
- Asignación de escuelas a usuarios (AdminUsers)
