
## Plan: Crear Datos DEMO para Asignación de Talleres

### Objetivo
Crear un conjunto de datos de demostración (equipos ficticios con preferencias de talleres) para probar el algoritmo de asignación. Los datos estarán claramente marcados para poder eliminarlos fácilmente después.

### Datos a Crear

**Evento objetivo**: Encuentro Equipos Technovation Girls Madrid 2026
- ID: `4ab6f915-a358-400a-90cd-a4f6b64e4698`

**Talleres disponibles** (7 talleres):
| ID | Nombre | Aforo |
|----|--------|-------|
| 67698a90... | Ética e IA | 30 |
| 9c5172bc... | Prompting | 100 |
| e03d947d... | Accesibilidad | 70 |
| 4c3f570a... | Machine Learning 4 Kids | 30 |
| 382911bd... | Diseña tu logo | 30 |
| f37fdae8... | Diseño y Usabilidad | 30 |
| 05a65a30... | Comunicación | 30 |

**Turnos** (3 turnos):
- Turno 1: 10:30-11:15
- Turno 2: 11:30-12:15
- Turno 3: 12:30-13:00

### Equipos DEMO a Crear (10 equipos)

| Nombre | Categoría | Participantes | Prefs (orden 1-7) |
|--------|-----------|---------------|-------------------|
| [DEMO] Las Innovadoras | junior | 5 | Ética, Prompting, ML4Kids, Diseño, Logo, Accesib, Comun |
| [DEMO] Tech Queens | senior | 4 | Prompting, Diseño, Ética, Accesib, Comun, ML4Kids, Logo |
| [DEMO] Code Masters | beginner | 6 | ML4Kids, Logo, Accesib, Ética, Prompting, Diseño, Comun |
| [DEMO] Digital Stars | junior | 3 | Diseño, Comun, Ética, ML4Kids, Logo, Prompting, Accesib |
| [DEMO] Future Coders | senior | 5 | Accesib, Ética, Prompting, Diseño, Comun, Logo, ML4Kids |
| [DEMO] AI Explorers | junior | 4 | Ética, Accesib, Prompting, Comun, Diseño, ML4Kids, Logo |
| [DEMO] Web Wizards | beginner | 5 | Logo, Diseño, ML4Kids, Comun, Accesib, Ética, Prompting |
| [DEMO] App Builders | senior | 4 | Comun, Diseño, Ética, Accesib, Prompting, Logo, ML4Kids |
| [DEMO] Data Divas | junior | 3 | Prompting, Ética, Accesib, Comun, Diseño, ML4Kids, Logo |
| [DEMO] Pixel Pioneers | beginner | 6 | Logo, ML4Kids, Diseño, Comun, Accesib, Ética, Prompting |

### Marcado para Identificación

Todos los datos DEMO tendrán estas marcas:

1. **Equipos**: 
   - Nombre con prefijo `[DEMO]`
   - Campo `notes` = `'[DEMO] Equipo de prueba para asignación de talleres'`
   - Campo `tg_team_id` = `'DEMO-XXX'`

2. **Event Registrations**: 
   - Campo `registration_number` = `'DEMO-XXX'`

3. **Workshop Preferences**:
   - Se identifican por el `team_id` (equipos DEMO)

### Limpieza Posterior

Para eliminar todos los datos DEMO:
```sql
-- 1. Eliminar preferencias de equipos DEMO
DELETE FROM workshop_preferences WHERE team_id IN (SELECT id FROM teams WHERE name LIKE '[DEMO]%');

-- 2. Eliminar asignaciones de equipos DEMO  
DELETE FROM workshop_assignments WHERE team_id IN (SELECT id FROM teams WHERE name LIKE '[DEMO]%');

-- 3. Eliminar registros de equipos DEMO
DELETE FROM event_registrations WHERE team_id IN (SELECT id FROM teams WHERE name LIKE '[DEMO]%');

-- 4. Eliminar equipos DEMO
DELETE FROM teams WHERE name LIKE '[DEMO]%';
```

### Implementación Técnica

**Archivo nuevo**: `src/hooks/useDemoData.ts`

Hook que expone:
- `generateDemoData()`: Crea los 10 equipos, sus registros y preferencias
- `clearDemoData()`: Elimina todos los datos marcados como DEMO
- `isLoading`: Estado de carga
- `demoTeamsCount`: Número de equipos DEMO existentes

**Modificación**: `src/pages/admin/AdminWorkshopAssignment.tsx`

Añadir en la zona de acciones:
- Botón "Generar Datos DEMO" (solo visible si no hay datos DEMO)
- Botón "Eliminar Datos DEMO" (solo visible si hay datos DEMO)
- Badge indicando cuántos equipos DEMO existen

### Flujo de Usuario

```text
1. Admin abre /admin/events/{eventId}/workshops/assign
2. Ve mensaje "No hay equipos registrados"
3. Click en "Generar Datos DEMO"
4. Se crean 10 equipos con preferencias variadas
5. La pre-validación muestra "10 equipos con preferencias"
6. Admin ejecuta "Vista Previa" o "Ejecutar Asignación"
7. Cuando termina de probar, click en "Eliminar Datos DEMO"
8. Todo vuelve al estado inicial
```

### Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/hooks/useDemoData.ts` | CREAR - Hook para generar/eliminar datos DEMO |
| `src/pages/admin/AdminWorkshopAssignment.tsx` | MODIFICAR - Añadir botones DEMO |
