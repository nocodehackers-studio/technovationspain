

## Plan: Crear Equipos Automáticamente en Importación de Participantes

### Problema Detectado

Actualmente, si se importa el CSV de participantes **antes** del CSV de equipos:

```text
┌───────────────────────────────────────────────────────────────────────┐
│  CSV Participantes                                                    │
│  ├── Email: ana@ejemplo.com                                          │
│  ├── Team Name: "Tech Girls"                                         │
│  └── Team Division: "Junior"                                         │
│                                      ↓                                │
│  authorized_users (✓ se crea)                                        │
│  └── team_name = "Tech Girls"                                        │
│                                                                       │
│  teams (✗ NO existe "Tech Girls")                                    │
│                                                                       │
│  → Cuando Ana se registra, el trigger NO la vincula al equipo        │
│    porque el equipo no existe en la tabla teams                      │
└───────────────────────────────────────────────────────────────────────┘
```

### Solución Propuesta

Modificar la importación de participantes para que **cree automáticamente los equipos** que no existen:

```text
┌───────────────────────────────────────────────────────────────────────┐
│  CSV Participantes                                                    │
│  ├── Detectar team_name únicos: ["Tech Girls", "Code Warriors", ...]  │
│  ├── Consultar tabla teams                                           │
│  ├── Identificar equipos nuevos a crear                              │
│  └── Crear equipos en la base de datos ANTES de insertar usuarios    │
│                                                                       │
│  → Al registrarse Ana, el equipo "Tech Girls" ya existe              │
│  → El trigger la vincula automáticamente                             │
└───────────────────────────────────────────────────────────────────────┘
```

---

### Flujo Actualizado

```text
┌────────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│   Subir CSV        │────▶│  Análisis:           │────▶│  Preview muestra:  │
│   Participantes    │     │  - Emails únicos     │     │  - X participantes │
│                    │     │  - Equipos únicos    │     │  - Y equipos nuevos│
└────────────────────┘     │  - ¿Qué equipos      │     │    a crear         │
                           │    existen ya?       │     └────────────────────┘
                           └──────────────────────┘
                                                              │
                                                              ▼
┌────────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│   Resultado:       │◀────│  Procesamiento:      │◀────│  Usuario confirma  │
│   - Z equipos      │     │  1. Crear equipos    │     │                    │
│     creados        │     │  2. Insertar en      │     │                    │
│   - W usuarios     │     │     authorized_users │     │                    │
│     importados     │     └──────────────────────┘     └────────────────────┘
└────────────────────┘
```

---

### Cambios a Realizar

#### 1. Fase de Análisis - Detectar Equipos Nuevos

En `processCSVData`, añadir lógica para:

```typescript
// Extraer equipos únicos del CSV
const uniqueTeams = new Map<string, { name: string; division: string }>();
for (const record of records) {
  if (record.team_name && record.team_division) {
    const key = record.team_name.toLowerCase();
    if (!uniqueTeams.has(key)) {
      uniqueTeams.set(key, {
        name: record.team_name,
        division: record.team_division,
      });
    }
  }
}

// Consultar qué equipos ya existen
const teamNames = [...uniqueTeams.keys()];
const { data: existingTeams } = await supabase
  .from("teams")
  .select("name")
  .filter("name", "in", `(${teamNames.map(n => `"${n}"`).join(",")})`);

const existingTeamNames = new Set(
  existingTeams?.map(t => t.name.toLowerCase()) || []
);

// Identificar equipos a crear
const teamsToCreate = [...uniqueTeams.entries()]
  .filter(([key]) => !existingTeamNames.has(key))
  .map(([_, value]) => value);
```

#### 2. Actualizar Estado del Resumen

```typescript
// Añadir al summaryData
setSummaryData({
  ...prev,
  teamsToCreate: teamsToCreate.length,
  totalTeamsInCSV: uniqueTeams.size,
  existingTeams: uniqueTeams.size - teamsToCreate.length,
});
```

#### 3. Mostrar en Vista Previa

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Resumen de Importación                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  👥 Participantes                                                       │
│  ┌────────┬───────────┬──────────────┬─────────────┐                   │
│  │  250   │    80     │     120      │     35      │                   │
│  │  Total │ Estudiantes│  Mentores   │   Jueces    │                   │
│  └────────┴───────────┴──────────────┴─────────────┘                   │
│                                                                         │
│  📦 Equipos                         ← NUEVO                             │
│  ┌────────────────────────────────────────────────┐                    │
│  │  45 equipos detectados en el CSV              │                     │
│  │  ✓ 12 ya existen en la plataforma             │                     │
│  │  + 33 equipos NUEVOS se crearán               │                     │
│  └────────────────────────────────────────────────┘                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4. Fase de Procesamiento - Crear Equipos

Antes de insertar usuarios en `authorized_users`:

```typescript
// Crear equipos nuevos primero
if (teamsToCreate.length > 0) {
  const teamInserts = teamsToCreate.map(team => ({
    name: team.name,
    category: mapDivisionToCategory(team.division), // beginner, junior, senior
    // tg_team_id: null - se llenará si luego se importa CSV de equipos
  }));

  const { error } = await supabase
    .from("teams")
    .insert(teamInserts);

  if (error) {
    console.error("Error creando equipos:", error);
  } else {
    result.teamsCreated = teamsToCreate.length;
  }
}

// Continuar con la importación de usuarios...
```

#### 5. Manejar Conflictos con CSV de Equipos Posterior

Si después se importa el CSV de equipos con más información:

```text
┌───────────────────────────────────────────────────────────────────────┐
│  Escenario: CSV Equipos importado DESPUÉS de CSV Participantes       │
│                                                                       │
│  CSV Equipos contiene:                                                │
│  - Team ID: 41425                                                     │
│  - Name: "Tech Girls"  ← Ya existe (creado por import participantes) │
│  - Division: Junior                                                   │
│  - Student emails: ana@ejemplo.com, ...                               │
│                                                                       │
│  Comportamiento actual de AdminImportTeams:                           │
│  → Busca por tg_team_id (41425) → No existe                           │
│  → Crea nuevo equipo "Tech Girls" → ¡DUPLICADO!                       │
│                                                                       │
│  Solución: Buscar también por nombre exacto                           │
│  → Si existe "Tech Girls", ACTUALIZAR con tg_team_id en lugar de     │
│    crear nuevo                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/AdminImportUnified.tsx` | Añadir detección de equipos, crear equipos antes de usuarios |
| `src/components/admin/import/ImportSummaryCard.tsx` | Mostrar estadísticas de equipos a crear |
| `src/pages/admin/AdminImportTeams.tsx` | Buscar equipos por nombre además de tg_team_id |

---

### Sección Técnica

#### Cambios en AdminImportUnified.tsx

**1. Nuevo estado para equipos**

```typescript
const [teamsToCreate, setTeamsToCreate] = useState<{name: string; division: string}[]>([]);
```

**2. Función para mapear división a categoría**

```typescript
const mapDivisionToCategory = (division: string): string => {
  const d = division?.toLowerCase().trim();
  if (d === "beginner") return "beginner";
  if (d === "junior") return "junior";
  if (d === "senior") return "senior";
  return "junior"; // Default
};
```

**3. En processCSVData, después de calcular summaryData**

```typescript
// Detectar equipos únicos
const uniqueTeamsMap = new Map<string, { name: string; division: string }>();
for (const record of records) {
  if (record.team_name?.trim() && record.team_division?.trim()) {
    const key = record.team_name.toLowerCase().trim();
    if (!uniqueTeamsMap.has(key)) {
      uniqueTeamsMap.set(key, {
        name: record.team_name.trim(),
        division: record.team_division.trim(),
      });
    }
  }
}

// Verificar cuáles ya existen
let newTeamsToCreate: {name: string; division: string}[] = [];
if (uniqueTeamsMap.size > 0) {
  const teamNames = [...uniqueTeamsMap.values()].map(t => t.name);
  
  // Buscar en batches si hay muchos
  const { data: existingTeams } = await supabase
    .from("teams")
    .select("name");
  
  const existingSet = new Set(
    existingTeams?.map(t => t.name.toLowerCase()) || []
  );
  
  newTeamsToCreate = [...uniqueTeamsMap.entries()]
    .filter(([key]) => !existingSet.has(key))
    .map(([_, val]) => val);
}

setTeamsToCreate(newTeamsToCreate);
```

**4. Actualizar summaryData**

```typescript
setSummaryData({
  ...prev,
  teamsInCSV: uniqueTeamsMap.size,
  teamsToCreate: newTeamsToCreate.length,
  teamsExisting: uniqueTeamsMap.size - newTeamsToCreate.length,
});
```

**5. En importMutation, ANTES del loop de usuarios**

```typescript
// Crear equipos nuevos primero
if (teamsToCreate.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < teamsToCreate.length; i += batchSize) {
    const batch = teamsToCreate.slice(i, i + batchSize);
    const { error } = await supabase
      .from("teams")
      .insert(batch.map(t => ({
        name: t.name,
        category: mapDivisionToCategory(t.division),
      })));
    
    if (error) {
      console.error("Error creating teams batch:", error);
    }
  }
}
```

**6. Actualizar ImportResult**

```typescript
interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  teamsCreated: number;  // ← NUEVO
  errors: { row: number; reason: string; data: CSVRow }[];
}
```

#### Cambios en ImportSummaryCard.tsx

Añadir sección de equipos si hay equipos detectados:

```tsx
{data.teamsInCSV > 0 && (
  <div className="p-4 rounded-lg border bg-card">
    <div className="flex items-center gap-2 mb-3">
      <Users className="h-5 w-5 text-primary" />
      <h4 className="font-medium">Equipos Detectados</h4>
    </div>
    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <div className="text-2xl font-bold">{data.teamsInCSV}</div>
        <div className="text-sm text-muted-foreground">En CSV</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-muted-foreground">{data.teamsExisting}</div>
        <div className="text-sm text-muted-foreground">Ya existen</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-green-600">{data.teamsToCreate}</div>
        <div className="text-sm text-muted-foreground">Se crearán</div>
      </div>
    </div>
  </div>
)}
```

#### Cambios en AdminImportTeams.tsx

Modificar la lógica de búsqueda de equipos para evitar duplicados:

```typescript
// Buscar primero por tg_team_id, luego por nombre
let existingTeam: { id: string } | null = null;

// Primero buscar por tg_team_id (más específico)
const { data: teamByTgId } = await supabase
  .from("teams")
  .select("id")
  .eq("tg_team_id", team.tgTeamId)
  .maybeSingle();

if (teamByTgId) {
  existingTeam = teamByTgId;
} else {
  // Si no existe por tg_team_id, buscar por nombre exacto
  const { data: teamByName } = await supabase
    .from("teams")
    .select("id")
    .ilike("name", team.name)
    .maybeSingle();
  
  existingTeam = teamByName;
}

if (existingTeam) {
  // Actualizar equipo existente (añadir tg_team_id si no lo tenía)
  const { error: updateError } = await supabase
    .from("teams")
    .update({
      name: team.name,
      category: team.division,
      tg_team_id: team.tgTeamId,  // ← Actualizar el ID de TG
    })
    .eq("id", existingTeam.id);
  // ...
}
```

---

### Resultado Esperado

| Orden de Importación | Antes | Después |
|----------------------|-------|---------|
| Participantes → Equipos | ❌ Usuarios sin vincular a equipo | ✅ Equipos creados automáticamente, usuarios vinculados |
| Equipos → Participantes | ✅ Funciona correctamente | ✅ Sigue funcionando igual |
| Solo Participantes | ❌ Equipos no existen | ✅ Equipos creados, listos para vincular |
| Reimportar Equipos | ❌ Posibles duplicados | ✅ Busca por nombre, actualiza con tg_team_id |

