

## Plan: Email de invitacion para usuarios sin registrar

### Que se va a hacer

Crear una nueva Edge Function `send-invite-reminder` que envie un email personalizado a usuarios del whitelist que aun no se han registrado. El email tendra un tono de "te animamos a registrarte" con un enlace directo al registro, diferente del magic link actual que dice "Hola de nuevo".

### Cambios

#### 1. Nueva Edge Function: `send-invite-reminder`

Funcion que recibe el email y nombre del usuario, y envia un correo via Brevo con:
- Asunto: "Te esperamos en Technovation Girls Madrid"
- Mensaje personalizado: "Hola [nombre], aun no te has registrado en nuestra plataforma..."
- Boton con enlace directo a la pagina de registro de la plataforma
- Misma plantilla visual (logos, colores) que los emails actuales
- No requiere webhook signature (se valida que el llamante sea admin via JWT)

#### 2. Boton "Enviar recordatorio" en la tabla de usuarios sin registrar

En `UnregisteredUsersTable.tsx`:
- Anadir una columna de acciones con un boton/icono de "Enviar recordatorio" (icono de email) en cada fila
- Al hacer clic, invoca la edge function con el email y nombre del usuario
- Muestra toast de confirmacion

#### 3. Accion desde el dialogo de "Invitar Usuario" existente

En `AdminUsers.tsx`:
- El dialogo actual de "Invitar Usuario" seguira funcionando para invitar emails nuevos (magic link)
- No se modifica el flujo existente, ya que el nuevo flujo es especifico para usuarios del whitelist

### Detalles tecnicos

**Nueva Edge Function `supabase/functions/send-invite-reminder/index.ts`:**
- Recibe: `{ email, firstName, lastName }` en el body
- Valida JWT del admin (verify_jwt = true en config.toml)
- Genera HTML con plantilla branded igual que send-auth-email
- Contenido diferenciado:
  - Heading: "Te esperamos en Technovation Girls Madrid"
  - Intro: "Hola {nombre}, vemos que aun no te has registrado en nuestra plataforma de gestion de Technovation Girls Madrid. Registrate para poder acceder a los eventos, talleres y toda la informacion de la temporada."
  - Boton: "Registrarme ahora" -> enlace a la pagina de inicio de la plataforma
- Envia via Brevo API (misma config que send-auth-email)

**`supabase/config.toml`:**
- Anadir entrada para `send-invite-reminder` con `verify_jwt = true`

**`src/components/admin/users/UnregisteredUsersTable.tsx`:**
- Anadir columna de acciones con boton de email
- Estado de loading individual por fila
- Toast de exito/error
- Opcionalmente: boton de "Enviar a todos" en la cabecera para envio masivo

**Archivos afectados:**
- `supabase/functions/send-invite-reminder/index.ts` (nuevo)
- `supabase/config.toml` (nueva entrada)
- `src/components/admin/users/UnregisteredUsersTable.tsx` (columna de acciones)
