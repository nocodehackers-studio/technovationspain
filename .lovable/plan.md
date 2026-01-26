

## Plan: Corrección del Código OTP de 6 a 8 dígitos

### Problema Identificado

Tu proyecto Supabase tiene configurado `auth.email.otp_length = 8`, pero la UI solo acepta 6 dígitos. Esto hace que el código del email no pueda ser introducido correctamente.

| Componente | Configuración Actual | Debería Ser |
|------------|---------------------|-------------|
| Email (Supabase) | 8 dígitos | 8 dígitos |
| UI (InputOTP) | 6 slots | **8 slots** |
| Validación JS | `length !== 6` | **`length !== 8`** |

---

### Archivos a Modificar

Se actualizarán **4 archivos** con los mismos cambios:

1. `src/pages/Index.tsx`
2. `src/pages/register/RegisterStudent.tsx`
3. `src/pages/register/RegisterMentor.tsx`
4. `src/pages/register/RegisterJudge.tsx`

---

### Cambios en Cada Archivo

#### 1. Cambiar validación de longitud

```typescript
// ANTES
if (otpCode.length !== 6) {
  toast.error('Introduce el código de 6 dígitos completo');
  return;
}

// DESPUÉS
if (otpCode.length !== 8) {
  toast.error('Introduce el código de 8 dígitos completo');
  return;
}
```

#### 2. Actualizar maxLength del InputOTP

```tsx
// ANTES
<InputOTP maxLength={6} ...>

// DESPUÉS
<InputOTP maxLength={8} ...>
```

#### 3. Añadir 2 slots adicionales

```tsx
// ANTES
<InputOTPGroup>
  <InputOTPSlot index={0} />
  <InputOTPSlot index={1} />
  <InputOTPSlot index={2} />
  <InputOTPSlot index={3} />
  <InputOTPSlot index={4} />
  <InputOTPSlot index={5} />
</InputOTPGroup>

// DESPUÉS
<InputOTPGroup>
  <InputOTPSlot index={0} />
  <InputOTPSlot index={1} />
  <InputOTPSlot index={2} />
  <InputOTPSlot index={3} />
  <InputOTPSlot index={4} />
  <InputOTPSlot index={5} />
  <InputOTPSlot index={6} />
  <InputOTPSlot index={7} />
</InputOTPGroup>
```

#### 4. Actualizar texto de ayuda

```tsx
// ANTES
<p className="text-xs text-muted-foreground">
  Introduce el código de 6 dígitos del correo
</p>

// DESPUÉS
<p className="text-xs text-muted-foreground">
  Introduce el código de 8 dígitos del correo
</p>
```

#### 5. Actualizar condición del botón

```tsx
// ANTES
disabled={verifyingOtp || otpCode.length !== 6}

// DESPUÉS
disabled={verifyingOtp || otpCode.length !== 8}
```

---

### Resumen de Cambios por Archivo

| Archivo | Líneas a modificar |
|---------|-------------------|
| `Index.tsx` | 82-83, 158, 162-169, 171-173, 179 |
| `RegisterStudent.tsx` | 58-59, 125, 129-136, 138-140, 146 |
| `RegisterMentor.tsx` | 58-59, 125, 129-136, 138-140, 146 |
| `RegisterJudge.tsx` | 58-59, 125, 129-136, 138-140, 146 |

---

### Resultado Esperado

Después de aplicar estos cambios:
- La UI mostrará **8 casillas** para el código OTP
- Los usuarios podrán introducir el código completo de 8 dígitos del email
- La verificación funcionará correctamente tanto con magic link como con código OTP

