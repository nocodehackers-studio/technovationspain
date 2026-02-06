
# Plan de Mejoras: Registro de Eventos y Visualización

## Resumen

Este plan aborda 5 mejoras relacionadas con el registro de eventos y la visualización de información:

1. **Descripción con saltos de línea** - Formatear la descripción del evento para respetar los saltos de línea
2. **Hora sin segundos** - Mostrar horarios de la agenda en formato `HH:mm` (sin segundos)
3. **Equipo desde base de datos** - Pre-rellenar automáticamente el nombre del equipo desde `team_members`
4. **DNI desde base de datos** - Corregir el pre-relleno del DNI (ya parcialmente implementado)
5. **Consentimiento de imágenes obligatorio** - Hacer obligatorio el checkbox de autorización de imágenes
6. **Crear tabla `event_ticket_consents`** - Resolver errores de compilación creando la tabla faltante

---

## Cambios Detallados

### 1. Crear tabla `event_ticket_consents` (CRÍTICO - Errores de build)

El código referencia la tabla `event_ticket_consents` que no existe en la base de datos. Esto causa errores de compilación.

**Acción**: Crear una migración SQL para la tabla con la siguiente estructura:

```text
┌─────────────────────────────┬──────────────┬─────────────┐
│ Columna                     │ Tipo         │ Notas       │
├─────────────────────────────┼──────────────┼─────────────┤
│ id                          │ uuid (PK)    │ gen_random  │
│ event_registration_id       │ uuid (FK)    │ UNIQUE      │
│ signer_full_name            │ text         │ NOT NULL    │
│ signer_dni                  │ text         │ NOT NULL    │
│ signer_relationship         │ text         │ NOT NULL    │
│ signature                   │ text         │ NOT NULL    │
│ minor_name                  │ text         │ nullable    │
│ minor_age                   │ integer      │ nullable    │
│ signed_at                   │ timestamptz  │ now()       │
│ ip_address                  │ text         │ nullable    │
│ created_at                  │ timestamptz  │ now()       │
└─────────────────────────────┴──────────────┴─────────────┘
```

**RLS Policies**:
- Usuarios pueden insertar consentimiento para sus propios registros
- Admins pueden ver todos los consentimientos
- Edge function usa service role key (bypasa RLS)

---

### 2. Descripción con saltos de línea

**Archivo**: `src/pages/events/EventDetailPage.tsx`

**Problema**: La descripción se muestra en un solo párrafo ignorando los `\n`

**Solución**: Usar `whitespace-pre-line` en el CSS del párrafo de descripción:

```tsx
// Línea ~91-93, cambiar:
<p className="text-lg text-muted-foreground">{event.description}</p>

// A:
<p className="text-lg text-muted-foreground whitespace-pre-line">{event.description}</p>
```

---

### 3. Hora sin segundos en la agenda

**Archivo**: `src/pages/events/EventDetailPage.tsx`

**Problema**: Los horarios se muestran como `09:30:00` en vez de `09:30`

**Solución**: Crear una función helper para formatear el tiempo y aplicarla:

```tsx
// Helper function
const formatTime = (time: string) => time?.slice(0, 5) || '';

// Aplicar en línea 159:
{formatTime(item.start_time)} - {formatTime(item.end_time)}

// También aplicar en líneas 111-112 para start_time/end_time del evento
```

---

### 4. Pre-rellenar equipo desde base de datos

**Archivo**: `src/pages/events/EventRegistrationPage.tsx`

**Problema**: El campo `team_name` no se pre-rellena para participantes que están en un equipo

**Solución**:

1. Añadir query para obtener el equipo del usuario actual:

```tsx
// Nuevo hook/query dentro del componente
const { data: userTeam } = useQuery({
  queryKey: ['user-team', profile?.id],
  queryFn: async () => {
    if (!profile?.id) return null;
    const { data } = await supabase
      .from('team_members')
      .select('team:teams(name, tg_team_id)')
      .eq('user_id', profile.id)
      .eq('member_type', 'participant')
      .maybeSingle();
    return data?.team;
  },
  enabled: !!profile?.id,
});
```

2. Pre-rellenar el campo `team_name` en el `useEffect`:

```tsx
useEffect(() => {
  if (profile) {
    // ... campos existentes ...
    
    // Pre-rellenar equipo si el usuario tiene uno asignado
    if (userTeam?.name) {
      form.setValue('team_name', userTeam.name);
    }
  }
}, [profile, userTeam, form]);
```

3. Hacer el campo de solo lectura si viene de la base de datos (opcional, mejora UX):

```tsx
<Input 
  placeholder="Nombre registrado en technovationchallenge.org" 
  {...field}
  disabled={!!userTeam?.name}
  className={userTeam?.name ? "bg-muted" : ""}
/>
```

---

### 5. DNI desde base de datos (ya implementado, verificar)

**Archivo**: `src/pages/events/EventRegistrationPage.tsx`

El código actual ya intenta pre-rellenar el DNI:
- Línea 142: `dni: (profile as any)?.dni || ''`
- Líneas 161-163: `if ((profile as any)?.dni) { form.setValue('dni', (profile as any).dni); }`

**Problema potencial**: El cast `(profile as any)` sugiere que el tipo `Profile` no incluye `dni`, pero revisando `src/types/database.ts` línea 24 veo que SÍ incluye `dni?: string | null`.

**Solución**: Eliminar el cast innecesario:

```tsx
// Cambiar de:
dni: (profile as any)?.dni || ''

// A:
dni: profile?.dni || ''
```

---

### 6. Consentimiento de imágenes OBLIGATORIO

**Archivo**: `src/pages/events/EventRegistrationPage.tsx`

**Problema**: El checkbox de `image_consent` es opcional pero debería ser obligatorio

**Solución**:

1. Actualizar el schema de validación (línea 79):

```tsx
// Cambiar de:
image_consent: z.boolean().default(false),

// A:
image_consent: z.boolean().refine(val => val === true, 'Debes autorizar la captación de imágenes'),
```

2. Mostrar el checkbox para TODOS los usuarios (no solo menores):
   - Eliminar la condición `{userIsMinor && (` de las líneas 775-795
   - Añadir mensaje de error debajo del checkbox

3. Actualizar el texto del checkbox para reflejar que es obligatorio:

```tsx
<FormLabel className="font-normal text-sm">
  Autorizo la captación de imágenes durante el evento {companions.length > 0 ? '(para mí y mis acompañantes)' : ''} *
</FormLabel>
```

4. Añadir `FormMessage` para mostrar errores de validación:

```tsx
<FormItem className="flex flex-row items-start space-x-3 space-y-0">
  <FormControl>
    <Checkbox ... />
  </FormControl>
  <div className="space-y-1 leading-none">
    <FormLabel>...</FormLabel>
    <FormMessage />
  </div>
</FormItem>
```

---

## Resumen de archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/migrations/*.sql` | Crear tabla `event_ticket_consents` |
| `src/pages/events/EventDetailPage.tsx` | Saltos de línea en descripción + formato hora |
| `src/pages/events/EventRegistrationPage.tsx` | Pre-rellenar equipo, DNI, imagen obligatoria |

---

## Consideraciones técnicas

- La tabla `event_ticket_consents` necesita RLS habilitado con políticas apropiadas
- El edge function `submit-event-consent` ya usa esta tabla con service role key
- Los tipos TypeScript en `src/integrations/supabase/types.ts` se regenerarán automáticamente tras crear la tabla
- El query para obtener el equipo del usuario requiere que el usuario esté logueado y tenga rol `participant`
