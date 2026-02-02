

## Plan: Mejoras del Sistema de Usuarios

### Resumen
Implementar cuatro cambios importantes en la gestión de usuarios del panel de administración:
1. **Sistema de roles múltiples**: Permitir que un usuario tenga varios roles simultáneos (ej: mentor + admin) y añadir el rol de Chapter Ambassador
2. **Restricción de eliminación**: Solo permitir eliminar usuarios no verificados que no estén en la whitelist
3. **Vista de usuarios sin registrar**: Nueva pestaña/filtro para ver usuarios importados del CSV que aún no se han registrado en la plataforma

---

### Cambios a Realizar

#### 1. Añadir rol "chapter_ambassador" al sistema

**Base de datos:**
```sql
ALTER TYPE app_role ADD VALUE 'chapter_ambassador' AFTER 'volunteer';
```

**Archivos a modificar:**
- `src/types/database.ts`: Añadir `chapter_ambassador` al tipo `AppRole`
- `src/components/admin/RoleBadge.tsx`: Añadir configuración visual para el nuevo rol
- `src/components/admin/UserEditSheet.tsx`: Incluir opción en el selector de roles
- `src/pages/admin/AdminUsers.tsx`: Añadir filtro por chapter_ambassador

---

#### 2. Sistema de roles múltiples (no exclusivos)

Actualmente el sistema ya soporta múltiples roles en la tabla `user_roles` (hay usuarios con 2-3 roles). El cambio es mostrar **todos los roles** del usuario en lugar de solo el "principal".

**Cambios en UserEditSheet:**
- Cambiar de selector único a **checkboxes de roles primarios** (participant, mentor, judge, chapter_ambassador)
- Separar **roles adicionales** (admin, volunteer) como toggles independientes
- Un usuario puede ser: `mentor + admin` o `participant + volunteer`

**Cambios en AdminUsers:**
- Mostrar múltiples badges de rol en la columna "Rol"
- Fetch de todos los roles del usuario, no solo el primero

**Cambios en RoleBadge:**
- Crear componente `RoleBadges` (plural) que acepta array de roles

---

#### 3. Restricción de eliminación de usuarios

Modificar la lógica de eliminación en `UserEditSheet.tsx` y `AdminUsers.tsx`:

**Condiciones para permitir eliminación:**
- Estado de verificación debe ser `pending` o `rejected` (NO verificados)
- El usuario NO debe existir en `authorized_users` (no está en la whitelist)

**Implementación:**
- Consulta adicional para verificar si el email existe en `authorized_users`
- Deshabilitar/ocultar botón "Eliminar" si no cumple condiciones
- Mostrar tooltip explicando por qué no se puede eliminar

---

#### 4. Vista de usuarios sin registrar (whitelist pendiente)

Crear un sistema de pestañas en AdminUsers con dos vistas:

| Pestaña | Contenido |
|---------|-----------|
| **Registrados** | Usuarios actuales (profiles) - vista actual |
| **Sin Registrar** | Usuarios de `authorized_users` donde `matched_profile_id IS NULL` |

**Datos a mostrar en "Sin Registrar":**
- Email
- Nombre completo
- Tipo de perfil (student, mentor, judge, chapter_ambassador)
- Equipo
- Ciudad
- Fecha de importación

**Acciones disponibles:**
- Enviar Magic Link (invitación a registrarse)
- Filtrar por tipo de perfil

---

### Diagrama de Flujo de Roles

```text
ROLES PRIMARIOS (mutuamente exclusivos en contexto Technovation):
├── participant (estudiante)
├── mentor
├── judge
└── chapter_ambassador

ROLES ADICIONALES (pueden combinarse con primarios):
├── admin (acceso al panel de gestión)
└── volunteer (validador QR en eventos)

Ejemplos válidos:
- mentor + admin
- mentor + volunteer
- participant + volunteer (estudiante que también ayuda)
- chapter_ambassador + admin
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| **Nueva migración SQL** | Añadir `chapter_ambassador` al enum `app_role` |
| `src/types/database.ts` | Actualizar tipo `AppRole` |
| `src/components/admin/RoleBadge.tsx` | Añadir Chapter Ambassador + crear `RoleBadges` |
| `src/components/admin/UserEditSheet.tsx` | Sistema de checkboxes para roles, verificar eliminación |
| `src/pages/admin/AdminUsers.tsx` | Pestañas Registrados/Sin Registrar, mostrar múltiples roles |
| `src/hooks/useAuth.tsx` | Actualizar tipo de roles |

---

### Sección Técnica

#### Consulta para verificar si se puede eliminar un usuario
```typescript
const canDeleteUser = async (user: UserWithRole) => {
  // Verificados no se pueden eliminar
  if (user.verification_status === 'verified') return false;
  
  // Comprobar si está en la whitelist
  const { data } = await supabase
    .from('authorized_users')
    .select('id')
    .ilike('email', user.email)
    .maybeSingle();
  
  // Si existe en whitelist, no se puede eliminar
  return !data;
};
```

#### Consulta para usuarios sin registrar
```typescript
const { data: unregisteredUsers } = await supabase
  .from('authorized_users')
  .select('*')
  .is('matched_profile_id', null)
  .order('imported_at', { ascending: false });
```

#### Fetch de todos los roles de un usuario
```typescript
// Antes: solo un rol
const userRole = roles?.find((r) => r.user_id === profile.id);

// Después: todos los roles
const userRoles = roles?.filter((r) => r.user_id === profile.id).map(r => r.role);
```

---

### Tickets a Marcar como Completados

Al finalizar, marcar estos tickets como "completed":
- `4cd64754-3ec8-445a-a4ba-c67bdf016227` - Sistema de roles incompleto
- `1f069b20-9e58-49cc-91cd-cff440212326` - Restricción de eliminación de usuarios
- `bddfedef-eed9-4a3a-8014-9f22b6e43e2f` - Vista de usuarios sin registrar

