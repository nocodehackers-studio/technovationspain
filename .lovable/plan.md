
# Plan: Corregir Pantalla de Confirmación Vacía para Mentores

## Problema Identificado

Cuando un usuario selecciona un tipo de entrada **sin acompañantes** (como la entrada de Mentor), la pantalla de confirmación (paso final) aparece vacía porque hay una inconsistencia en la lógica de steps.

### Causa del Bug

En `src/pages/events/EventRegistrationPage.tsx`:

```text
Línea 94:  totalSteps = maxCompanions > 0 ? 4 : 3
           ─────────────────────────────────────
           Para mentores: totalSteps = 3

Línea 220: setStep(maxCompanions > 0 ? 3 : 4)
           ─────────────────────────────────────
           Para mentores: salta de step 2 a step 4

Línea 558: {step === totalSteps && (...)}
           ─────────────────────────────────────
           Condición: step === 3 (pero step es 4)
           Resultado: El contenido NO se muestra
```

### Flujo del Bug

```text
Mentora en paso 2 (Datos)
        │
        ▼
Click "Siguiente"
        │
        ▼
handleNext() → setStep(4)   ◄── Salta a step 4
        │
        ▼
totalSteps = 3
        │
        ▼
Condición: step === totalSteps  →  4 === 3  →  FALSE
        │
        ▼
Contenido de confirmación NO se renderiza
        │
        ▼
Pantalla vacía ❌
```

## Soluccion

Cambiar la lógica en línea 220 para que cuando no hay acompañantes, salte a step 3 (que es igual a totalSteps), no a step 4:

```typescript
// ANTES (línea 220)
setStep(maxCompanions > 0 ? 3 : 4);

// DESPUÉS
setStep(maxCompanions > 0 ? 3 : 3);  // O simplemente: setStep(3)
```

Pero esto rompe la lógica de navegación hacia atrás. La solución correcta es simplificar toda la lógica para que siempre use `totalSteps` como referencia:

```typescript
// ANTES
setStep(maxCompanions > 0 ? 3 : 4);

// DESPUÉS
setStep(totalSteps);  // Siempre ir al último paso
```

Y ajustar también `handleBack`:

```typescript
// ANTES (línea 233)
if (step === 4 && maxCompanions === 0) {

// DESPUÉS
if (step === totalSteps && maxCompanions === 0) {
```

## Archivos a Modificar

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `src/pages/events/EventRegistrationPage.tsx` | 220 | Cambiar `setStep(maxCompanions > 0 ? 3 : 4)` por `setStep(totalSteps)` |
| `src/pages/events/EventRegistrationPage.tsx` | 233 | Cambiar `step === 4` por `step === totalSteps` |

## Resultado Esperado

| Tipo de entrada | totalSteps | Flujo de steps |
|-----------------|------------|----------------|
| Con acompañantes | 4 | 1 → 2 → 3 → 4 (confirmar) |
| Sin acompañantes | 3 | 1 → 2 → 3 (confirmar) |

Tras el fix, la pantalla de confirmación se mostrará correctamente para todos los tipos de entrada.
