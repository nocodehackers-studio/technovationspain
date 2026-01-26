

# Plan: Sistema de Emails Personalizables para Eventos

## Resumen

Implementar un sistema de gestión de emails para eventos con 2 tipos de plantillas personalizables:
1. **Email de Confirmación + Entrada QR** - Enviado automáticamente al registrarse
2. **Email Recordatorio** - Programable o envío manual antes del evento

---

## Arquitectura del Sistema

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Editor de Evento - Pestaña "Emails"                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 📧 Email de Confirmación + Entrada                                      ││
│  │ Se envía automáticamente al registrarse. Incluye QR.                   ││
│  │ Asunto: ¡Tu inscripción está confirmada! - {evento}                    ││
│  │                                                         [Editar] [👁️]   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ⏰ Email Recordatorio                                                   ││
│  │ Para recordar a los asistentes antes del evento                        ││
│  │ Asunto: ¡Te esperamos mañana en {evento}!                              ││
│  │                                              [Editar] [Programar envío] ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 📊 Historial de Envíos                                                  ││
│  │ ┌──────────────────────┬──────────┬─────────────┬───────────┐          ││
│  │ │ Asunto               │ Destino. │ Fecha       │ Estado    │          ││
│  │ ├──────────────────────┼──────────┼─────────────┼───────────┤          ││
│  │ │ Recordatorio evento  │ 620      │ 7 Mar 2025  │ ✅ Enviado │          ││
│  │ └──────────────────────┴──────────┴─────────────┴───────────┘          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Cambios en Base de Datos

### Tabla: `event_email_templates`

Almacena las plantillas personalizables por evento.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| event_id | uuid | FK a events |
| template_type | text | 'confirmation' o 'reminder' |
| subject | text | Asunto del email |
| body_content | text | Contenido personalizado (HTML/texto) |
| reply_to_email | text | Email de respuesta opcional |
| is_active | boolean | Si está activo |
| created_at | timestamp | Fecha creación |
| updated_at | timestamp | Última actualización |

### Tabla: `event_email_sends`

Historial y programación de envíos de recordatorios.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| event_id | uuid | FK a events |
| template_type | text | Tipo de plantilla usada |
| subject | text | Asunto enviado |
| body_content | text | Contenido enviado |
| recipients_count | integer | Número de destinatarios |
| target_audience | text | 'all_confirmed', 'ticket_type', 'custom' |
| target_ticket_type_id | uuid | Si filtrado por tipo entrada |
| status | text | 'scheduled', 'processing', 'sent', 'failed', 'cancelled' |
| scheduled_for | timestamp | Cuándo enviar (null = inmediato) |
| sent_at | timestamp | Cuándo se envió |
| sent_by | uuid | Usuario que lo programó |
| error_message | text | Mensaje de error si falló |
| created_at | timestamp | Fecha creación |

### Políticas RLS

Solo administradores pueden gestionar plantillas y envíos.

---

## 2. Componentes Frontend

### 2.1 EventEmailManager.tsx

Componente principal para la pestaña "Emails" que muestra:
- Cards de las 2 plantillas con botones de editar y preview
- Botón "Programar envío" para recordatorios
- Tabla de historial de envíos

### 2.2 EmailTemplateEditor.tsx

Sheet/Dialog para editar cada plantilla:
- Campo de asunto
- Editor de contenido (textarea con soporte HTML básico)
- Campo reply-to email
- Preview del email con variables reemplazadas
- Lista de variables disponibles

### 2.3 EmailSendDialog.tsx

Dialog para enviar recordatorios:
- Selector de audiencia:
  - Todos los confirmados
  - Por tipo de entrada
  - Selección manual (futuro)
- Selector de fecha/hora si es programado
- Toggle: Enviar ahora vs Programar
- Contador de destinatarios estimados
- Botón de confirmación

### 2.4 EmailHistoryTable.tsx

Tabla de envíos realizados/programados:
- Asunto
- Número de destinatarios
- Fecha/hora de envío
- Estado (con badge de color)
- Acciones (cancelar si programado)

---

## 3. Modificaciones a Archivos Existentes

### AdminEventEditor.tsx

Añadir nueva pestaña "Emails" con icono Mail entre "Agenda" y "Publicar".

### send-registration-confirmation/index.ts

Modificar para:
1. Buscar plantilla personalizada en `event_email_templates`
2. Si no existe, usar contenido por defecto
3. Generar QR como imagen y subirla a Storage
4. Incluir URL pública del QR en el email
5. Reemplazar variables del template

---

## 4. Nueva Edge Function: send-event-email

Para envíos masivos de recordatorios:

```typescript
// POST /functions/v1/send-event-email
interface Request {
  eventId: string;
  templateType: 'reminder';
  targetAudience: 'all_confirmed' | 'ticket_type';
  ticketTypeId?: string;
  scheduleFor?: string; // ISO datetime, null = ahora
}
```

Flujo:
1. Verificar que usuario es admin
2. Obtener plantilla del evento
3. Si `scheduleFor`:
   - Crear registro en `event_email_sends` con status='scheduled'
   - Retornar confirmación de programación
4. Si envío inmediato:
   - Obtener registrations según audiencia
   - Enviar emails con rate limiting (100ms entre cada uno)
   - Crear registro en `event_email_sends` con resultados

---

## 5. Generación de QR para Emails

Para máxima compatibilidad con clientes de email:

1. Generar QR como PNG usando librería `qrcode`
2. Subir a Supabase Storage bucket "Assets" en carpeta `qr-codes/`
3. Usar URL pública en el email: `<img src="https://...storage.../qr-codes/{code}.png" />`

Esto evita problemas de:
- Data URLs bloqueadas por Gmail/Outlook
- Attachments que no se muestran inline

---

## 6. Variables de Plantilla

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{nombre}` | Nombre del asistente | María |
| `{apellido}` | Apellido del asistente | García |
| `{nombre_completo}` | Nombre + Apellido | María García |
| `{evento}` | Nombre del evento | Final Regional Madrid |
| `{fecha}` | Fecha formateada | Sábado, 8 de marzo de 2025 |
| `{hora}` | Horario | 09:00 - 18:00 |
| `{ubicacion}` | Nombre del lugar | Campus Google Madrid |
| `{direccion}` | Dirección completa | Paseo de la Castellana 123 |
| `{ciudad}` | Ciudad | Madrid |
| `{numero_registro}` | Número de registro | TGM-2025-ABC123 |
| `{tipo_entrada}` | Tipo de entrada | Participante |
| `{enlace_entrada}` | Link a ver entrada online | https://... |

---

## 7. Plantillas por Defecto

### Email de Confirmación + Entrada

**Asunto**: ¡Tu inscripción a {evento} está confirmada!

**Contenido**:
```
Hola {nombre},

¡Tu inscripción al evento "{evento}" ha sido confirmada!

📅 Fecha: {fecha}
🕐 Horario: {hora}
📍 Lugar: {ubicacion}
   {direccion}, {ciudad}

Tu número de registro es: {numero_registro}

A continuación encontrarás tu entrada con el código QR que deberás presentar en la entrada del evento:

[IMAGEN QR]

También puedes acceder a tu entrada en cualquier momento desde: {enlace_entrada}

¡Te esperamos!

Equipo de Technovation Girls España
```

### Email Recordatorio

**Asunto**: ¡Te esperamos mañana en {evento}!

**Contenido**:
```
Hola {nombre},

Te recordamos que mañana es el evento "{evento}".

📅 Fecha: {fecha}
🕐 Horario: {hora}
📍 Lugar: {ubicacion}
   {direccion}, {ciudad}

No olvides llevar:
- Tu entrada (la encontrarás adjunta o en {enlace_entrada})
- Documento de identidad
- Muchas ganas de aprender

¡Nos vemos pronto!

Equipo de Technovation Girls España
```

---

## 8. Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `src/components/admin/events/EventEmailManager.tsx` | Componente principal |
| `src/components/admin/events/EmailTemplateEditor.tsx` | Editor de plantillas |
| `src/components/admin/events/EmailSendDialog.tsx` | Dialog envío recordatorios |
| `src/components/admin/events/EmailHistoryTable.tsx` | Tabla historial |
| `src/hooks/useEventEmails.ts` | Hook para queries/mutations |
| `supabase/functions/send-event-email/index.ts` | Edge function envíos |

---

## 9. Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminEventEditor.tsx` | Añadir pestaña "Emails" |
| `supabase/functions/send-registration-confirmation/index.ts` | Usar plantillas + QR imagen |
| `supabase/config.toml` | Añadir nueva función |

---

## 10. Orden de Implementación

1. **Migración BD** - Crear tablas `event_email_templates` y `event_email_sends`
2. **Hook useEventEmails** - Queries para templates y envíos
3. **EventEmailManager** - Componente contenedor
4. **EmailTemplateEditor** - Editor con variables
5. **Integrar en AdminEventEditor** - Nueva pestaña
6. **Modificar send-registration-confirmation** - Plantillas + QR storage
7. **EmailSendDialog** - Para recordatorios
8. **send-event-email** - Edge function
9. **EmailHistoryTable** - Historial

---

## Consideraciones Técnicas

### Resend
- API Key ya configurada
- Sender: `hola@pruebas.nocodehackers.es` (dominio verificado)
- Rate limit: Añadir delay de 100ms entre emails para evitar throttling

### Storage para QR
- Bucket: "Assets" (ya existe, público)
- Carpeta: `qr-codes/`
- Formato: PNG, 300x300px
- Política: Ya permite lectura pública, añadir insert para service role

### Emails masivos
- Límite Resend free: 100/día
- Para producción considerar batch processing
- Guardar logs de cada envío en tabla

