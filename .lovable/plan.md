

# Plan: Redirigir a Registro si el Email No Está Registrado

## Problema Actual
Cuando un usuario intenta iniciar sesión con un email que no está registrado en la plataforma:
1. El sistema envía un código de verificación (OTP) de todas formas
2. Si el usuario usa ese código, se crea una cuenta nueva sin completar el flujo de registro adecuado
3. Esto genera usuarios "huérfanos" sin rol ni datos completos

## Comportamiento Deseado
1. Usuario introduce email en la pantalla de inicio de sesión
2. **Antes de enviar el OTP**, verificar si el email existe en `profiles`
3. Si **NO existe**: redirigir a `/register` (pantalla de selección de rol)
4. Si **existe**: proceder normalmente con el envío del código OTP

## Desafío Técnico
Las políticas RLS de `profiles` no permiten consultar la tabla sin estar autenticado. Necesitamos una forma segura de verificar si un email existe.

## Solución Propuesta

### Opción Elegida: Función de Base de Datos `SECURITY DEFINER`

Crear una función PostgreSQL que verifique si un email existe sin exponer datos sensibles.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/` | Nueva migración con función `check_email_exists` |
| `src/pages/Index.tsx` | Llamar a la función antes de enviar OTP y redirigir si no existe |

---

## Cambios Técnicos

### 1. Nueva Migración: Función `check_email_exists`

```sql
CREATE OR REPLACE FUNCTION public.check_email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE lower(email) = lower(check_email)
  )
$$;

-- Permitir que usuarios anónimos llamen a esta función
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated;
```

Esta función:
- Es `SECURITY DEFINER`: se ejecuta con los permisos del creador (admin), no del usuario
- Solo devuelve `true` o `false`, sin exponer datos del usuario
- Usa comparación case-insensitive para mayor robustez

### 2. Modificar `Index.tsx` - handleSignUp

```typescript
const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!email) {
    toast.error("Por favor, introduce tu email");
    return;
  }

  setLoading(true);
  
  // Verificar si el email ya está registrado
  const { data: emailExists, error: checkError } = await supabase
    .rpc('check_email_exists', { check_email: email });
  
  if (checkError) {
    console.error('Error checking email:', checkError);
    // En caso de error, continuamos con el flujo normal
  } else if (!emailExists) {
    // Email no registrado: redirigir a registro
    setLoading(false);
    toast.info("Este email no está registrado. Por favor, crea una cuenta.");
    navigate('/register', { state: { email } }); // Pasar el email para pre-rellenarlo
    return;
  }
  
  // Email existe: continuar con OTP
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost ? window.location.origin : 'https://technovationspain.lovable.app';
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });
  
  // ... resto del código
};
```

### 3. (Opcional) Pre-rellenar email en RegisterSelect

Si queremos una mejor UX, podemos pasar el email como state y pre-rellenarlo en los formularios de registro:

```tsx
// En RegisterSelect.tsx - recibir el email del state
const location = useLocation();
const prefilledEmail = location.state?.email;

// Pasar a los formularios de registro
<Link to={role.href} state={{ email: prefilledEmail }}>
```

---

## Flujo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│  📧 Iniciar sesión                                               │
│  Email: [usuario@ejemplo.com]                                    │
│  [Continuar con email]                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ ¿Email existe   │
                    │ en profiles?    │
                    └─────────────────┘
                     /              \
                   Sí                No
                   /                  \
                  ▼                    ▼
    ┌───────────────────┐    ┌───────────────────────────────┐
    │ Enviar OTP        │    │ Toast: "Email no registrado"  │
    │ → Verificar código│    │ Redirigir a /register         │
    │ → Dashboard       │    │ (con email pre-rellenado)     │
    └───────────────────┘    └───────────────────────────────┘
```

---

## Consideraciones de Seguridad

1. **No se exponen datos sensibles**: La función solo devuelve `true`/`false`
2. **Prevención de enumeración**: Un atacante podría detectar qué emails están registrados, pero esto es aceptable para este caso de uso (muchas plataformas lo hacen)
3. **Rate limiting**: Supabase tiene rate limiting por defecto que mitiga ataques de fuerza bruta

---

## Resultado Esperado

1. Si el usuario introduce un email **registrado**: flujo normal de OTP
2. Si el usuario introduce un email **no registrado**: 
   - Mensaje informativo: "Este email no está registrado. Por favor, crea una cuenta."
   - Redirección automática a `/register`
   - Email pre-rellenado para mejor UX

