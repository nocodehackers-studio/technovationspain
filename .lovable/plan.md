
# Plan: Actualizar Template de Email de Autenticación

## Resumen

Modificar el edge function `send-auth-email` para:
1. Añadir los logos de Technovation Girls y Power To Code
2. Diferenciar entre login auto-iniciado vs invitación del admin
3. Actualizar el pie de página con el texto correcto
4. Cambiar los textos de "Technovation Spain" a "Technovation Girls Madrid" / "Power To Code"

---

## Cambios en `supabase/functions/send-auth-email/index.ts`

### 1. Añadir constantes para los logos

```typescript
const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";
```

### 2. Actualizar los textos según el tipo de email

| Tipo | Asunto | Encabezado | Texto Intro |
|------|--------|------------|-------------|
| `signup` | Verifica tu cuenta - Technovation Girls Madrid | ¡Bienvenido/a a Technovation Girls Madrid! | Estás a un paso de unirte a nuestra comunidad. |
| `invite` | Te han invitado - Plataforma Power To Code | ¡Has recibido una invitación! | Un administrador te ha invitado a unirte a la plataforma de Technovation Girls Madrid. |
| `magiclink` | Inicia sesión - Plataforma Power To Code | ¡Hola de nuevo! | Haz clic en el botón para acceder a tu cuenta. |
| `recovery` | Recupera tu cuenta - Technovation Girls Madrid | Recuperación de cuenta | Has solicitado restablecer tu acceso a la plataforma. |

### 3. Actualizar el HTML del email

**Header con logos:**
```html
<td style="background: linear-gradient(135deg, #00A5CF 0%, #25A18E 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
  <table style="width: 100%;">
    <tr>
      <td align="center">
        <img src="[LOGO_TECHNOVATION]" alt="Technovation Girls" style="height: 50px; margin-right: 20px;">
        <img src="[LOGO_POWER_TO_CODE]" alt="Power To Code" style="height: 45px;">
      </td>
    </tr>
  </table>
</td>
```

**Footer actualizado:**
```html
<tr>
  <td style="padding: 32px 20px; text-align: center;">
    <p style="margin: 0 0 8px; color: #71717a; font-size: 14px;">
      Technovation Girls Madrid. Girls for a change.
    </p>
    <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
      © 2026 Power To Code. Todos los derechos reservados.
    </p>
  </td>
</tr>
```

---

## Resumen de cambios de texto

| Elemento | Antes | Después |
|----------|-------|---------|
| Sender Name | Technovation Spain | Technovation Girls Madrid |
| Subject (invite) | *no existía* | Te han invitado - Plataforma Power To Code |
| Heading (invite) | *no existía* | ¡Has recibido una invitación! |
| Intro (invite) | *no existía* | Un administrador te ha invitado... |
| Subject (magiclink) | Inicia sesión - Technovation Spain | Inicia sesión - Plataforma Power To Code |
| Intro (magiclink) | Has solicitado iniciar sesión | Haz clic en el botón para acceder |
| Footer línea 1 | Technovation Spain - Inspiring Girls to Change the World | Technovation Girls Madrid. Girls for a change. |
| Footer línea 2 | © 2026 Technovation Spain. Todos los derechos reservados. | © 2026 Power To Code. Todos los derechos reservados. |
| Header | Solo texto "🚀 Technovation Spain" | Dos logos (Technovation Girls + Power To Code) |

---

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/send-auth-email/index.ts` | Actualizar template HTML con logos, textos corregidos y caso `invite` |
