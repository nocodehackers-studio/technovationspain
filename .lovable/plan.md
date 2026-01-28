
# Plan: Portal de Voluntarios

## Resumen

Implementar un portal completo para voluntarios que incluye:
1. Pagina de registro especifica en `/voluntario` (sin verificacion Technovation)
2. Dashboard de voluntario con lista de eventos disponibles
3. Sistema de inscripcion a eventos como voluntario (sin generar entrada)
4. Vista en admin para ver y gestionar voluntarios asignados a eventos
5. Capacidad de asignar rol "Validador QR" a voluntarios

---

## Arquitectura del Sistema

### Flujo del Voluntario

```text
/voluntario (registro)
     |
     v
Onboarding (simplificado, sin TG email)
     |
     v
Auto-verificado como voluntario
     |
     v
/voluntario/dashboard
     |
     v
Ver eventos y apuntarse
```

### Modelo de Datos

Nueva tabla `event_volunteers` para inscripciones de voluntarios:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | UUID | Primary key |
| event_id | UUID | FK a events |
| user_id | UUID | FK a profiles |
| notes | TEXT | Notas opcionales |
| created_at | TIMESTAMP | Fecha inscripcion |

---

## Cambios en Base de Datos

### Nueva tabla event_volunteers

```sql
CREATE TABLE public.event_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- RLS
ALTER TABLE public.event_volunteers ENABLE ROW LEVEL SECURITY;

-- Voluntarios pueden ver sus inscripciones
CREATE POLICY "Volunteers can view own signups"
ON public.event_volunteers FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Voluntarios pueden inscribirse
CREATE POLICY "Volunteers can sign up"
ON public.event_volunteers FOR INSERT
WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'volunteer'));

-- Voluntarios pueden cancelar su inscripcion
CREATE POLICY "Volunteers can cancel own signup"
ON public.event_volunteers FOR DELETE
USING (user_id = auth.uid());

-- Admins pueden gestionar todo
CREATE POLICY "Admins manage all"
ON public.event_volunteers FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

### Modificar user_roles RLS

Permitir auto-asignacion del rol `volunteer` durante registro:

```sql
-- Actualizar politica existente para incluir 'volunteer'
DROP POLICY IF EXISTS "Users can insert own allowed role" ON public.user_roles;

CREATE POLICY "Users can insert own allowed role"
ON public.user_roles FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND role IN ('participant', 'mentor', 'judge', 'volunteer')
  AND (
    NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND verification_status = 'verified'
    )
  )
);
```

---

## Nuevos Archivos

| Archivo | Proposito |
|---------|-----------|
| `src/pages/register/RegisterVolunteer.tsx` | Pagina registro voluntarios |
| `src/pages/volunteer/VolunteerDashboard.tsx` | Dashboard del voluntario |
| `src/pages/volunteer/VolunteerEventSignup.tsx` | Detalle evento e inscripcion |
| `src/hooks/useVolunteerEvents.ts` | Hook para eventos de voluntarios |
| `src/components/admin/events/EventVolunteersView.tsx` | Vista admin de voluntarios por evento |

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Nuevas rutas `/voluntario/*` |
| `src/pages/Onboarding.tsx` | Flujo simplificado para voluntarios |
| `src/pages/admin/AdminEventEditor.tsx` | Nueva pestana "Voluntarios" |
| `src/types/database.ts` | Nuevo tipo EventVolunteer |
| `src/hooks/useAuth.tsx` | Redireccion post-login para voluntarios |

---

## Implementacion Detallada

### 1. Pagina de Registro (/voluntario)

Similar a RegisterMentor pero:
- Sin requisito de Technovation Global
- Rol asignado: `volunteer`
- Auto-verificacion inmediata (no requiere whitelist)
- Texto adaptado a voluntarios

```typescript
// RegisterVolunteer.tsx
// Usa signInWithOtp con emailRedirectTo: `/auth/callback?role=volunteer`
// El callback redirige a onboarding con ?role=volunteer
```

### 2. Onboarding Simplificado para Voluntarios

Modificar Onboarding.tsx:
- Detectar `role=volunteer` en URL
- Omitir paso de Technovation Global email
- Auto-verificar el perfil
- Redirigir a `/voluntario/dashboard`

```typescript
// En roleConfig, anadir:
volunteer: {
  label: 'Voluntario/a',
  icon: Heart, // o HandHeart
  ageMin: 18,
  ageMax: null,
  ageLabel: '18+ anos',
  color: 'text-accent',
}

// En handleSubmit, si role === 'volunteer':
// - verification_status = 'verified' (auto)
// - No buscar en whitelist
// - Navegar a /voluntario/dashboard
```

### 3. Dashboard de Voluntario

Nueva pagina con:
- Perfil basico del voluntario
- Lista de eventos disponibles (publicados)
- Eventos a los que ya esta inscrito
- Boton para apuntarse/desapuntarse

```typescript
// VolunteerDashboard.tsx
interface VolunteerDashboardProps {}

// Queries:
// 1. Eventos publicados: supabase.from('events').select('*').eq('status', 'published')
// 2. Mis inscripciones: supabase.from('event_volunteers').select('*, event:events(*)').eq('user_id', userId)

// UI:
// - Header con avatar y nombre
// - Seccion "Mis eventos" (donde estoy inscrito)
// - Seccion "Eventos disponibles" (donde puedo apuntarme)
// - Boton "Apuntarse" / "Cancelar inscripcion"
```

### 4. Hook useVolunteerEvents

```typescript
export function useVolunteerEvents(userId: string | undefined) {
  // Query: eventos con inscripcion del usuario
  const { data: mySignups } = useQuery({
    queryKey: ['volunteer-signups', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_volunteers')
        .select('*, event:events(*)')
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Mutation: inscribirse
  const signupMutation = useMutation({...});
  
  // Mutation: cancelar inscripcion
  const cancelMutation = useMutation({...});

  return { mySignups, signUp, cancelSignup };
}
```

### 5. Vista Admin de Voluntarios por Evento

Nueva pestana en AdminEventEditor:

```typescript
// EventVolunteersView.tsx
// Muestra tabla con:
// - Nombre del voluntario
// - Email
// - Fecha inscripcion
// - Acciones: Asignar como Validador QR, Eliminar inscripcion

// Query:
supabase
  .from('event_volunteers')
  .select('*, profile:profiles(*)')
  .eq('event_id', eventId)
```

### 6. Rutas en App.tsx

```typescript
// Registro voluntario (publico)
<Route path="/voluntario" element={<RegisterVolunteer />} />

// Dashboard voluntario (protegido)
<Route path="/voluntario/dashboard" element={
  <ProtectedRoute requiredRoles={["volunteer", "admin"]}>
    <VolunteerDashboard />
  </ProtectedRoute>
} />
```

---

## Flujo de Usuario Completo

### Registro como Voluntario

1. Usuario accede a `/voluntario`
2. Introduce email y acepta terminos
3. Recibe magic link / OTP
4. Verifica y llega a Onboarding
5. Completa datos basicos (nombre, fecha nacimiento)
6. Se crea perfil con `verification_status: 'verified'` y `role: 'volunteer'`
7. Redirige a `/voluntario/dashboard`

### Apuntarse a Evento

1. Voluntario ve lista de eventos en su dashboard
2. Hace clic en "Apuntarme" en un evento
3. Se crea registro en `event_volunteers`
4. El evento aparece en "Mis eventos"
5. Puede cancelar su inscripcion

### Admin Gestiona Voluntarios

1. Admin abre evento en editor
2. Va a pestana "Voluntarios"
3. Ve lista de voluntarios inscritos
4. Puede asignar rol "Validador QR" a cualquiera
5. Puede eliminar inscripciones

### Validador QR en Accion

1. Voluntario con rol adicional `volunteer` puede acceder a `/validate`
2. Escanea codigos QR de entradas
3. El sistema ya permite acceso a usuarios con rol `volunteer`

---

## UI/UX del Dashboard Voluntario

```text
+--------------------------------------------------+
|  [Avatar]  Hola, Juan!                    [Salir]|
|  Voluntario/a de Technovation Espana             |
+--------------------------------------------------+

+--------------------------------------------------+
|  MIS EVENTOS                                     |
|  +--------------------------------------------+  |
|  | Evento Intermedio Madrid                   |  |
|  | 7 Mar 2025 | IFEMA                         |  |
|  | [Cancelar inscripcion]                     |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+

+--------------------------------------------------+
|  EVENTOS DISPONIBLES                             |
|  +--------------------------------------------+  |
|  | Final Regional Norte                       |  |
|  | 15 May 2025 | Bilbao                       |  |
|  | [Apuntarme como voluntario]                |  |
|  +--------------------------------------------+  |
|  +--------------------------------------------+  |
|  | Workshop IA Barcelona                      |  |
|  | 20 Abr 2025 | Barcelona                    |  |
|  | [Apuntarme como voluntario]                |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+

|  Tienes rol de Validador QR?                     |
|  [Ir al escaner de entradas]                     |
+--------------------------------------------------+
```

---

## Consideraciones de Seguridad

1. **RLS estricto**: Voluntarios solo ven/modifican sus propias inscripciones
2. **Auto-verificacion controlada**: Solo usuarios que vienen de `/voluntario` pueden auto-verificarse como voluntarios
3. **Rol separado**: El rol `volunteer` es distinto de `participant`, no da acceso a funcionalidades de participante
4. **Validador QR adicional**: El rol de validador se asigna explicitamente, no viene por defecto

---

## Orden de Implementacion

1. Migracion DB: crear tabla `event_volunteers` y actualizar RLS
2. `RegisterVolunteer.tsx`: pagina de registro
3. Modificar `Onboarding.tsx`: soporte para rol voluntario
4. Modificar `useAuth.tsx`: redireccion post-login
5. `useVolunteerEvents.ts`: hook de datos
6. `VolunteerDashboard.tsx`: dashboard principal
7. Rutas en `App.tsx`
8. `EventVolunteersView.tsx`: vista admin
9. Modificar `AdminEventEditor.tsx`: nueva pestana

---

## Diferencias Clave vs Otros Roles

| Aspecto | Participante/Mentor/Juez | Voluntario |
|---------|--------------------------|------------|
| Verificacion | Contra Technovation Global | Automatica |
| Dashboard | `/dashboard` | `/voluntario/dashboard` |
| Eventos | Sacar entrada con QR | Solo apuntarse (sin entrada) |
| Registro a eventos | `event_registrations` | `event_volunteers` |
| Acceso a validacion | Solo admin | Con rol adicional |
