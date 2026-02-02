## Plan: Mejoras del Sistema de Usuarios

### ✅ COMPLETADO

Todos los cambios han sido implementados correctamente:

1. **✅ Nuevo rol chapter_ambassador** - Añadido al enum de base de datos y a todos los componentes de UI
2. **✅ Sistema de roles múltiples** - Los usuarios ahora pueden tener múltiples roles (ej: mentor + admin)
3. **✅ Restricción de eliminación** - Solo se pueden eliminar usuarios no verificados que no estén en la whitelist
4. **✅ Vista de usuarios sin registrar** - Nueva pestaña que muestra usuarios importados pendientes de registro

### Archivos modificados

- `src/types/database.ts` - Añadido chapter_ambassador al tipo AppRole
- `src/components/admin/RoleBadge.tsx` - Nuevo componente RoleBadges para múltiples roles
- `src/hooks/useAuth.tsx` - Actualizada prioridad de roles
- `src/pages/admin/AdminUsers.tsx` - Sistema de pestañas y soporte para múltiples roles
- `src/components/admin/UserEditSheet.tsx` - MultiRoleSelector y restricción de eliminación
- `src/components/admin/users/MultiRoleSelector.tsx` - Nuevo componente para gestión de roles
- `src/components/admin/users/UnregisteredUsersTable.tsx` - Nueva tabla de usuarios sin registrar

### Tickets relacionados (marcar manualmente como completados)

- Sistema de roles incompleto
- Restricción de eliminación de usuarios  
- Vista de usuarios sin registrar
