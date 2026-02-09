
# Plan: Evitar Reset del Proceso de Registro al Cambiar de Ventana

## Resumen del Problema

Cuando el usuario cambia de ventana durante el proceso de registro de entrada:
1. Supabase Auth dispara `onAuthStateChange` al volver (para refrescar/verificar token)
2. El `AuthProvider` pone `isLoading = true` mientras recarga el perfil
3. El `ProtectedRoute` muestra "Verificando sesión..." y desmonta el componente
4. Al remontar, todo el estado local del formulario se pierde (step, companions, etc.)

---

## Solución Propuesta

### Opción A: No recargar perfil en TOKEN_REFRESHED (Recomendada)

Modificar `useAuth.tsx` para que solo recargue el perfil en eventos específicos que realmente lo requieran, no en cada cambio de estado:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
  
  // Solo recargar perfil en eventos que realmente lo necesiten
  if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    if (session?.user) {
      setTimeout(() => fetchProfile(session.user.id), 0);
    }
  } else if (event === 'SIGNED_OUT') {
    setProfile(null);
    setRole(null);
  }
  // Ignorar TOKEN_REFRESHED y INITIAL_SESSION - el perfil ya está cargado
});
```

**Ventajas:**
- Solución mínima y directa
- No afecta otras partes de la aplicación
- El token se sigue refrescando, solo no recargamos el perfil innecesariamente

### Opción B: Separar estado de carga inicial de recarga

Añadir un flag `initialLoadComplete` para distinguir entre:
- Carga inicial (mostrar spinner)
- Recarga de perfil (mantener UI, actualizar datos en background)

```typescript
const [initialLoadComplete, setInitialLoadComplete] = useState(false);

// isLoading solo es true durante la carga INICIAL
const isLoading = !initialLoadComplete;
```

---

## Cambios Técnicos (Opción A)

### Archivo: `src/hooks/useAuth.tsx`

**Modificar el listener de auth (líneas 74-96):**

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      console.log('Auth event:', event); // Debug útil
      
      setSession(session);
      setUser(session?.user ?? null);

      // Solo recargar perfil cuando realmente cambia el usuario
      if (event === 'SIGNED_IN') {
        // Usuario acaba de iniciar sesión
        setTimeout(() => fetchProfile(session!.user.id), 0);
      } else if (event === 'USER_UPDATED') {
        // Datos del usuario cambiaron (ej: email, metadata)
        setTimeout(() => fetchProfile(session!.user.id), 0);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setRole(null);
      }
      // TOKEN_REFRESHED e INITIAL_SESSION no necesitan recargar el perfil
    }
  );

  // Carga inicial
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    
    if (session?.user) {
      fetchProfile(session.user.id).finally(() => {
        setIsAuthLoading(false);
      });
    } else {
      setIsAuthLoading(false);
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

---

## Eventos de Supabase Auth

| Evento | Cuándo ocurre | Recargar perfil? |
|--------|---------------|------------------|
| `INITIAL_SESSION` | Al cargar la app (primer check) | No (ya lo hacemos con getSession) |
| `SIGNED_IN` | Login exitoso | Sí |
| `SIGNED_OUT` | Logout | Limpiar datos |
| `TOKEN_REFRESHED` | Token JWT expiró y se renovó | No |
| `USER_UPDATED` | Usuario cambió email/metadata | Sí |
| `PASSWORD_RECOVERY` | Click en link de reset password | No |

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useAuth.tsx` | Filtrar eventos de auth para solo recargar perfil cuando es necesario |

---

## Comportamiento Esperado Después del Cambio

1. Usuario está en paso 3 del registro
2. Cambia de ventana/pestaña
3. Vuelve a la app
4. Supabase dispara `TOKEN_REFRESHED` (si el token se renovó)
5. **El AuthProvider NO recarga el perfil** → `isLoading` sigue siendo `false`
6. **El formulario mantiene su estado** → usuario sigue en paso 3 con sus datos

---

## Notas Adicionales

- Esta solución también mejora el rendimiento general de la app (menos peticiones innecesarias)
- El perfil solo se recarga cuando realmente hay un cambio de usuario
- Si el usuario necesita datos actualizados del perfil, puede usar `refreshProfile()` manualmente
