
# Plan: Rol de Validador QR (Opción A)

## Resumen

Implementar la funcionalidad para que los administradores puedan asignar el rol `volunteer` a usuarios desde el panel de administración, permitiéndoles acceder al escáner de QR para validar entradas.

---

## Cambios a Realizar

### 1. Permitir acceso a Volunteers en ValidatePage

| Archivo | Cambio |
|---------|--------|
| `src/pages/validate/ValidatePage.tsx` | Modificar la verificación de acceso para permitir `admin` o `volunteer` |

**Implementación:**
- Cambiar la condición de línea 22 de `role !== 'admin'` a `!['admin', 'volunteer'].includes(role || '')`
- Cambiar la condición de línea 33 de `role !== 'admin'` a `!['admin', 'volunteer'].includes(role || '')`

---

### 2. Añadir botón para asignar rol Volunteer en UserEditSheet

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/UserEditSheet.tsx` | Añadir botón "Asignar Validador QR" en acciones rápidas |

**Implementación:**

1. Añadir importación del icono `QrCode` de lucide-react
2. Crear nueva mutación para asignar rol:
```typescript
const assignRoleMutation = useMutation({
  mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success("Rol asignado correctamente");
  },
  onError: (error) => {
    toast.error(`Error al asignar rol: ${error.message}`);
  },
});
```

3. Añadir función para manejar la asignación:
```typescript
const handleAssignVolunteer = useCallback(() => {
  if (!user) return;
  assignRoleMutation.mutate({ userId: user.id, role: 'volunteer' });
}, [user, assignRoleMutation]);
```

4. Añadir botón en la sección de acciones rápidas junto a Validar/Rechazar:
```tsx
<Button
  variant="outline"
  size="sm"
  className="border-success/50 text-success hover:bg-success/10"
  onClick={handleAssignVolunteer}
  disabled={assignRoleMutation.isPending}
>
  <QrCode className="h-4 w-4 mr-1" />
  Asignar Validador QR
</Button>
```

---

### 3. Actualizar tipo UserWithRole para incluir todos los roles

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/UserEditSheet.tsx` | Añadir `roles` al tipo para soportar múltiples roles |

**Consideración:** El sistema actual solo muestra un rol principal. Para mostrar el botón condicionalmente, podríamos:
- Opción A: Mostrar siempre el botón (más simple)
- Opción B: Buscar los roles del usuario para ocultar si ya tiene `volunteer`

Se recomienda **Opción A** por simplicidad, ya que el `upsert` con `onConflict` previene duplicados.

---

## Flujo de Uso

```text
1. Admin abre el panel de Usuarios
2. Hace clic en un usuario
3. Se abre el sidebar (Sheet) con la info del usuario
4. En "Acciones Rápidas" aparece el botón "Asignar Validador QR"
5. Al hacer clic, se asigna el rol 'volunteer' al usuario
6. El usuario ahora puede acceder a /validate para escanear QRs
```

---

## Archivos a Modificar

| Archivo | Tipo de Cambio |
|---------|----------------|
| `src/pages/validate/ValidatePage.tsx` | Cambiar condición de acceso |
| `src/components/admin/UserEditSheet.tsx` | Añadir mutación y botón |

---

## Nota Técnica

La política RLS existente para `user_roles` permite que los admins gestionen todos los roles:

```sql
Policy: "Admins can manage all roles"
Using Expression: has_role(auth.uid(), 'admin'::app_role)
```

Por lo tanto, no se requieren cambios en la base de datos.
