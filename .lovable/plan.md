

# Plan: Corregir Redirección Post-Login y Añadir Navegación al Dashboard

## Resumen del Problema

Hay dos problemas principales:

1. **Redirección incorrecta después de login**: Al iniciar sesión (con OTP o magic link), el usuario es redirigido a `/events` en lugar del dashboard
2. **Sin navegación desde `/events`**: La página de eventos no tiene forma de volver al dashboard

## Análisis de la Causa

### Problema 1: Redirección

Después de verificar el OTP en `Index.tsx` (líneas 98-101), el código solo dice:
```typescript
if (data.session) {
  toast.success('¡Verificación exitosa!');
  // The auth state change will handle redirection
}
```

El problema es que **no se fuerza una navegación explícita**. Se confía en que `onAuthStateChange` dispare un re-render del componente, pero:
- Hay una condición de carrera entre la actualización del estado y la navegación
- Si el usuario ya ha completado onboarding y está verificado, debería ir a `/dashboard`

El `Index.tsx` tiene la lógica correcta (líneas 34-48), pero **la verificación OTP no fuerza un re-render inmediato**.

### Problema 2: Navegación en Events

`EventsListPage.tsx` es una página completa sin header de navegación ni forma de volver al dashboard.

---

## Solución

### 1. Añadir Navegación Explícita Post-Verificación OTP

En `Index.tsx`, después de verificar OTP exitosamente, navegar explícitamente basándose en el rol:

```typescript
if (data.session) {
  toast.success('¡Verificación exitosa!');
  
  // Check profile to determine redirect
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, verification_status')
    .eq('id', data.session.user.id)
    .single();
  
  if (!profile?.onboarding_completed) {
    navigate('/onboarding', { replace: true });
    return;
  }
  
  // Check role for redirect
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.session.user.id);
  
  const rolePriority = ['admin', 'mentor', 'judge', 'volunteer', 'participant'];
  const userRoles = rolesData?.map(r => r.role) || [];
  const highestRole = rolePriority.find(r => userRoles.includes(r));
  
  if (highestRole === 'admin') {
    navigate('/admin', { replace: true });
  } else if (profile?.verification_status !== 'verified') {
    navigate('/pending-verification', { replace: true });
  } else {
    navigate('/dashboard', { replace: true });
  }
}
```

### 2. Añadir Header de Navegación a EventsListPage

Crear un header consistente con navegación de vuelta al dashboard:

```tsx
// Header con navegación
<header className="bg-background border-b sticky top-0 z-10">
  <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
    <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      <span>Volver al dashboard</span>
    </Link>
    <Button variant="ghost" size="icon" onClick={signOut}>
      <LogOut className="h-5 w-5" />
    </Button>
  </div>
</header>
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Index.tsx` | Añadir navegación explícita después de verificación OTP |
| `src/pages/register/RegisterStudent.tsx` | La verificación OTP ya navega a `/onboarding?role=participant` - OK |
| `src/pages/register/RegisterMentor.tsx` | La verificación OTP ya navega a `/onboarding?role=mentor` - OK |
| `src/pages/register/RegisterJudge.tsx` | La verificación OTP ya navega a `/onboarding?role=judge` - OK |
| `src/pages/events/EventsListPage.tsx` | Añadir header con navegación al dashboard |

---

## Detalles de Implementación

### Cambios en `Index.tsx`

La función `handleVerifyOtp` pasará de:
```typescript
if (data.session) {
  toast.success('¡Verificación exitosa!');
  // The auth state change will handle redirection
}
```

A incluir lógica completa de redirección similar a `AuthCallback.tsx`.

### Cambios en `EventsListPage.tsx`

Añadir imports necesarios:
```typescript
import { Link } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
```

Añadir header de navegación antes del hero gradient actual.

---

## Flujo Corregido

```text
Usuario existente → Introduce email en Index.tsx
                         │
                         ▼
              ┌─────────────────────┐
              │ Recibe email con:   │
              │ - Magic Link        │
              │ - Código OTP        │
              └─────────────────────┘
                         │
    ┌────────────────────┴────────────────────┐
    ▼                                         ▼
Magic Link → AuthCallback.tsx           OTP → Index.tsx (handleVerifyOtp)
    │                                         │
    └─────────────┬───────────────────────────┘
                  ▼
         ┌───────────────────┐
         │ Verificar perfil: │
         │ - ¿Onboarding?    │
         │ - ¿Verificado?    │
         │ - ¿Admin?         │
         └───────────────────┘
                  │
    ┌─────────────┼─────────────┬─────────────┐
    ▼             ▼             ▼             ▼
Onboarding   Verificación   /admin      /dashboard
pendiente    pendiente    (admin)     (otros roles)
```

---

## Beneficios

1. **Consistencia**: Tanto magic link como OTP siguen el mismo flujo de redirección
2. **UX mejorada**: Los usuarios siempre llegan a la página correcta según su estado
3. **Navegación**: Desde `/events` se puede volver fácilmente al dashboard

