

# Plan: Corregir el Input de Archivo CSV que No Detecta Archivos

## Problema Identificado

El componente de carga de CSV no responde cuando el usuario selecciona un archivo. Hay dos causas principales:

1. **El input no se resetea después de cada uso** - Si el usuario selecciona el mismo archivo dos veces, el evento `onChange` no se dispara porque el valor del input no cambia
2. **El input necesita una `key` dinámica** para forzar su re-renderización cuando el estado cambia

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminImportUnified.tsx` | Añadir reset del input y key dinámica |

## Cambios Técnicos

### 1. Añadir un inputKey state para forzar re-renderización

```typescript
// En la sección de estados (línea ~152)
const [inputKey, setInputKey] = useState(0);
```

### 2. Resetear el input después de procesar el archivo

En `handleFileUpload`, después de `setFile(selectedFile)`:

```typescript
// Resetear el valor del input para permitir re-seleccionar el mismo archivo
if (e.target && e.target.value) {
  e.target.value = '';
}
```

### 3. Añadir key dinámica al input y resetearla en handleReset

```typescript
// En el input (línea ~760)
<input
  key={inputKey}  // <-- Añadir esto
  id="csv-upload"
  type="file"
  accept=".csv"
  onChange={handleFileUpload}
  className="hidden"
/>
```

```typescript
// En handleReset (línea ~677)
const handleReset = () => {
  setStep("upload");
  setFile(null);
  setCsvData([]);
  setCsvHeaders([]);
  setParsedRecords([]);
  setConflicts([]);
  setTeamsToCreate([]);
  setProgress(0);
  setResult(null);
  setValidationErrors([]);
  setInputKey(prev => prev + 1);  // <-- Añadir esto
};
```

### 4. Usar useRef para acceso directo al input (opcional pero más robusto)

Alternativamente, usar una referencia directa al input para tener más control:

```typescript
const inputRef = useRef<HTMLInputElement>(null);

// En handleFileUpload, al final:
if (inputRef.current) {
  inputRef.current.value = '';
}

// En el JSX:
<input
  ref={inputRef}
  id="csv-upload"
  type="file"
  accept=".csv"
  onChange={handleFileUpload}
  className="hidden"
/>
```

## Solución Recomendada

Combinar ambos enfoques para máxima robustez:
- `useRef` para acceso directo y reseteo del valor
- `key` dinámica para casos donde se necesite forzar la recreación del elemento

## Resultado Esperado

- El input de archivo responderá correctamente cada vez que el usuario seleccione un archivo
- Se podrá seleccionar el mismo archivo múltiples veces sin problemas
- El drag & drop también funcionará correctamente

