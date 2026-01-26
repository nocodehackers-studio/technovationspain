

# Plan: Filtrar Tipos de Entrada por Rol del Usuario

## Resumen

Modificar la página de registro de eventos para que solo muestre los tipos de entrada que correspondan al rol del usuario actual. Si un ticket tiene `allowed_roles` configurado, solo los usuarios con ese rol lo verán. Si `allowed_roles` está vacío/null, el ticket será visible para todos.

---

## Cambio a Realizar

| Archivo | Cambio |
|---------|--------|
| `src/pages/events/EventRegistrationPage.tsx` | Filtrar `ticketTypes` por el rol del usuario |

---

## Implementación

### Línea 52: Ya se extrae profile, añadir role

```typescript
// Cambiar de:
const { profile } = useAuth();

// A:
const { profile, role } = useAuth();
```

### Línea 190: Añadir filtro por rol

```typescript
// Cambiar de:
const ticketTypes = event.ticket_types?.filter(t => t.is_active) || [];

// A:
const ticketTypes = event.ticket_types?.filter(t => {
  // Debe estar activo
  if (!t.is_active) return false;
  
  // Si no tiene roles configurados, visible para todos
  if (!t.allowed_roles || t.allowed_roles.length === 0) return true;
  
  // Si el usuario tiene rol, verificar que esté en la lista permitida
  if (role && t.allowed_roles.includes(role)) return true;
  
  // Si no hay rol o no está permitido, ocultar
  return false;
}) || [];
```

---

## Lógica de Filtrado

```text
┌─────────────────────────────────────────────────────────────┐
│                     Tipo de Entrada                         │
├─────────────────────────────────────────────────────────────┤
│ allowed_roles = null/[]    →  Visible para TODOS           │
│ allowed_roles = [participant] → Solo para participantes    │
│ allowed_roles = [mentor]   →  Solo para mentores           │
│ allowed_roles = [judge]    →  Solo para jueces             │
│ allowed_roles = [participant, mentor] → Ambos roles        │
└─────────────────────────────────────────────────────────────┘
```

---

## Ejemplos de Comportamiento

| Usuario | Rol | Tickets Visibles |
|---------|-----|-----------------|
| Estudiante | `participant` | "Entrada de Participante" (si allowed_roles incluye participant) |
| Mentor | `mentor` | "Mentor" (si allowed_roles incluye mentor) |
| Juez | `judge` | "Jueces" (si allowed_roles incluye judge) |
| Admin | `admin` | Solo tickets donde allowed_roles incluya admin o esté vacío |

---

## Nota Técnica

El hook `useAuth` ya proporciona el rol más alto del usuario (basado en prioridad: admin > mentor > judge > volunteer > participant). Este valor se usará directamente para el filtrado.

Si un usuario tiene múltiples roles, verá los tickets correspondientes a su rol de mayor prioridad. Si se necesita que vea todos los tickets de todos sus roles, sería necesario modificar el hook para exponer todos los roles del usuario (cambio adicional no incluido en esta tarea).

---

## Resumen de Cambios

| Archivo | Líneas a Modificar |
|---------|-------------------|
| `src/pages/events/EventRegistrationPage.tsx` | Línea 52 (añadir `role` a useAuth), Línea 190 (filtrado) |

No se requieren cambios en la base de datos.

