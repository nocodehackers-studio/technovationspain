

## Plan: Corregir HB-02, DT-01 y EV-01

### Resumen de Problemas

| Issue | Descripción | Estado Actual |
|-------|-------------|---------------|
| **HB-02** | No se puede modificar el HUB de un equipo | **FALSO POSITIVO** - Ya existe funcionalidad |
| **DT-01** | No se muestra la edad de las usuarias en USUARIOS | Falta columna en tabla |
| **EV-01** | Inscripción sin DNI obligatorio | Falta configuración de campos requeridos |

---

### Análisis Detallado

#### HB-02: Editar Hub del Equipo

**Estado: YA FUNCIONA**

Al revisar `AdminTeams.tsx`, el diálogo de edición (líneas 520-595) ya incluye:
- Selector de Hub en líneas 555-568
- Mutación `updateTeamMutation` que actualiza `hub_id`
- El menú de acciones tiene la opción "Editar" que abre este diálogo

**No se requieren cambios** - Quizás el usuario no encontró la opción o hubo un problema temporal.

---

#### DT-01: Mostrar edad en tabla de Usuarios

**Problema:** La tabla de `AdminUsers.tsx` no muestra la edad de los usuarios. La edad es crítica para validar la categoría correcta del equipo (Beginner 8-12, Junior 13-15, Senior 16-18).

**Datos disponibles:** El campo `date_of_birth` existe en `profiles` y se usa durante el registro.

**Solución:** Añadir columna "Edad" que calcule la edad a partir de `date_of_birth`.

---

#### EV-01: DNI obligatorio en inscripciones

**Problema:** El formulario de inscripción no valida DNI como obligatorio. Actualmente:
- En `EventRegistrationPage.tsx` línea 60: `dni: z.string().optional()`
- Solo valida formato si se proporciona, pero no es requerido

**Análisis del flujo:**
1. Los tipos de entrada (`event_ticket_types`) tienen `companion_fields_config` para acompañantes
2. **No existe** configuración de campos obligatorios para el titular de la inscripción
3. El DNI debería ser configurable por tipo de entrada

**Solución:** Añadir configuración `required_fields` en tipos de entrada para controlar qué campos son obligatorios para el titular.

---

### Cambios a Realizar

#### 1. Añadir columna Edad en AdminUsers (DT-01)

Añadir columna que calcule edad a partir de `date_of_birth`:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Nombre    │ TG ID │ Roles │ Estado │ Edad │ Equipo │ Hub │ ...     │
├───────────┼───────┼───────┼────────┼──────┼────────┼─────┼─────────┤
│ Ana G.    │ 12345 │ Part  │ ✓      │ 12   │ Power  │ BCN │         │
│ María L.  │ 12346 │ Part  │ ✓      │ 9    │ Tech   │ MAD │         │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. Configurar campos obligatorios por tipo de entrada (EV-01)

Añadir en la tabla `event_ticket_types`:
- Campo `required_fields` para definir qué campos son obligatorios (dni, phone, etc.)

Actualizar el formulario de inscripción para validar según configuración.

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/AdminUsers.tsx` | Añadir columna "Edad" calculada desde `date_of_birth` |
| `src/components/admin/events/TicketTypeManager.tsx` | Añadir sección de campos requeridos para titular |
| `src/pages/events/EventRegistrationPage.tsx` | Validar campos según configuración del ticket |
| Nueva migración SQL | Añadir columna `required_fields` a `event_ticket_types` |

---

### Sección Técnica

#### Cálculo de Edad para AdminUsers

```typescript
// Función helper para calcular edad
const calculateAge = (dateOfBirth: string | null): number | null => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Nueva columna en staticColumns
{
  accessorKey: "date_of_birth",
  header: "Edad",
  enableHiding: true,
  cell: ({ row }) => {
    const age = calculateAge(row.original.date_of_birth);
    if (age === null) return <span className="text-muted-foreground">—</span>;
    
    // Resaltar edades fuera de rango típico (8-18)
    const isOutOfRange = age < 8 || age > 18;
    return (
      <span className={isOutOfRange ? "text-warning font-medium" : ""}>
        {age} años
      </span>
    );
  },
}
```

#### Migración SQL para required_fields

```sql
ALTER TABLE event_ticket_types 
ADD COLUMN required_fields text[] DEFAULT ARRAY['first_name', 'last_name', 'email']::text[];

COMMENT ON COLUMN event_ticket_types.required_fields IS 
  'Campos obligatorios para el titular: dni, phone, team_name, tg_email';
```

#### Configuración en TicketTypeManager

```typescript
const REGISTRATION_FIELDS = [
  { value: "dni", label: "DNI/NIE" },
  { value: "phone", label: "Teléfono" },
  { value: "team_name", label: "Nombre del equipo" },
  { value: "tg_email", label: "Email de Technovation" },
];

// En formData añadir:
required_fields: ["dni"] as string[],

// En Tab de Configuración, nueva sección:
<div className="space-y-3 pt-4 border-t">
  <Label>Campos obligatorios del titular</Label>
  <p className="text-sm text-muted-foreground">
    Además de nombre, apellidos y email (siempre obligatorios)
  </p>
  <div className="grid grid-cols-2 gap-2">
    {REGISTRATION_FIELDS.map((field) => (
      <div key={field.value} className="flex items-center space-x-2">
        <Checkbox
          id={`required-${field.value}`}
          checked={formData.required_fields.includes(field.value)}
          onCheckedChange={() => toggleRequiredField(field.value)}
        />
        <Label htmlFor={`required-${field.value}`} className="font-normal">
          {field.label}
        </Label>
      </div>
    ))}
  </div>
</div>
```

#### Validación Dinámica en EventRegistrationPage

```typescript
// Obtener campos requeridos del ticket seleccionado
const requiredFields = selectedTicket?.required_fields || [];

// Schema dinámico basado en configuración
const createRegistrationSchema = (requiredFields: string[]) => z.object({
  ticket_type_id: z.string().min(1, 'Selecciona un tipo de entrada'),
  first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  last_name: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  email: z.string().email('Introduce un email válido'),
  dni: requiredFields.includes('dni')
    ? z.string().min(1, 'El DNI es obligatorio').refine(validateSpanishDNI, 'Formato de DNI inválido')
    : z.string().optional().refine((val) => !val || validateSpanishDNI(val), 'Formato inválido'),
  phone: requiredFields.includes('phone')
    ? z.string().min(1, 'El teléfono es obligatorio').refine(validateSpanishPhone, 'Formato inválido')
    : z.string().optional().refine((val) => !val || validateSpanishPhone(val), 'Formato inválido'),
  // ... resto de campos
});
```

---

### Resumen de Cambios

| Issue | Acción | Prioridad |
|-------|--------|-----------|
| HB-02 | Ninguna - ya funciona | N/A |
| DT-01 | Añadir columna Edad en AdminUsers | Alta |
| EV-01 | Añadir `required_fields` a tickets + validación dinámica | Alta |

