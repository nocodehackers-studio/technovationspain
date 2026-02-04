

## Plan: DNI Obligatorio en Plataforma y Eventos

### Resumen

El cliente quiere que el DNI sea obligatorio tanto en el registro de la plataforma (Onboarding) como en la inscripción a eventos.

### Estado Actual

| Ubicación | DNI | Implementación |
|-----------|-----|----------------|
| **Tabla `profiles`** | ❌ No existe | La tabla no tiene columna `dni` |
| **Onboarding** | ❌ No se pide | El formulario no incluye el campo |
| **Eventos** | ⚙️ Configurable | Ya implementado con `required_fields` por tipo de entrada |

### Cambios a Realizar

#### 1. Base de Datos

Añadir columna `dni` a la tabla `profiles`:

```sql
ALTER TABLE profiles ADD COLUMN dni text;
```

#### 2. Onboarding (Registro en Plataforma)

Añadir campo DNI al formulario de onboarding con validación de formato español (DNI/NIE).

```text
┌─────────────────────────────────────────────────────┐
│               DATOS PERSONALES                       │
├─────────────────────────────────────────────────────┤
│  Nombre *          │  Apellidos *                   │
│  [_______________] │  [_______________]             │
│                                                     │
│  Fecha de nacimiento *                              │
│  [_______________]                                  │
│                                                     │
│  DNI/NIE *  ← NUEVO                                │
│  [_______________]                                  │
│  "8 números + letra (DNI) o X/Y/Z + 7 números"     │
└─────────────────────────────────────────────────────┘
```

#### 3. Eventos (Ya Implementado)

El sistema ya permite configurar DNI como obligatorio por tipo de entrada. **No requiere cambios adicionales**, pero ahora el formulario de eventos puede pre-rellenar el DNI desde el perfil del usuario.

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| Nueva migración SQL | Añadir columna `dni` a `profiles` |
| `src/pages/Onboarding.tsx` | Añadir campo DNI con validación |
| `src/hooks/useAuth.tsx` | Incluir `dni` en el tipo de perfil |
| `src/pages/events/EventRegistrationPage.tsx` | Pre-rellenar DNI desde perfil en lugar de buscar en registros anteriores |

---

### Sección Técnica

#### Migración SQL

```sql
ALTER TABLE profiles ADD COLUMN dni text;

COMMENT ON COLUMN profiles.dni IS 
  'DNI o NIE del usuario. Formato: 8 dígitos + letra (DNI) o X/Y/Z + 7 dígitos + letra (NIE)';
```

#### Validación de DNI/NIE en Onboarding

```typescript
// Añadir al esquema de validación
const validateSpanishDNI = (value: string): boolean => {
  if (!value) return false; // Obligatorio
  const cleanValue = value.toUpperCase().replace(/\s|-/g, '');
  // DNI: 8 digits + letter
  const dniRegex = /^[0-9]{8}[A-Z]$/;
  // NIE: X/Y/Z + 7 digits + letter
  const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/;
  return dniRegex.test(cleanValue) || nieRegex.test(cleanValue);
};

// En OnboardingData añadir:
dni: string;

// En formData inicial:
dni: '',

// Validación en validateStep1():
if (!formData.dni.trim()) {
  newErrors.dni = 'El DNI/NIE es obligatorio';
} else if (!validateSpanishDNI(formData.dni)) {
  newErrors.dni = 'Formato inválido. Usa 8 números + letra (DNI) o X/Y/Z + 7 números + letra (NIE)';
}
```

#### Campo DNI en formulario Onboarding

```tsx
<div className="space-y-2">
  <Label htmlFor="dni">DNI/NIE *</Label>
  <Input
    id="dni"
    placeholder="12345678A"
    value={formData.dni}
    onChange={(e) => updateField('dni', e.target.value.toUpperCase())}
    maxLength={9}
    className="uppercase"
  />
  <p className="text-xs text-muted-foreground">
    8 números + letra (DNI) o X/Y/Z + 7 números + letra (NIE)
  </p>
  {errors.dni && (
    <p className="text-sm text-destructive">{errors.dni}</p>
  )}
</div>
```

#### Guardar DNI en perfil

```typescript
// En handleSubmit, añadir al profileUpdate:
const profileUpdate: any = {
  first_name: formData.first_name.trim(),
  last_name: formData.last_name.trim(),
  date_of_birth: formData.date_of_birth,
  dni: formData.dni.toUpperCase().trim(), // ← NUEVO
  tg_email: formData.tg_email?.trim() || null,
  // ... resto de campos
};
```

#### Pre-rellenar DNI en eventos desde perfil

```typescript
// En EventRegistrationPage.tsx, modificar useEffect:
useEffect(() => {
  if (profile) {
    form.setValue('first_name', profile.first_name || '');
    form.setValue('last_name', profile.last_name || '');
    form.setValue('email', profile.email || '');
    form.setValue('phone', profile.phone || '');
    form.setValue('tg_email', profile.tg_email || '');
    
    // Pre-rellenar DNI desde perfil (nuevo)
    if (profile.dni) {
      form.setValue('dni', profile.dni);
    }
  }
}, [profile, form]);
```

---

### Consideraciones

| Aspecto | Decisión |
|---------|----------|
| **Menores sin DNI** | Los menores de 14 años en España sí tienen DNI. Si hay casos excepcionales, se puede usar el DNI del tutor |
| **Extranjeros sin NIE** | Usuarios con pasaporte deberían gestionar su NIE antes de registrarse. Alternativa: permitir formato pasaporte |
| **Usuarios existentes** | Los perfiles ya creados tendrán `dni = null`. Se podría forzar completar este dato en su próximo login |
| **Eventos** | DNI sigue siendo configurable por tipo de entrada (por si hay eventos públicos donde no sea necesario) |

---

### Resumen de Cambios

| Cambio | Impacto |
|--------|---------|
| Nueva columna `dni` en `profiles` | Almacenar DNI del usuario |
| Campo DNI obligatorio en Onboarding | Todos los nuevos usuarios deben proporcionarlo |
| Pre-relleno de DNI en eventos desde perfil | Evita búsqueda en registros anteriores |
| Eventos mantienen configuración por tipo | Flexibilidad para eventos públicos |

