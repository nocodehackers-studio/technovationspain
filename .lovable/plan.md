

## Plan: Eliminar Lógica de Menores de 14 Años del Onboarding

### Resumen

Simplificar el registro eliminando la comprobación de edad menor de 14 años y el campo de email del padre/madre/tutor. El campo `parent_email` se mantendrá en la base de datos para ser rellenado a través de la importación CSV.

---

### Cambios a Realizar

Se eliminarán únicamente las partes de UI y lógica relacionadas con `isMinor()`. **No se tocará la base de datos.**

#### 1. Eliminar función `isMinor()`

```typescript
// ELIMINAR (líneas 419-424)
const isMinor = () => {
  if (!formData.date_of_birth) return false;
  const age = calculateAge(formData.date_of_birth);
  return age < 14;
};
```

#### 2. Eliminar validación de `parent_email` en `validateStep1`

```typescript
// ELIMINAR (líneas 209-218)
if (formData.role === 'participant' && isMinor()) {
  if (!formData.parent_email?.trim()) {
    newErrors.parent_email = 'El email del padre/madre/tutor es obligatorio...';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parent_email)) {
    newErrors.parent_email = 'Email inválido';
  } else if (formData.parent_email.trim().toLowerCase() === user?.email?.toLowerCase()) {
    newErrors.parent_email = 'El email del tutor debe ser diferente al tuyo';
  }
}
```

#### 3. Eliminar warning visual de menor de 14 años

```tsx
// ELIMINAR (líneas 508-512)
{formData.role === 'participant' && isMinor() && (
  <p className="text-sm text-warning">
    ⚠️ Al ser menor de 14 años, necesitarás el consentimiento de tu padre/madre/tutor.
  </p>
)}
```

#### 4. Eliminar campo de email del padre

```tsx
// ELIMINAR (líneas 533-555)
{formData.role === 'participant' && isMinor() && (
  <div className="space-y-2">
    <Label htmlFor="parent_email">Email del padre/madre/tutor *</Label>
    ...
  </div>
)}
```

#### 5. Simplificar guardado del perfil

```typescript
// ANTES (línea 306)
parent_email: isMinor() && formData.parent_email?.trim() ? formData.parent_email.trim() : null,

// DESPUÉS
// Eliminar esta línea - el parent_email vendrá de la importación CSV
```

#### 6. Eliminar envío de email de consentimiento

```typescript
// ELIMINAR (líneas 362-384)
if (isMinor() && formData.parent_email?.trim()) {
  try {
    const consentResult = await supabase.functions.invoke('send-platform-consent', {
      body: { userId: user.id },
    });
    ...
  } catch (consentError) {
    ...
  }
}
```

#### 7. Limpiar `OnboardingData` y schema

Eliminar `parent_email` del tipo y del estado inicial del formulario (ya no se usa en el onboarding).

---

### Archivo a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Onboarding.tsx` | Eliminar lógica de menores, campo de parent_email, y envío de consentimiento |

---

### Lo que NO se elimina

| Elemento | Razón |
|----------|-------|
| Columna `parent_email` en `profiles` | Se rellenará vía importación CSV |
| Edge function `send-platform-consent` | Puede usarse desde otro lugar |
| Importación de `Mail` icon | Se sigue usando para el campo de tg_email |

---

### Sección Técnica

#### Líneas específicas a eliminar/modificar

| Líneas | Descripción |
|--------|-------------|
| 88 | Eliminar `parent_email` del schema Zod |
| 101, 130 | Eliminar `parent_email` del tipo y estado inicial |
| 209-218 | Eliminar validación de parent_email para menores |
| 306 | Eliminar guardado de parent_email en profileUpdate |
| 362-384 | Eliminar envío de email de consentimiento |
| 419-424 | Eliminar función `isMinor()` |
| 508-512 | Eliminar warning visual de menor |
| 533-555 | Eliminar campo de email del padre en UI |

---

### Resultado Final

| Antes | Después |
|-------|---------|
| Comprueba si < 14 años | No comprueba edad para consentimiento |
| Muestra warning ⚠️ | Sin warning |
| Pide email del tutor | No pide email del tutor |
| Guarda `parent_email` desde formulario | `parent_email` se obtiene de importación CSV |
| Envía email automático | No envía email de consentimiento |

