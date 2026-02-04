
# Plan: Añadir Indicador de Carga y Resumen de Usuarios en Importación CSV

## Problema 1: No hay feedback visual mientras se procesa el CSV
Después de seleccionar un archivo, el sistema queda aparentemente "congelado" mientras procesa los datos (detecta conflictos, consulta la base de datos, etc.). El usuario no sabe si está funcionando.

## Problema 2: No hay resumen de usuarios como el de equipos
Actualmente se muestra un resumen de equipos (En CSV / Ya existen / Se crearán), pero no hay un resumen equivalente para usuarios.

---

## Solución Propuesta

### Parte 1: Indicador de Carga
Añadir un estado `isParsing` que se active mientras se procesa el CSV y muestre un mensaje de carga debajo del área de arrastrar/soltar.

### Parte 2: Resumen de Usuarios
Extender los datos de resumen para incluir:
- **Usuarios en CSV**: Total de registros
- **Ya registrados**: Usuarios que ya tienen perfil activo (conflictos `already_active`)
- **Ya en whitelist**: Usuarios que ya están en la whitelist (conflictos `already_in_whitelist`)
- **Nuevos**: Usuarios que se añadirán por primera vez

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminImportUnified.tsx` | Añadir estado `isParsing` y calcular contadores de usuarios |
| `src/components/admin/import/ImportSummaryCard.tsx` | Añadir sección de resumen de usuarios similar a equipos |

---

## Cambios Técnicos

### AdminImportUnified.tsx

**1. Nuevo estado para parsing:**
```typescript
const [isParsing, setIsParsing] = useState(false);
```

**2. Activar/desactivar en handleFileUpload:**
```typescript
const handleFileUpload = useCallback(async (e) => {
  // ... validaciones iniciales ...
  
  setFile(selectedFile);
  setIsParsing(true);  // <-- Activar loader
  
  Papa.parse(selectedFile, {
    // ... config ...
    complete: async (results) => {
      // ... procesamiento ...
      await processCSVData(headers, data);
      setStep("preview");
      setIsParsing(false);  // <-- Desactivar loader
    },
    error: (error) => {
      toast.error(`Error al leer el archivo: ${error.message}`);
      setIsParsing(false);  // <-- Desactivar en error
    },
  });
}, [processCSVData]);
```

**3. Extender summaryData con contadores de usuarios:**
```typescript
const [summaryData, setSummaryData] = useState({
  // ... campos existentes ...
  usersInCSV: 0,
  usersNew: 0,
  usersInWhitelist: 0,
  usersAlreadyActive: 0,
});
```

**4. Calcular contadores en processCSVData:**
```typescript
const alreadyActiveCount = detectedConflicts.filter(c => c.conflictType === "already_active").length;
const alreadyInWhitelistCount = detectedConflicts.filter(c => c.conflictType === "already_in_whitelist").length;
const duplicatesCount = detectedConflicts.filter(c => c.conflictType === "duplicate_in_csv").length;

setSummaryData({
  // ... existente ...
  usersInCSV: records.length,
  usersNew: records.length - alreadyActiveCount - alreadyInWhitelistCount - duplicatesCount,
  usersInWhitelist: alreadyInWhitelistCount,
  usersAlreadyActive: alreadyActiveCount,
});
```

**5. Mostrar loader en la UI (debajo del área de drop):**
```tsx
{isParsing && (
  <div className="flex items-center justify-center gap-3 mt-4 p-4 rounded-lg bg-muted/50 border">
    <LoadingSpinner size="sm" />
    <span className="text-sm text-muted-foreground">
      Procesando archivo CSV...
    </span>
  </div>
)}
```

### ImportSummaryCard.tsx

**Añadir sección de resumen de usuarios (similar a equipos):**
```tsx
{/* Users Summary */}
<div className="p-4 rounded-lg border bg-card">
  <div className="flex items-center gap-2 mb-3">
    <UserPlus className="h-5 w-5 text-primary" />
    <h4 className="font-medium">Usuarios Detectados</h4>
  </div>
  <div className="grid grid-cols-4 gap-4 text-center">
    <div>
      <div className="text-2xl font-bold">{data.usersInCSV}</div>
      <div className="text-sm text-muted-foreground">En CSV</div>
    </div>
    <div>
      <div className="text-2xl font-bold text-green-600">{data.usersNew}</div>
      <div className="text-sm text-muted-foreground">Nuevos</div>
    </div>
    <div>
      <div className="text-2xl font-bold text-blue-600">{data.usersInWhitelist}</div>
      <div className="text-sm text-muted-foreground">En whitelist</div>
    </div>
    <div>
      <div className="text-2xl font-bold text-muted-foreground">{data.usersAlreadyActive}</div>
      <div className="text-sm text-muted-foreground">Ya activos</div>
    </div>
  </div>
</div>
```

---

## Visualización del Resultado

**Durante el procesamiento:**
```text
┌─────────────────────────────────────────────────────────────────┐
│  📄 Arrastra tu archivo CSV aquí                                 │
│     o haz clic para seleccionar                                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  ⏳ Procesando archivo CSV...                                    │
└─────────────────────────────────────────────────────────────────┘
```

**En el resumen de importación:**
```text
┌─────────────────────────────────────────────────────────────────┐
│  👤 Usuarios Detectados                                          │
│  ┌──────────┬──────────┬──────────────┬───────────────┐         │
│  │  1,234   │   1,100  │      80      │      54       │         │
│  │  En CSV  │  Nuevos  │ En whitelist │  Ya activos   │         │
│  └──────────┴──────────┴──────────────┴───────────────┘         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📦 Equipos Detectados                                           │
│  ┌──────────┬──────────────┬───────────────┐                    │
│  │   245    │      200     │      45       │                    │
│  │  En CSV  │  Ya existen  │  Se crearán   │                    │
│  └──────────┴──────────────┴───────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

1. **Feedback inmediato**: El usuario verá "Procesando archivo CSV..." mientras se analiza el archivo
2. **Información clara de usuarios**: Sabrá exactamente cuántos usuarios son nuevos, cuántos ya están en la whitelist y cuántos ya tienen cuenta activa
3. **Mejor UX**: No más confusión sobre si el sistema está funcionando o congelado
