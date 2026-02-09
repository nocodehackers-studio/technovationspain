
# Plan: Gestión de Entradas y Corrección de Estados de Acompañantes

## Resumen de Problemas

1. **Acompañantes aparecen como "Pendiente"** - El UI muestra "Pendiente" basándose en `checked_in_at` en lugar de considerarlos como entradas válidas confirmadas
2. **Admin no puede cancelar entradas** - La vista de estadísticas solo muestra datos, sin acciones
3. **Acompañantes no se eliminan** - Al cancelar una entrada, los companions quedan huérfanos

---

## Cambios Propuestos

### 1. Corregir Badge de Acompañantes (`TicketDetailPage.tsx`)

Cambiar la lógica del badge en la sección de acompañantes:

**Antes (líneas 298-302):**
```tsx
{companion.checked_in_at ? (
  <Badge className="bg-success">Check-in realizado</Badge>
) : (
  <Badge variant="outline">Pendiente</Badge>  // ❌ Confuso
)}
```

**Después:**
```tsx
{companion.checked_in_at ? (
  <Badge className="bg-success">Check-in realizado</Badge>
) : (
  <Badge variant="default">Confirmada</Badge>  // ✅ Entrada válida
)}
```

### 2. Añadir Columna de Acciones en `EventStatsView.tsx`

**Añadir nueva columna con botón de cancelar:**
- Mostrar botón de cancelar para cada registro
- Al cancelar, mostrar diálogo de confirmación
- Ejecutar lógica de cancelación con eliminación de acompañantes
- Decrementar contadores correctamente

**Nueva columna (después de "Fecha registro"):**
```tsx
{
  id: "actions",
  header: "",
  cell: ({ row }) => (
    <Button 
      variant="ghost" 
      size="icon"
      onClick={() => handleCancelRegistration(row.original)}
    >
      <XCircle className="h-4 w-4 text-destructive" />
    </Button>
  ),
}
```

### 3. Crear Lógica de Cancelación Admin con Eliminación de Acompañantes

**Nueva mutación `useAdminCancelRegistration`:**

```typescript
async function cancelRegistration(registrationId: string) {
  // 1. Obtener datos del registro y acompañantes
  const { data: registration } = await supabase
    .from("event_registrations")
    .select("id, event_id, ticket_type_id, registration_status, companions:companions(id)")
    .eq("id", registrationId)
    .single();

  // 2. Eliminar acompañantes de la tabla companions
  await supabase
    .from("companions")
    .delete()
    .eq("event_registration_id", registrationId);

  // 3. Cambiar status a cancelled
  await supabase
    .from("event_registrations")
    .update({ registration_status: "cancelled" })
    .eq("id", registrationId);

  // 4. Decrementar contadores (si no era waitlisted)
  if (registration.registration_status !== "waitlisted") {
    const companionsCount = registration.companions?.length || 0;
    await supabase.rpc("decrement_registration_count", {
      p_event_id: registration.event_id,
      p_ticket_type_id: registration.ticket_type_id,
      p_companions_count: companionsCount,
    });
  }
}
```

### 4. Añadir Diálogo de Confirmación

**En `EventStatsView.tsx`:**
- Importar `ConfirmDialog` existente
- Estado para tracking de registro a cancelar
- Mostrar diálogo con detalles del asistente

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/events/TicketDetailPage.tsx` | Cambiar badge de "Pendiente" a "Confirmada" para acompañantes |
| `src/components/admin/events/EventStatsView.tsx` | Añadir columna de acciones, lógica de cancelación, diálogo de confirmación |

---

## Detalles Técnicos

### Flujo de Cancelación Admin

```
Admin clicka "Cancelar" → Diálogo confirmación → Confirma
  ↓
1. DELETE FROM companions WHERE event_registration_id = X
  ↓
2. UPDATE event_registrations SET registration_status = 'cancelled' WHERE id = X
  ↓
3. RPC decrement_registration_count(event_id, ticket_type_id, companions_count)
  ↓
4. Invalidar queries → Actualizar tabla y métricas
```

### Seguridad

- La operación usa la RLS policy "Admins can delete registrations" existente
- La tabla companions tiene policy "Users can manage companions of own registrations", pero los admins pueden usar service role si es necesario, o se puede añadir una policy de admin
