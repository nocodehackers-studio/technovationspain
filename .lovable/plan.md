
## Plan: Corregir Gestión de Miembros de Equipos

### Resumen de Problemas Identificados

Hay dos categorías de problemas a resolver:

1. **Problemas de Validación en Importación CSV** (EQ-01 a EQ-04, HB-03)
2. **Problemas de Visualización Multi-Equipo para Mentores** (MT-01, MT-02)

---

### Análisis Actual del Código

| Componente | Estado Actual |
|------------|---------------|
| `AdminTeams.tsx` | Solo lectura - no permite añadir miembros manualmente |
| `TeamCSVImport.tsx` | Importa miembros sin validar rol, verificación o hub |
| `AdminImportTeams.tsx` | Importa miembros sin validar rol, verificación o hub |
| `UserEditSheet.tsx` | Usa `.maybeSingle()` - solo muestra 1 equipo |
| `useMentorTeams.ts` | Soporta múltiples equipos correctamente |

---

### Cambios a Realizar

#### 1. Validaciones en Importación CSV

Añadir validaciones en `TeamCSVImport.tsx` y `AdminImportTeams.tsx`:

| Validación | Regla | Acción |
|------------|-------|--------|
| **EQ-01** | Respetar rol del usuario | Si tiene rol `mentor` → `member_type = 'mentor'` |
| **EQ-02** | No admins en equipos | Si tiene rol `admin` → Excluir con warning |
| **EQ-03** | Solo usuarios verificados | Si `verification_status != 'verified'` → Excluir |
| **EQ-04** | Máximo 5 estudiantes | Contar existentes, rechazar si > 5 |
| **HB-03** | Mismo hub | Si `user.hub_id != team.hub_id` → Excluir |

#### 2. Soporte Multi-Equipo en Panel de Admin

Modificar `UserEditSheet.tsx` para mostrar todos los equipos de un mentor:

```text
Cambio actual:
┌─────────────────────────────────────┐
│ Equipo                              │
│ ┌─────────────────────────────────┐ │
│ │ PowerTeam          [Mentor]    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

Cambio propuesto:
┌─────────────────────────────────────┐
│ Equipos (2)                         │
│ ┌─────────────────────────────────┐ │
│ │ PowerTeam          [Mentor]    │ │
│ ├─────────────────────────────────┤ │
│ │ TechTeam           [Mentor]    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/admin/TeamCSVImport.tsx` | Añadir validaciones de rol, verificación, límite y hub |
| `src/pages/admin/AdminImportTeams.tsx` | Añadir validaciones de rol, verificación, límite y hub |
| `src/components/admin/UserEditSheet.tsx` | Cambiar query de `.maybeSingle()` a array |
| `src/components/admin/TeamInfoSection.tsx` | Soportar lista de equipos en lugar de uno solo |

---

### Sección Técnica

#### Lógica de Validación para Importación

```typescript
async function validateMemberForTeam(
  userId: string,
  teamId: string
): Promise<{ valid: boolean; reason?: string; memberType: 'participant' | 'mentor' }> {
  
  // 1. Obtener datos del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('verification_status, hub_id')
    .eq('id', userId)
    .single();
    
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  
  // 2. Obtener datos del equipo
  const { data: team } = await supabase
    .from('teams')
    .select('hub_id')
    .eq('id', teamId)
    .single();
    
  const userRoles = roles?.map(r => r.role) || [];
  
  // EQ-03: Verificar estado
  if (profile?.verification_status !== 'verified') {
    return { valid: false, reason: 'Usuario no verificado', memberType: 'participant' };
  }
  
  // EQ-02: No admins
  if (userRoles.includes('admin')) {
    return { valid: false, reason: 'Los administradores no pueden ser miembros de equipos', memberType: 'participant' };
  }
  
  // HB-03: Mismo hub (solo si ambos tienen hub asignado)
  if (team?.hub_id && profile?.hub_id && team.hub_id !== profile.hub_id) {
    return { valid: false, reason: 'El usuario pertenece a un hub diferente', memberType: 'participant' };
  }
  
  // EQ-01: Determinar member_type según rol
  const memberType = userRoles.includes('mentor') ? 'mentor' : 'participant';
  
  // EQ-04: Límite de 5 estudiantes (solo para participant)
  if (memberType === 'participant') {
    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('member_type', 'participant');
      
    if ((count || 0) >= 5) {
      return { valid: false, reason: 'El equipo ya tiene 5 estudiantes', memberType };
    }
  }
  
  return { valid: true, memberType };
}
```

#### Query Multi-Equipo para UserEditSheet

```typescript
// Antes:
const { data: teamMembership } = useQuery({
  queryFn: async () => {
    const { data } = await supabase
      .from("team_members")
      .select(`id, member_type, team:teams(id, name)`)
      .eq("user_id", user.id)
      .maybeSingle();  // ❌ Solo devuelve 1
    return data;
  }
});

// Después:
const { data: teamMemberships } = useQuery({
  queryFn: async () => {
    const { data } = await supabase
      .from("team_members")
      .select(`id, member_type, team:teams(id, name)`)
      .eq("user_id", user.id);  // ✅ Devuelve todos
    return data || [];
  }
});
```

#### Actualizar TeamInfoSection

```typescript
interface TeamInfoSectionProps {
  teams: Array<{
    teamName: string;
    memberType: 'participant' | 'mentor';
  }>;
}

export function TeamInfoSection({ teams }: TeamInfoSectionProps) {
  if (teams.length === 0) {
    return (/* Sin equipo asignado */);
  }
  
  return (
    <div className="space-y-4">
      <h3>Equipos ({teams.length})</h3>
      <div className="space-y-2">
        {teams.map((t, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
            <span>{t.teamName}</span>
            <Badge>{t.memberType === 'mentor' ? 'Mentor' : 'Estudiante'}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Resumen de Validaciones

| Issue | Validación | Ubicación |
|-------|------------|-----------|
| EQ-01 | `member_type` basado en rol del usuario | Import CSV |
| EQ-02 | Excluir usuarios con rol `admin` | Import CSV |
| EQ-03 | Solo usuarios `verified` | Import CSV |
| EQ-04 | Máximo 5 `participant` por equipo | Import CSV |
| HB-03 | `user.hub_id == team.hub_id` | Import CSV |
| MT-01 | Permitir mentor en múltiples equipos | Sin cambio (ya permitido) |
| MT-02 | Mostrar todos los equipos en admin panel | UserEditSheet + TeamInfoSection |
