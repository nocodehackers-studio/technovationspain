
# Plan: Proteger Datos Sensibles en Validación de QR

## Resumen del Problema

Actualmente, los voluntarios con acceso a `/validate` pueden ver datos personales sensibles de TODOS los asistentes registrados:

| Tabla | Datos Expuestos | Riesgo |
|-------|-----------------|--------|
| event_registrations | DNI, email, teléfono, tg_email | CRÍTICO |
| companions | DNI | CRÍTICO |
| team_members | user_id de todos los miembros | MEDIO |
| teams | Todos los equipos | BAJO |

## Solución Propuesta

Migrar la validación de tickets a una **Edge Function** que:
1. Recibe el código QR
2. Valida internamente (con acceso admin via service_role)
3. Devuelve SOLO los datos necesarios para mostrar en pantalla

---

## Arquitectura Actual vs Propuesta

### Actual (INSEGURO)

```text
Voluntario
    |
    v
Supabase Client (con RLS de voluntario)
    |
    v
SELECT * FROM event_registrations  <-- Accede a DNI, email, etc.
    |
    v
Frontend muestra nombre + tipo entrada
```

### Propuesto (SEGURO)

```text
Voluntario
    |
    v
Edge Function: validate-ticket
    |
    v
Supabase Admin (service_role) - sin RLS
    |
    v
Devuelve SOLO: { valid, name, ticketType, eventName, error }
```

---

## Cambios en Base de Datos

### 1. Restringir políticas RLS para voluntarios

Eliminar acceso directo de voluntarios a tablas sensibles:

```sql
-- Eliminar acceso de voluntarios a event_registrations (SELECT general)
DROP POLICY IF EXISTS "Users can view own registrations" ON public.event_registrations;

-- Nueva política: solo propietarios o admins
CREATE POLICY "Users can view own registrations"
ON public.event_registrations FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Eliminar acceso de voluntarios a companions
DROP POLICY IF EXISTS "Users can view companions of own registrations" ON public.companions;

-- Nueva política: solo propietarios de la inscripción o admins
CREATE POLICY "Users can view companions of own registrations"
ON public.companions FOR SELECT
USING (
  event_registration_id IN (
    SELECT id FROM event_registrations WHERE user_id = auth.uid()
  ) 
  OR has_role(auth.uid(), 'admin')
);

-- Eliminar acceso de voluntarios a team_members
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;

CREATE POLICY "Users can view team members of their teams"
ON public.team_members FOR SELECT
USING (
  team_id IN (SELECT get_user_team_ids(auth.uid()))
  OR has_role(auth.uid(), 'admin')
);

-- Eliminar acceso de voluntarios a teams
DROP POLICY IF EXISTS "Team members can view their teams" ON public.teams;

CREATE POLICY "Team members can view their teams"
ON public.teams FOR SELECT
USING (
  id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
);
```

### 2. Mantener política UPDATE para check-in de voluntarios

Los voluntarios sí necesitan poder hacer UPDATE para registrar el check-in, pero esto NO expone datos porque es solo escritura:

```sql
-- Esta política YA EXISTE y es correcta
-- "Volunteers can update registrations for check-in"
-- Solo permite UPDATE, no SELECT
```

---

## Nueva Edge Function: validate-ticket

### Archivo: supabase/functions/validate-ticket/index.ts

```typescript
// Recibe: { qr_code: string }
// Devuelve: {
//   valid: boolean,
//   error?: 'not_found' | 'already_checked_in' | 'wrong_date' | 'cancelled',
//   registration?: {
//     id: string,
//     display_name: string,      // Solo nombre, sin apellidos completos
//     ticket_type: string,
//     event_name: string,
//     team_name?: string
//   }
// }
```

### Flujo de la Edge Function

1. Verificar JWT del usuario llamante
2. Verificar que tiene rol `volunteer` o `admin`
3. Buscar registro por qr_code (usando service_role - sin RLS)
4. Validar: fecha, estado, check-in previo
5. Si válido, hacer check-in automático
6. Devolver respuesta mínima

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/validate-ticket/index.ts` | NUEVO - Edge Function |
| `src/hooks/useTicketValidation.ts` | Llamar a Edge Function en vez de query directo |
| `src/pages/validate/ValidatePage.tsx` | Adaptar a nueva respuesta |

---

## Implementación de la Edge Function

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationResponse {
  valid: boolean;
  error?: 'not_found' | 'already_checked_in' | 'wrong_date' | 'cancelled';
  registration?: {
    id: string;
    display_name: string;
    ticket_type: string;
    event_name: string;
    team_name?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verificar autenticación
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Cliente con token del usuario para verificar identidad
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Verificar rol (volunteer o admin)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    if (!userRoles.includes("volunteer") && !userRoles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Unauthorized role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Obtener código QR del body
    const { qr_code } = await req.json();
    if (!qr_code) {
      return new Response(JSON.stringify({ valid: false, error: "not_found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Buscar registro (con admin client - sin RLS)
    const { data: registration } = await supabaseAdmin
      .from("event_registrations")
      .select(`
        id, qr_code, first_name, last_name, team_name,
        checked_in_at, registration_status,
        event:events(id, name, date),
        ticket_type:event_ticket_types(name)
      `)
      .eq("qr_code", qr_code)
      .maybeSingle();

    // 5. Validar
    if (!registration) {
      return new Response(JSON.stringify({ valid: false, error: "not_found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (registration.registration_status === "cancelled") {
      return new Response(JSON.stringify({ valid: false, error: "cancelled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (registration.checked_in_at || registration.registration_status === "checked_in") {
      return new Response(JSON.stringify({ valid: false, error: "already_checked_in" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verificar fecha del evento (Madrid timezone)
    const eventDate = registration.event?.date;
    if (eventDate) {
      const today = new Date().toISOString().split('T')[0];
      if (eventDate !== today) {
        return new Response(JSON.stringify({ valid: false, error: "wrong_date" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 6. Realizar check-in
    await supabaseAdmin
      .from("event_registrations")
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.id,
        registration_status: "checked_in"
      })
      .eq("id", registration.id);

    // 7. Devolver respuesta mínima (SIN DNI, email, teléfono)
    const response: ValidationResponse = {
      valid: true,
      registration: {
        id: registration.id,
        display_name: [registration.first_name, registration.last_name]
          .filter(Boolean).join(" ") || "Asistente",
        ticket_type: registration.ticket_type?.name || "General",
        event_name: registration.event?.name || "Evento",
        team_name: registration.team_name || undefined
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Validation error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

---

## Actualización del Hook useTicketValidation

```typescript
// Nuevo hook que llama a la Edge Function
export function useTicketValidation(code: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ticket-validation', code],
    queryFn: async () => {
      if (!code) return { valid: false, error: 'not_found' as const };

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-ticket`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ qr_code: code })
        }
      );

      return response.json();
    },
    enabled: !!code && !!user
  });
}
```

---

## Actualización de ValidatePage

El componente se simplifica porque ya no necesita:
- Hacer check-in manualmente (la Edge Function lo hace)
- Validar fecha localmente (la Edge Function lo valida)

Solo muestra el resultado devuelto por la función.

---

## Resumen de Seguridad

| Aspecto | Antes | Después |
|---------|-------|---------|
| Voluntarios ven DNI | Sí | No |
| Voluntarios ven email | Sí | No |
| Voluntarios ven teléfono | Sí | No |
| Voluntarios ven equipos | Todos | Solo el suyo |
| Acceso a tablas | Directo | Via Edge Function |
| Validación | Cliente | Servidor |

---

## Orden de Implementación

1. Crear Edge Function `validate-ticket`
2. Desplegar y probar la función
3. Actualizar `useTicketValidation.ts` para usar Edge Function
4. Actualizar `ValidatePage.tsx` para nueva respuesta
5. Aplicar migración SQL para restringir RLS
6. Probar flujo completo con usuario voluntario

---

## Consideraciones Adicionales

### Companions (Acompañantes)

Los acompañantes también tienen códigos QR. La Edge Function debe buscar también en la tabla `companions` si no encuentra el código en `event_registrations`:

```typescript
// Si no se encuentra en event_registrations, buscar en companions
const { data: companion } = await supabaseAdmin
  .from("companions")
  .select(`
    id, qr_code, first_name, last_name, relationship,
    checked_in_at,
    event_registration:event_registrations(
      event:events(id, name, date)
    )
  `)
  .eq("qr_code", qr_code)
  .maybeSingle();
```

### Audit Log

La Edge Function puede registrar cada validación en `audit_logs` para trazabilidad:

```typescript
await supabaseAdmin.from("audit_logs").insert({
  user_id: user.id,
  action: "check_in",
  entity_type: "event_registration",
  entity_id: registration.id,
  changes: { checked_in_at: new Date().toISOString() }
});
```
