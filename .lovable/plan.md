

## Plan: Vincular Usuarios a Equipos Manualmente desde Admin

### Resumen

Añadir una funcionalidad en el panel de administración que permita vincular manualmente un usuario a un equipo. Esta funcionalidad se integrará en dos lugares:

1. **UserEditSheet** (panel lateral de edición de usuario): Nueva sección para gestionar la vinculación a equipos
2. **Team Members Dialog** (en AdminTeams): Botón para añadir miembros directamente al equipo

### Flujo de Usuario

```text
Opción A: Desde el panel de usuario (UserEditSheet)
┌──────────────────────────────────────────┐
│  Panel de Usuario                        │
│  ────────────────                        │
│  [Avatar] María García                   │
│  maria@email.com                         │
│  [Verificado] [Participante]             │
│                                          │
│  ─── Equipo ───────────────────────────  │
│  Equipo actual: Las Innovadoras          │
│  [Cambiar equipo ▼] [Desvincular]        │
│                                          │
│  Tipo de miembro: ○ Estudiante ○ Mentor  │
└──────────────────────────────────────────┘

Opción B: Desde el diálogo de miembros del equipo
┌──────────────────────────────────────────┐
│  Miembros de "Las Innovadoras"           │
│  ────────────────────────────            │
│  [👤] Ana López - Estudiante             │
│  [👤] María García - Mentor              │
│                                          │
│  [+ Añadir miembro]                      │
│  ────────────────────────────            │
│  Buscar usuario: [_______________]       │
│  Tipo: ○ Estudiante ○ Mentor             │
│  [Añadir]                                │
└──────────────────────────────────────────┘
```

### Cambios Técnicos

#### 1. Nuevo Componente: `TeamLinkSection`

Crear un componente reutilizable para la sección de vinculación de equipos:

**Archivo:** `src/components/admin/TeamLinkSection.tsx`

- Dropdown para seleccionar equipo (con búsqueda)
- Radio buttons para tipo de miembro (estudiante/mentor)
- Botón para vincular/desvincular
- Mostrar equipo actual si existe

#### 2. Modificar `UserEditSheet.tsx`

Añadir la nueva sección de "Equipo" después de "Rol del Usuario":

- Importar el nuevo componente `TeamLinkSection`
- Mostrar el equipo actual del usuario (si tiene)
- Permitir cambiar o desvincular del equipo
- Mutations para INSERT/DELETE en `team_members`

#### 3. Modificar `AdminTeams.tsx`

Añadir funcionalidad para vincular usuarios directamente desde el diálogo de miembros:

- Botón "Añadir miembro" en el diálogo de miembros
- Combobox de búsqueda de usuarios (por nombre o email)
- Selector de tipo de miembro
- Mutation para INSERT en `team_members`

#### 4. Actualizar Query de Usuarios

Modificar la query en `AdminUsers.tsx` para incluir también el `team_id` del usuario, no solo el `team_name`, para poder manejarlo en el Sheet.

### Detalles de Implementación

**Nuevas Mutations necesarias:**

```typescript
// Vincular usuario a equipo
const linkToTeamMutation = useMutation({
  mutationFn: async ({ 
    userId, 
    teamId, 
    memberType 
  }: { 
    userId: string; 
    teamId: string; 
    memberType: 'participant' | 'mentor' 
  }) => {
    // Primero eliminar cualquier vinculación existente
    await supabase
      .from("team_members")
      .delete()
      .eq("user_id", userId);
    
    // Insertar nueva vinculación
    const { error } = await supabase
      .from("team_members")
      .insert({
        user_id: userId,
        team_id: teamId,
        member_type: memberType,
      });

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    toast.success("Usuario vinculado al equipo");
  },
});

// Desvincular usuario de equipo
const unlinkFromTeamMutation = useMutation({
  mutationFn: async (userId: string) => {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    toast.success("Usuario desvinculado del equipo");
  },
});
```

**UI para buscar usuarios (en AdminTeams):**

Utilizar el componente `Combobox` de shadcn/ui para buscar usuarios por nombre o email con autocompletado.

### Archivos a Modificar/Crear

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/components/admin/TeamLinkSection.tsx` | Crear | Componente de vinculación de equipos |
| `src/components/admin/UserEditSheet.tsx` | Modificar | Añadir sección de equipo |
| `src/pages/admin/AdminTeams.tsx` | Modificar | Añadir botón y diálogo para añadir miembros |
| `src/pages/admin/AdminUsers.tsx` | Modificar | Incluir team_id en la query |

### Consideraciones

- **RLS**: Ya existe política `Admins can manage team members` para la tabla `team_members`
- **Validación**: Verificar que el usuario no esté ya en el equipo antes de insertar
- **UX**: Mostrar confirmación antes de cambiar de equipo si el usuario ya tiene uno
- **Consistencia**: Al cambiar el tipo de miembro (estudiante/mentor), usar el mismo equipo

### Nota sobre terminología

También se corregirá "Mentora" a "Mentor" en el SelectItem del UserEditSheet (línea 388) como parte de este cambio.

