# Technovation España - Plataforma de Gestión

Plataforma de gestión integral para Technovation España que permite administrar participantes, mentores, jueces, voluntarios y eventos del programa.

## 🏗️ Arquitectura del Proyecto

### Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Estilos** | Tailwind CSS + shadcn/ui |
| **Estado** | TanStack Query (React Query) + Zustand |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| **Formularios** | React Hook Form + Zod |

### Estructura de Carpetas

```
src/
├── components/
│   ├── admin/           # Componentes del panel de administración
│   │   ├── events/      # Gestión de eventos (agenda, emails, tickets)
│   │   ├── import/      # Importación CSV y resolución de conflictos
│   │   └── users/       # Gestión de usuarios
│   ├── auth/            # Autenticación y protección de rutas
│   ├── events/          # Componentes públicos de eventos
│   └── ui/              # Componentes base (shadcn/ui)
├── hooks/               # Custom hooks (useAuth, useEventRegistration, etc.)
├── integrations/
│   └── supabase/        # Cliente y tipos auto-generados
├── lib/                 # Utilidades (validaciones, QR, etc.)
├── pages/
│   ├── admin/           # Páginas del panel de administración
│   ├── events/          # Páginas públicas de eventos
│   ├── mentor/          # Dashboard de mentores
│   ├── register/        # Flujos de registro por rol
│   ├── validate/        # Validación de entradas (QR)
│   └── volunteer/       # Dashboard de voluntarios
├── types/               # Tipos TypeScript personalizados
└── App.tsx              # Enrutamiento principal

supabase/
└── functions/           # Edge Functions (emails, validación tickets)
```

### Modelo de Datos

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USUARIOS                                   │
├─────────────────────────────────────────────────────────────────────┤
│  profiles ←──┬── user_roles (participant, mentor, judge, volunteer, │
│              │                admin, chapter_ambassador)             │
│              │                                                       │
│              ├── team_members ──→ teams ──→ hubs                    │
│              │                                                       │
│              └── event_ticket_consents (consentimiento por entrada)  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           EVENTOS                                    │
├─────────────────────────────────────────────────────────────────────┤
│  events ←──┬── event_ticket_types (tipos de entrada configurables)  │
│            │                                                         │
│            ├── event_registrations ←── companions (acompañantes)    │
│            │                                                         │
│            ├── event_agenda (programa del evento)                   │
│            │                                                         │
│            ├── event_volunteers (asignación de voluntarios)         │
│            │                                                         │
│            ├── workshops ←── workshop_registrations                 │
│            │                                                         │
│            └── event_email_templates / event_email_sends            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        WHITELIST / IMPORT                            │
├─────────────────────────────────────────────────────────────────────┤
│  authorized_users ──→ matched_profile_id (auto-verificación)        │
│  csv_imports (historial de importaciones)                           │
│  audit_logs (registro de acciones)                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Sistema de Roles y Permisos

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| `participant` | Estudiantes del programa | Dashboard, eventos |
| `mentor` | Mentores de equipos | Dashboard mentor, equipos asignados |
| `judge` | Jueces de competición | Eventos de evaluación |
| `volunteer` | Voluntarios de eventos | Dashboard voluntario, check-in |
| `chapter_ambassador` | Líderes de capítulo | Gestión de hub |
| `admin` | Administradores | Panel completo |

**Seguridad**: Los roles se almacenan en tabla separada (`user_roles`) con RLS. La función `has_role()` previene recursión en políticas.

### Flujo de Verificación de Usuarios

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Registro   │────▶│  ¿En whitelist? │────▶│  Verificado  │
│   (email)    │     │ authorized_users│ SÍ  │   + Rol      │
└──────────────┘     └─────────────────┘     └──────────────┘
                              │ NO
                              ▼
                     ┌─────────────────┐
                     │    Pendiente    │
                     │ (manual_review) │
                     └─────────────────┘
```

### Sistema de Eventos

#### Tipos de Entrada Configurables

Cada evento puede tener múltiples tipos de entrada con:
- **Roles permitidos**: Qué roles pueden adquirir este tipo
- **Campos obligatorios**: DNI, teléfono, email TG, nombre de equipo
- **Acompañantes**: Número máximo y campos requeridos para cada uno
- **Capacidad**: Límite por tipo de entrada

#### Gestión de Capacidad

```typescript
// Funciones SQL para control atómico de capacidad
increment_registration_count(event_id, ticket_type_id, companions_count)
decrement_registration_count(event_id, ticket_type_id, companions_count)
```

### Edge Functions

| Función | Propósito |
|---------|-----------|
| `send-auth-email` | Emails de autenticación personalizados |
| `send-event-email` | Comunicaciones masivas a registrados |
| `send-registration-confirmation` | Confirmación con QR de entrada |
| `send-event-consent` | Envío de enlace de consentimiento a padres (menores) |
| `submit-event-consent` | Recepción pública de consentimiento firmado |
| `validate-ticket` | Validación de QR en check-in (incluye check de consentimiento) |

### Patrones de Código

#### Protección de Rutas

```tsx
<ProtectedRoute requiredRoles={["admin"]}>
  <AdminDashboard />
</ProtectedRoute>
```

#### Queries con TanStack Query

```tsx
const { data, isLoading } = useQuery({
  queryKey: ['events', eventId],
  queryFn: () => supabase.from('events').select('*').eq('id', eventId)
});
```

#### Validación con Zod

```tsx
const schema = z.object({
  dni: z.string().regex(/^[0-9]{8}[A-Z]$|^[XYZ][0-9]{7}[A-Z]$/)
});
```

## 🚀 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Ejecutar tests
npm test
```

## 📦 Variables de Entorno

Las claves de Supabase se gestionan automáticamente. Para Edge Functions, los secrets se configuran en el panel de Supabase:

- `BREVO_API_KEY` - API de envío de emails
- `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME`
- `BREVO_REPLY_TO_EMAIL`
- `PUBLIC_SITE_URL` - URL pública del sitio para enlaces de consentimiento

## 🔐 Seguridad

- **RLS habilitado** en todas las tablas
- **Roles en tabla separada** para prevenir escalación de privilegios
- **Funciones SECURITY DEFINER** para operaciones privilegiadas
- **Validación de DNI/NIE** con formato español
- **Tokens únicos** para consentimientos parentales

## 📊 Panel de Administración

- **Dashboard**: Métricas de registro (whitelist vs perfiles)
- **Usuarios**: CRUD completo con roles múltiples
- **Equipos**: Gestión y asignación de miembros
- **Hubs**: Organización geográfica
- **Eventos**: Creación, tipos de entrada, agenda, emails
- **Importación**: CSV con resolución de conflictos
- **Reportes**: Exportación de datos

---

Desarrollado con [Lovable](https://lovable.dev)

