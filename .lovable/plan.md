
# Plan: Dashboard para Mentores

## Resumen

Crear un dashboard específico para mentores que muestre todos sus equipos (pueden tener varios), las participantes de cada equipo, y acceso a eventos disponibles. La experiencia será diferente a la del participante porque:

1. Un mentor puede tener **múltiples equipos**
2. Necesita ver las **participantes de cada equipo**
3. Tiene que poder **inscribirse a eventos** como mentor

---

## Arquitectura de Redirección

### Actual

```text
Usuario login
    |
    v
¿Es admin? --> Sí --> /admin
    |
    No
    v
¿Necesita onboarding? --> Sí --> /onboarding
    |
    No
    v
¿Está verificado? --> No --> /pending-verification
    |
    Sí
    v
/dashboard (todos los roles no-admin)
```

### Propuesta

```text
Usuario login
    |
    v
¿Es admin? --> Sí --> /admin
    |
    No
    v
¿Necesita onboarding? --> Sí --> /onboarding
    |
    No
    v
¿Está verificado? --> No --> /pending-verification
    |
    Sí
    v
¿Es voluntario? --> Sí --> /voluntario/dashboard
    |
    No
    v
¿Es mentor? --> Sí --> /mentor/dashboard (NUEVO)
    |
    No
    v
¿Es juez? --> Sí --> /judge/dashboard (futuro)
    |
    No
    v
/dashboard (participantes)
```

---

## Nuevo Dashboard de Mentor

### Secciones Principales

| Sección | Descripción |
|---------|-------------|
| **Cabecera** | Nombre, avatar, botón logout |
| **Mis Equipos** | Lista de todos los equipos del mentor con tarjetas expandibles |
| **Participantes por Equipo** | Al expandir un equipo, ver miembros (nombre, email) |
| **Próximos Eventos** | Eventos publicados con botón de registro |
| **Mis Inscripciones** | Entradas ya registradas |

### Wireframe Conceptual

```text
+--------------------------------------------------+
| Logo   Hola, [Nombre]!            [Logout]       |
+--------------------------------------------------+
|                                                  |
|  +----------------+  +------------------------+  |
|  | MI PERFIL      |  | MIS EQUIPOS (2)        |  |
|  | Nombre: X      |  |                        |  |
|  | Email: X       |  | [v] Equipo Alpha       |  |
|  | Rol: Mentor/a  |  |     - María (12 años)  |  |
|  | Hub: Madrid    |  |     - Lucía (13 años)  |  |
|  +----------------+  |     - Ana (12 años)    |  |
|                      |                        |  |
|                      | [>] Equipo Beta        |  |
|                      +------------------------+  |
|                                                  |
|  +-----------------------------------------+     |
|  | MIS ENTRADAS                            |     |
|  | - Evento Intermedio Madrid (Confirmada) |     |
|  +-----------------------------------------+     |
|                                                  |
|  +-----------------------------------------+     |
|  | PRÓXIMOS EVENTOS                        |     |
|  | [Evento 1]  [Evento 2]  [Evento 3]      |     |
|  +-----------------------------------------+     |
+--------------------------------------------------+
```

---

## Cambios en Base de Datos

**No se requieren cambios de esquema**. Las tablas existentes ya soportan:

- `team_members`: Un mentor puede tener múltiples registros con `member_type = 'mentor'`
- `event_registrations`: Mentores pueden registrarse a eventos
- `profiles`: Datos del perfil

---

## Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `src/pages/mentor/MentorDashboard.tsx` | Nuevo dashboard para mentores |
| `src/hooks/useMentorTeams.ts` | Hook para obtener equipos del mentor con miembros |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar ruta `/mentor/dashboard` protegida |
| `src/pages/Index.tsx` | Actualizar lógica de redirección post-login |
| `src/pages/AuthCallback.tsx` | Actualizar lógica de redirección |
| `src/pages/PendingVerification.tsx` | Redirigir mentores verificados a `/mentor/dashboard` |

---

## Implementación del Hook useMentorTeams

```typescript
// Obtiene todos los equipos donde el usuario es mentor
// junto con los miembros de cada equipo
export function useMentorTeams(userId: string | undefined) {
  return useQuery({
    queryKey: ['mentor-teams', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Obtener equipos donde es mentor
      const { data: teamMemberships, error } = await supabase
        .from('team_members')
        .select(`
          team_id,
          team:teams(
            id, name, category,
            hub:hubs(name, location)
          )
        `)
        .eq('user_id', userId)
        .eq('member_type', 'mentor');
      
      if (error) throw error;
      if (!teamMemberships?.length) return [];
      
      // Para cada equipo, obtener sus miembros
      const teamsWithMembers = await Promise.all(
        teamMemberships.map(async (tm) => {
          const { data: members } = await supabase
            .from('team_members')
            .select(`
              member_type,
              user:profiles(id, first_name, last_name, email)
            `)
            .eq('team_id', tm.team_id);
          
          return {
            ...tm.team,
            members: members || []
          };
        })
      );
      
      return teamsWithMembers;
    },
    enabled: !!userId,
  });
}
```

---

## Lógica de Redirección Actualizada

### Index.tsx (post-login automático)

```typescript
// Dentro de la verificación de usuario autenticado
if (user) {
  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  }
  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!isVerified) {
    return <Navigate to="/pending-verification" replace />;
  }
  
  // Redirección por rol
  if (role === "volunteer") {
    return <Navigate to="/voluntario/dashboard" replace />;
  }
  if (role === "mentor") {
    return <Navigate to="/mentor/dashboard" replace />;
  }
  // Participantes y jueces van al dashboard genérico
  return <Navigate to="/dashboard" replace />;
}
```

### AuthCallback.tsx (post-verificación OTP)

Misma lógica aplicada después de verificar el token.

---

## Diseño del MentorDashboard

### Estructura del Componente

```typescript
export default function MentorDashboard() {
  const { user, profile, role, signOut, isVerified } = useAuth();
  const { data: myTeams, isLoading: teamsLoading } = useMentorTeams(user?.id);
  const { data: upcomingEvents, isLoading: eventsLoading } = useQuery(...);
  const { data: myRegistrations, isLoading: registrationsLoading } = useQuery(...);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header con gradiente */}
      <header className="bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground">
        ...
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: Perfil */}
          <div className="space-y-6">
            <ProfileCard profile={profile} role={role} />
          </div>
          
          {/* Columna derecha: Equipos y Eventos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sección de Equipos */}
            <TeamsSection teams={myTeams} isLoading={teamsLoading} />
            
            {/* Mis Inscripciones */}
            <RegistrationsSection registrations={myRegistrations} />
            
            {/* Próximos Eventos */}
            <EventsSection events={upcomingEvents} />
          </div>
        </div>
      </main>
    </div>
  );
}
```

### Componente de Equipo Expandible

```typescript
// Usando Collapsible de shadcn/ui
<Collapsible>
  <CollapsibleTrigger className="w-full">
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-secondary" />
        <div className="text-left">
          <p className="font-medium">{team.name}</p>
          <p className="text-sm text-muted-foreground">
            {team.members.length} miembro(s)
          </p>
        </div>
      </div>
      <ChevronDown className="h-4 w-4" />
    </div>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="p-4 border-l-2 border-secondary/30 ml-6 space-y-2">
      {team.members
        .filter(m => m.member_type === 'participant')
        .map(member => (
          <div key={member.user.id} className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{member.user.first_name?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {member.user.first_name} {member.user.last_name}
              </p>
              <p className="text-xs text-muted-foreground">{member.user.email}</p>
            </div>
          </div>
        ))}
    </div>
  </CollapsibleContent>
</Collapsible>
```

---

## Rutas en App.tsx

```typescript
// Mentor Pages
import MentorDashboard from "./pages/mentor/MentorDashboard";

// Dentro de Routes
<Route path="/mentor/dashboard" element={
  <ProtectedRoute requiredRoles={["mentor", "admin"]}>
    <MentorDashboard />
  </ProtectedRoute>
} />
```

---

## Consideraciones de Seguridad

### RLS Existente (Suficiente)

Las políticas RLS actuales ya protegen adecuadamente:

- **team_members**: Los mentores solo pueden ver miembros de sus propios equipos via `get_user_team_ids(auth.uid())`
- **teams**: Solo pueden ver equipos donde son miembros
- **profiles**: Los admins pueden ver todos; usuarios normales solo el suyo

### Protección de Datos de Menores

Los mentores verán datos limitados de sus participantes:
- Nombre y apellidos
- Email (necesario para comunicación)

NO verán:
- DNI
- Teléfono
- Fecha de nacimiento
- Datos de los padres

---

## Orden de Implementación

1. Crear hook `useMentorTeams.ts`
2. Crear página `MentorDashboard.tsx`
3. Agregar ruta en `App.tsx`
4. Actualizar redirecciones en `Index.tsx`
5. Actualizar redirecciones en `AuthCallback.tsx`
6. Actualizar redirecciones en `PendingVerification.tsx`
7. Probar flujo completo con usuario mentor

---

## Diferencias con ParticipantDashboard

| Aspecto | Participante | Mentor |
|---------|--------------|--------|
| Equipos | Uno solo | Múltiples (expandibles) |
| Ver miembros | No | Sí (sus participantes) |
| Color header | Primary (rosa) | Secondary (verde) |
| Hub editable | No | No |
| Eventos | Ver y registrar | Ver y registrar |
| Inscripciones | Propias | Propias |
