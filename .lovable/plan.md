
# Plan: Corregir Redirección de Mentores a Dashboard

## Problema Identificado

En el archivo `src/pages/PendingVerification.tsx`, línea 14, cuando un usuario es verificado, se le redirige a `/events` en lugar de `/dashboard`:

```typescript
// Línea 14 - PROBLEMA
if (!isLoading && isVerified) {
  navigate('/events', { replace: true });  // ❌ Debería ser /dashboard
  return null;
}
```

Esto afecta a **todos los usuarios no-admin** (mentores, jueces, voluntarios, participantes) que pasan por la página de verificación pendiente.

## Flujo del Bug

```text
Mentora se registra
       │
       ▼
Completa onboarding
       │
       ▼
Estado: "pending" ────► Redirigida a /pending-verification
       │
       ▼
Admin verifica la cuenta
       │
       ▼
Mentora refresca o vuelve
       │
       ▼
PendingVerification detecta isVerified=true
       │
       ▼
navigate('/events') ◄── BUG: Debería ser /dashboard
```

## Solución

Cambiar la redirección de `/events` a `/dashboard` en `PendingVerification.tsx`:

```typescript
// ANTES
if (!isLoading && isVerified) {
  navigate('/events', { replace: true });
  return null;
}

// DESPUÉS
if (!isLoading && isVerified) {
  navigate('/dashboard', { replace: true });
  return null;
}
```

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/PendingVerification.tsx` | Línea 14: `/events` → `/dashboard` |

## Resultado Esperado

Tras el cambio:
- Mentoras verificadas → redirigidas a `/dashboard`
- Jueces verificados → redirigidos a `/dashboard`  
- Voluntarios verificados → redirigidos a `/dashboard`
- Participantes verificados → redirigidos a `/dashboard`
- Admins → siguen yendo a `/admin` (gestionado en otros puntos del código)

## Verificación del Resto del Flujo

Revisé los demás archivos y la lógica es correcta:

| Archivo | Redirección para no-admins | Estado |
|---------|---------------------------|--------|
| `AuthCallback.tsx` | `/dashboard` | Correcto |
| `Index.tsx` (OTP verify) | `/dashboard` | Correcto |
| `Index.tsx` (ya logueado) | `/dashboard` | Correcto |
| `Onboarding.tsx` | `/dashboard` | Correcto |
| `PendingVerification.tsx` | `/events` | **A corregir** |
