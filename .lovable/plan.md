
# Plan: Mejora del Flujo de Registro por Rol + Verificación con Código

## Resumen

Implementaremos un sistema de registro diferenciado por tipo de usuario (niñas, mentoras, jueces) con URLs separadas, permitiremos verificación mediante código OTP además del magic link, y actualizaremos los mensajes de verificación pendiente.

---

## Alcance de los Cambios

### 1. Páginas de Registro Separadas por Rol

Crearemos tres rutas nuevas con flujos adaptados:

| Ruta | Rol | Edad Requerida |
|------|-----|----------------|
| `/register/student` | participant | 7-18 años |
| `/register/mentor` | mentor | 18+ años |
| `/register/judge` | judge | 18+ años |

**Página de selección inicial (`/register`):**
- Tres opciones claras con iconos y descripciones
- Links a cada flujo específico

### 2. Verificación con Código OTP

El email actual ya incluye el código de verificación (token), pero no hay forma de usarlo. Añadiremos:

**En la pantalla de "Revisa tu correo" (`Index.tsx`):**
- Campo de texto para introducir el código de 6 caracteres
- Botón "Verificar código"
- Llamada a `supabase.auth.verifyOtp({ email, token, type: 'email' })`

### 3. Actualización de Mensajes de Verificación Pendiente

**Cambios en `PendingVerification.tsx` y `VerificationPendingModal.tsx`:**
- Añadir: "Este proceso puede durar hasta 24 horas"
- Añadir: "Recibirás un correo de confirmación cuando tu cuenta esté activa"
- Cambiar email de soporte a: `soporte@powertocode.org`

### 4. Validación de Edad por Rol

- **Estudiantes (participant):** Validar edad 7-18 años
- **Mentoras/Jueces:** Validar edad 18+ años
- Mostrar error si la edad no corresponde al rol seleccionado

### 5. Actualización de RLS Policy

Modificar la política de `user_roles` para permitir que los usuarios se auto-asignen también los roles `mentor` y `judge` (no solo `participant`).

---

## Arquitectura de Archivos

```text
src/
├── pages/
│   ├── Index.tsx                    # Modificar: añadir verificación OTP
│   ├── PendingVerification.tsx      # Modificar: mensajes actualizados
│   └── register/
│       ├── RegisterSelect.tsx       # NUEVO: selección de tipo de usuario
│       ├── RegisterStudent.tsx      # NUEVO: registro para niñas (7-18)
│       ├── RegisterMentor.tsx       # NUEVO: registro para mentoras (18+)
│       └── RegisterJudge.tsx        # NUEVO: registro para jueces (18+)
├── components/
│   └── auth/
│       └── VerificationPendingModal.tsx  # Modificar: mensajes actualizados
└── App.tsx                          # Añadir nuevas rutas
```

---

## Detalles de Implementación

### Flujo de Selección de Rol (`/register`)

```text
┌────────────────────────────────────────────────────────────┐
│                   ¿Quién eres?                             │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    👧        │  │    👩‍🏫        │  │    ⚖️        │     │
│  │  Estudiante  │  │   Mentora    │  │    Juez      │     │
│  │   (7-18)     │  │    (18+)     │  │    (18+)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
│              ¿Ya tienes cuenta? Inicia sesión              │
└────────────────────────────────────────────────────────────┘
```

### Componente de Verificación OTP (en Index.tsx)

```text
┌────────────────────────────────────────────────────────────┐
│                   Revisa tu correo                         │
│                                                            │
│   Hemos enviado un enlace a tu@email.com                  │
│                                                            │
│   ─────────────── o ───────────────                       │
│                                                            │
│   Introduce el código de verificación:                     │
│   ┌──────────────────────────────────┐                    │
│   │           ______                 │                    │
│   └──────────────────────────────────┘                    │
│                                                            │
│   [    Verificar código    ]                               │
│                                                            │
│   [Volver e intentar con otro email]                       │
└────────────────────────────────────────────────────────────┘
```

---

## Sección Técnica

### Migración de Base de Datos

Se necesita actualizar la política RLS de `user_roles` para permitir auto-registro de mentores y jueces:

```sql
-- Permitir auto-registro de participant, mentor y judge
DROP POLICY IF EXISTS "Users can insert own participant role" ON user_roles;

CREATE POLICY "Users can insert own allowed role" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND role IN ('participant'::app_role, 'mentor'::app_role, 'judge'::app_role)
  AND (
    NOT EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.verification_status = 'verified')
  )
);
```

### Verificación OTP con Supabase

```typescript
// Verificar con código OTP
const { data, error } = await supabase.auth.verifyOtp({
  email: email,
  token: otpCode,
  type: 'email'  // o 'magiclink' dependiendo del tipo de OTP
});
```

### Validación de Edad por Rol

```typescript
const calculateAge = (birthDate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const validateAgeForRole = (role: string, age: number): boolean => {
  if (role === 'participant') return age >= 7 && age <= 18;
  if (role === 'mentor' || role === 'judge') return age >= 18;
  return false;
};
```

### Nuevas Rutas en App.tsx

```typescript
// Rutas de registro por rol
<Route path="/register" element={<RegisterSelect />} />
<Route path="/register/student" element={<RegisterStudent />} />
<Route path="/register/mentor" element={<RegisterMentor />} />
<Route path="/register/judge" element={<RegisterJudge />} />
```

---

## Mensajes Actualizados

### Verificación Pendiente (nuevo texto)

> **¿Qué debo hacer?**
> - Asegúrate de estar registrada en Technovation Global
> - Usa el mismo email que usaste aquí
> - **Este proceso puede durar hasta 24 horas**
> - **Recibirás un correo de confirmación cuando tu cuenta esté activa**
>
> Si tienes dudas, contacta con soporte@powertocode.org

### Mensaje de Menores de 14 años

> ⚠️ Al ser menor de 14 años, necesitarás el consentimiento de tu padre/madre/tutor.

---

## Flujo Completo

```text
Usuario nuevo → ¿Quién eres?
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
Estudiante       Mentora          Juez
(7-18 años)      (18+ años)       (18+ años)
    │               │               │
    └───────────────┼───────────────┘
                    ▼
         Introduce tu email
                    │
                    ▼
         ┌─────────────────────┐
         │ Recibe email con:   │
         │ - Magic Link        │
         │ - Código OTP        │
         └─────────────────────┘
                    │
    ┌───────────────┴───────────────┐
    ▼                               ▼
Clic en Magic Link           Introduce código OTP
    │                               │
    └───────────────┬───────────────┘
                    ▼
           Onboarding adaptado al rol
           (valida edad según rol)
                    │
                    ▼
           ¿En whitelist?
           ┌────┴────┐
           ▼         ▼
          Sí        No
           │         │
           ▼         ▼
        Dashboard  Verificación
                   Pendiente (24h)
```

---

## Resumen de Cambios

| Componente | Cambio |
|------------|--------|
| `RegisterSelect.tsx` | Nueva página de selección de rol |
| `RegisterStudent.tsx` | Nuevo flujo para estudiantes |
| `RegisterMentor.tsx` | Nuevo flujo para mentoras |
| `RegisterJudge.tsx` | Nuevo flujo para jueces |
| `Index.tsx` | Añadir campo OTP para verificación con código |
| `Onboarding.tsx` | Adaptar según rol seleccionado en el registro |
| `PendingVerification.tsx` | Mensajes actualizados (24h, email confirmación) |
| `VerificationPendingModal.tsx` | Mensajes actualizados + email soporte |
| `App.tsx` | Nuevas rutas `/register/*` |
| RLS Policy `user_roles` | Permitir mentor y judge además de participant |

