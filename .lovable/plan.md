

# Plan: Corregir Configuración JWT para Envío de Emails

## Problema

La función `send-registration-confirmation` devuelve 401 porque `verify_jwt = true` en config.toml conflictúa con el sistema de signing-keys de Supabase, bloqueando las peticiones antes de llegar al código.

## Solución

Cambiar a `verify_jwt = false` manteniendo la seguridad con la validación manual existente.

## Cambio Único

### supabase/config.toml

```toml
project_id = "orvkqnbshkxzyhqpjsdw"

[functions.send-registration-confirmation]
verify_jwt = false

[functions.send-auth-email]
verify_jwt = false

[functions.send-event-email]
verify_jwt = true
```

Solo se cambia la línea 4 de `true` a `false`.

## Seguridad Mantenida

La función ya implementa validación completa:
- Verifica presencia de header Authorization
- Valida JWT con `supabase.auth.getUser(token)`
- Comprueba ownership del registro
- Permite acceso a admins verificando tabla `user_roles`

## Verificación

Después del despliegue:
1. Registrarse a un evento
2. Los logs mostrarán el flujo completo hasta "Email sent successfully"
3. El email aparecerá en el dashboard de Resend

