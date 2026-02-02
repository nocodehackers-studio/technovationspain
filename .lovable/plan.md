
## Plan: Añadir Progreso de Registro de Equipos al Dashboard

### Resumen
Corregir el link roto en la tarjeta de usuarios y añadir una nueva tarjeta de progreso de equipos debajo, mostrando estadísticas de equipos activos y completos.

---

### Cambios a Realizar

#### 1. Corregir link de WhitelistProgressCard

El link actual navega a `/admin/import-users` que no existe. Debe navegar a `/admin/users`.

| Antes | Después |
|-------|---------|
| `/admin/import-users` | `/admin/users` |

---

#### 2. Crear componente TeamProgressCard

Nueva tarjeta similar a `WhitelistProgressCard` que muestre:

**Métricas principales:**
- Total de equipos
- Equipos activos (≥1 participante registrado)
- Equipos completos (100% participantes registrados)
- Equipos sin actividad (0 registros de whitelist)

**Desglose visual:**
| Estado | Definición | Color |
|--------|------------|-------|
| Completos | `registered = whitelist` y `whitelist > 0` | Verde (success) |
| En progreso | `0 < registered < whitelist` | Azul (info) |
| Sin iniciar | `registered = 0` y `whitelist > 0` | Naranja (warning) |
| Sin datos | `whitelist = 0` | Gris (muted) |

**Navegación:** Click lleva a `/admin/teams`

---

#### 3. Layout en Dashboard

Actualizar el dashboard para mostrar las dos tarjetas de progreso en una cuadrícula:

```text
┌──────────────────────────────────────────────────┐
│ Métricas: Usuarios | Verificados | Pendientes | Equipos │
├──────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌─────────────────────┐ │
│ │ Progreso Usuarios   │  │ Progreso Equipos    │ │
│ │ (WhitelistProgress) │  │ (TeamProgress)      │ │
│ │ 12/499 registrados  │  │ 3/87 equipos activos│ │
│ └─────────────────────┘  └─────────────────────┘ │
├──────────────────────────────────────────────────┤
│ Gráficos...                                      │
└──────────────────────────────────────────────────┘
```

---

### Datos a Obtener

Nueva query para estadísticas de equipos:

```typescript
const { data: teamStats } = useQuery({
  queryKey: ["admin-team-registration-stats"],
  queryFn: async () => {
    // Obtener todos los equipos
    const { data: teams } = await supabase.from("teams").select("id, name");
    
    // Obtener estadísticas del whitelist por equipo
    const { data: whitelist } = await supabase
      .from("authorized_users")
      .select("team_name, matched_profile_id")
      .not("team_name", "is", null);
    
    // Calcular stats por equipo
    const teamStatsMap = new Map<string, { whitelist: number; registered: number }>();
    
    whitelist?.forEach(u => {
      const key = u.team_name?.toLowerCase();
      const current = teamStatsMap.get(key) || { whitelist: 0, registered: 0 };
      current.whitelist++;
      if (u.matched_profile_id) current.registered++;
      teamStatsMap.set(key, current);
    });
    
    // Clasificar equipos
    let complete = 0, inProgress = 0, notStarted = 0, noData = 0;
    
    teams?.forEach(team => {
      const stats = teamStatsMap.get(team.name.toLowerCase());
      if (!stats || stats.whitelist === 0) {
        noData++;
      } else if (stats.registered === stats.whitelist) {
        complete++;
      } else if (stats.registered > 0) {
        inProgress++;
      } else {
        notStarted++;
      }
    });
    
    return {
      total: teams?.length || 0,
      complete,
      inProgress,
      notStarted,
      noData,
      active: complete + inProgress,
    };
  },
});
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/admin/WhitelistProgressCard.tsx` | Corregir link de navegación a `/admin/users` |
| `src/components/admin/TeamProgressCard.tsx` | **NUEVO** - Tarjeta de progreso de equipos |
| `src/pages/admin/AdminDashboard.tsx` | Añadir query de team stats y renderizar ambas tarjetas en grid |

---

### Sección Técnica

#### Interfaz de datos para TeamProgressCard

```typescript
interface TeamStats {
  total: number;        // Total de equipos
  complete: number;     // Equipos 100% registrados
  inProgress: number;   // Equipos con al menos 1 registro
  notStarted: number;   // Equipos con whitelist pero 0 registros
  noData: number;       // Equipos sin datos en whitelist
  active: number;       // complete + inProgress
}
```

#### Diseño visual de la tarjeta

```text
┌─────────────────────────────────────────────┐
│ 🏆 Progreso de Registro - Equipos           │
│    Equipos de Technovation Global           │
├─────────────────────────────────────────────┤
│                                             │
│           3 / 87                            │
│         equipos activos                     │
│                                             │
│ ████████░░░░░░░░░░░░░░░░  3.4%             │
│                                             │
│ ⚠ 84 equipos pendientes de registro         │
│                                             │
├─────────────────────────────────────────────┤
│ ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐ │
│ │ ✓ 1   │  │ ◐ 2   │  │ ○ 10  │  │ — 74  │ │
│ │ Compl.│  │ Prog. │  │ S/Ini.│  │ S/Dat.│ │
│ └───────┘  └───────┘  └───────┘  └───────┘ │
└─────────────────────────────────────────────┘
```

Estados:
- **Completos (✓)**: Verde - Todos los miembros del whitelist registrados
- **En Progreso (◐)**: Azul - Al menos 1 miembro registrado
- **Sin Iniciar (○)**: Naranja - Whitelist con usuarios pero ninguno registrado
- **Sin Datos (—)**: Gris - Equipo sin usuarios en whitelist
