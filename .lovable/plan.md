

# Plan: Corregir Problemas de Navegación y Popup de Preferencias de Talleres

## Resumen de Problemas Identificados

Se han detectado **2 problemas principales**:

### Problema 1: Navegación incorrecta para mentores
Cuando un mentor navega desde páginas de eventos/tickets y vuelve atrás, es redirigido a `/dashboard` en lugar de `/mentor/dashboard`.

**Archivos afectados:**
- `src/pages/events/TicketDetailPage.tsx` (líneas 61, 120)
- `src/pages/events/EventsListPage.tsx` (línea 34)  
- `src/pages/events/RegistrationConfirmationPage.tsx` (línea 258)
- `src/pages/events/EventRegistrationPage.tsx` (línea 265)
- `src/pages/Onboarding.tsx` (línea 365)

### Problema 2: Popup de preferencias de talleres no aparece
El popup no se muestra para el mentor a pesar de que:
- La política RLS está correctamente aplicada
- El equipo Tech Innovators tiene 3 participantes registrados
- El evento tiene `workshop_preferences_open = true`
- No hay preferencias ya enviadas

**Causa probable:** Sin logs de consola no puedo confirmar exactamente dónde falla, pero la arquitectura del hook es correcta. Añadiré logging para debugging.

---

## Solución Propuesta

### Parte 1: Crear función helper para rutas de dashboard

Crear un utility que determine la ruta correcta del dashboard según el rol del usuario:

```text
Archivo nuevo: src/lib/dashboard-routes.ts

Función: getDashboardPath(role: AppRole | null): string
- admin → '/admin'
- mentor → '/mentor/dashboard'  
- volunteer → '/voluntario/dashboard'
- otros → '/dashboard'
```

### Parte 2: Actualizar navegación en páginas de eventos

Modificar las siguientes páginas para usar la función helper:

1. **TicketDetailPage.tsx**
   - Importar `useAuth` y `getDashboardPath`
   - Línea 61: Cambiar `navigate('/dashboard')` → `navigate(getDashboardPath(role))`
   - Línea 120: Cambiar `navigate('/dashboard')` → `navigate(getDashboardPath(role))`

2. **EventsListPage.tsx**
   - Línea 34: Cambiar `<Link to="/dashboard">` → usar ruta dinámica

3. **RegistrationConfirmationPage.tsx**
   - Línea 258: Cambiar `<Link to="/dashboard">` → usar ruta dinámica

4. **EventRegistrationPage.tsx**
   - Línea 265: Cambiar `<Link to="/dashboard">` → usar ruta dinámica

5. **Onboarding.tsx**
   - Línea 365: Añadir caso para `mentor`:
   ```typescript
   const redirectPath = isVolunteer 
     ? '/voluntario/dashboard' 
     : (userRoles.includes('mentor') ? '/mentor/dashboard' : '/dashboard');
   ```

### Parte 3: Añadir logging al hook de elegibilidad

Modificar `useWorkshopPreferencesEligibility.ts` para añadir logs de debugging:

```text
Después de cada consulta, añadir:
console.log('[WorkshopEligibility] Step X result:', data);

Esto permitirá identificar exactamente dónde falla la cadena de consultas.
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/lib/dashboard-routes.ts` | **Crear nuevo** - función helper |
| `src/pages/events/TicketDetailPage.tsx` | Actualizar 2 navegaciones |
| `src/pages/events/EventsListPage.tsx` | Actualizar 1 link |
| `src/pages/events/RegistrationConfirmationPage.tsx` | Actualizar 1 link |
| `src/pages/events/EventRegistrationPage.tsx` | Actualizar 1 link |
| `src/pages/Onboarding.tsx` | Añadir caso mentor |
| `src/hooks/useWorkshopPreferencesEligibility.ts` | Añadir logs de debug |

---

## Detalles Técnicos

### Nueva función getDashboardPath

```typescript
import { AppRole } from '@/types/database';

export function getDashboardPath(role: AppRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'mentor':
      return '/mentor/dashboard';
    case 'volunteer':
      return '/voluntario/dashboard';
    default:
      return '/dashboard';
  }
}
```

### Ejemplo de uso en componentes

```typescript
import { getDashboardPath } from '@/lib/dashboard-routes';
import { useAuth } from '@/hooks/useAuth';

// En el componente:
const { role } = useAuth();

// En navegación:
<Link to={getDashboardPath(role)}>Volver al dashboard</Link>

// O con navigate:
navigate(getDashboardPath(role));
```

### Logging para debugging

```typescript
// En useWorkshopPreferencesEligibility.ts
console.log('[WorkshopEligibility] Step 1 - Mentor teams:', mentorTeams);
console.log('[WorkshopEligibility] Step 2 - Open events:', openEvents);
console.log('[WorkshopEligibility] Step 3 - Team participants:', teamParticipants);
console.log('[WorkshopEligibility] Step 4 - Registrations:', registrations);
console.log('[WorkshopEligibility] Final eligible teams:', eligibleTeams);
```

---

## Resultado Esperado

1. **Navegación:** Mentores serán redirigidos a `/mentor/dashboard` al volver desde cualquier página de eventos
2. **Debugging:** Los logs en consola mostrarán exactamente en qué paso falla la detección de elegibilidad
3. **Próximo paso:** Una vez identificada la causa con los logs, se podrá aplicar la corrección específica

