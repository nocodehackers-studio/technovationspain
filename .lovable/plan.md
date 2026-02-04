
# Plan: Mejorar la Experiencia de Carga Durante el Login

## Problema Identificado

Cuando el usuario inicia sesión, hay un "salto" de pantallas visible porque:

1. El estado `isLoading` se pone en `false` tan pronto como existe un `user`, pero **antes** de que se cargue el `profile` y el `role`
2. En `Index.tsx`, las redirecciones dependen del `role`, pero como este se carga de forma asíncrona, hay un momento donde `role = null`
3. Esto causa que:
   - El usuario vea brevemente el dashboard genérico
   - Luego salte al dashboard correcto cuando el role se carga

## Solución Propuesta

Modificar `useAuth.tsx` para que `isLoading` permanezca en `true` hasta que **tanto el usuario como su perfil y rol estén completamente cargados**.

## Cambios Técnicos

### 1. Modificar `src/hooks/useAuth.tsx`

Añadir un nuevo estado `isProfileLoading` que rastree específicamente la carga del perfil:

```text
Cambios:
- Añadir estado: const [isProfileLoading, setIsProfileLoading] = useState(false);
- Modificar fetchProfile para establecer setIsProfileLoading(true) al inicio y setIsProfileLoading(false) al final
- Modificar la lógica de isLoading para combinar ambos estados:
  - isLoading = isAuthLoading || isProfileLoading
```

Esto asegura que mientras se esté cargando el perfil/rol, toda la aplicación muestre el loader y no haga redirecciones prematuras.

### 2. Resultado Esperado

- Durante el login: Loader visible hasta que todo esté listo
- Sin saltos entre pantallas
- Redirección directa al dashboard correcto según el rol

## Riesgo

**Bajo**. Solo afecta la sincronización del estado de carga, no cambia la lógica de autenticación ni las redirecciones.
