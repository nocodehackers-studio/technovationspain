

# Plan: Validación Robusta de CSVs en Importación

## Resumen

Implementar validaciones preventivas en ambos sistemas de importación CSV para detectar archivos incorrectos **antes** de procesar los datos, mostrando errores claros y amigables.

## Validaciones a Implementar

### Nivel 1: Validación de Archivo (Inmediata)

| Validación | Descripción | Mensaje de Error |
|------------|-------------|------------------|
| Extensión | Solo `.csv` | "Por favor, selecciona un archivo CSV" |
| Tamaño máximo | ≤ 10MB | "El archivo no puede superar los 10MB" |
| Tipo MIME | `text/csv` o `text/plain` | "El archivo no parece ser un CSV válido" |
| Encoding | Detectar y advertir si no es UTF-8 | "⚠️ El archivo podría tener problemas de encoding" |

### Nivel 2: Validación de Estructura (Tras parsear)

| Validación | AdminImportCSV (Estudiantes) | TeamCSVImport (Equipos) |
|------------|------------------------------|-------------------------|
| CSV vacío | ✅ | ✅ (ya existe) |
| Columnas requeridas | Email (obligatorio) | Team ID, Name, Division |
| Columnas esperadas | Al menos 3 de: email, first name, last name, team name | Ya implementado |
| Número mínimo filas | ≥ 1 fila de datos | ≥ 1 fila de datos |
| Número máximo filas | ≤ 5000 filas | ≤ 1000 equipos |

### Nivel 3: Validación de Datos (En preview)

| Validación | Descripción |
|------------|-------------|
| Emails válidos | Regex básico para formato email |
| Campos vacíos críticos | Advertir si >50% de emails están vacíos |
| Caracteres extraños | Detectar posibles problemas de encoding |

## Cambios en AdminImportCSV.tsx

### 1. Nueva función de validación de estructura

```typescript
interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedType: "technovation_students" | "unknown";
}

const validateCSVStructure = (headers: string[], data: CSVRow[]): CSVValidationResult => {
  const result: CSVValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    detectedType: "unknown",
  };

  // 1. Check if empty
  if (data.length === 0) {
    result.isValid = false;
    result.errors.push("El archivo CSV está vacío");
    return result;
  }

  // 2. Check for email column (required)
  const emailPatterns = ["email", "correo", "e-mail", "mail"];
  const hasEmailColumn = headers.some(h => 
    emailPatterns.some(p => h.toLowerCase().includes(p))
  );
  
  if (!hasEmailColumn) {
    result.isValid = false;
    result.errors.push("No se encontró una columna de Email. Este campo es obligatorio.");
  }

  // 3. Check for expected Technovation columns
  const technovationPatterns = [
    "participant id", "first name", "last name", "team name", 
    "team division", "parent guardian", "school name"
  ];
  
  const matchedPatterns = technovationPatterns.filter(pattern =>
    headers.some(h => h.toLowerCase().includes(pattern))
  );

  if (matchedPatterns.length >= 3) {
    result.detectedType = "technovation_students";
  } else if (matchedPatterns.length === 0 && hasEmailColumn) {
    result.warnings.push(
      "Este CSV no parece ser de Technovation Global. " +
      "Asegúrate de que contiene los datos correctos antes de continuar."
    );
  }

  // 4. Check row count limits
  if (data.length > 5000) {
    result.isValid = false;
    result.errors.push(`El archivo tiene ${data.length} filas. El máximo permitido es 5000.`);
  }

  // 5. Sample data validation
  const sampleSize = Math.min(100, data.length);
  const emailColumn = headers.find(h => 
    emailPatterns.some(p => h.toLowerCase().includes(p))
  );
  
  if (emailColumn) {
    const emptyEmails = data.slice(0, sampleSize).filter(row => 
      !row[emailColumn] || row[emailColumn].trim() === ""
    ).length;
    
    if (emptyEmails > sampleSize * 0.5) {
      result.warnings.push(
        `Más del 50% de las filas tienen el email vacío. ` +
        `Esto podría indicar un problema con el archivo.`
      );
    }
  }

  return result;
};
```

### 2. UI para mostrar errores/warnings

```text
┌─────────────────────────────────────────────────────────────────┐
│  ❌ Error: El archivo no es válido                              │
│  ────────────────────────────────────────────────────────────── │
│  • No se encontró una columna de Email. Este campo es          │
│    obligatorio.                                                 │
│                                                                 │
│  Asegúrate de subir el CSV de estudiantes exportado desde      │
│  Technovation Global (People > Students > Export).              │
│                                                                 │
│                    [Subir otro archivo]                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Advertencia                                                 │
│  ────────────────────────────────────────────────────────────── │
│  • Este CSV no parece ser de Technovation Global.               │
│                                                                 │
│  Archivo detectado: "ventas_2024.csv"                           │
│  Columnas: Producto, Cantidad, Precio, Fecha                    │
│                                                                 │
│           [Cancelar]        [Continuar de todos modos]          │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Modificar handleFileUpload

```typescript
const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const selectedFile = e.target.files?.[0];
  if (!selectedFile) return;

  // Validación de extensión
  if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
    toast.error("Por favor, selecciona un archivo CSV");
    return;
  }

  // Validación de tamaño
  if (selectedFile.size > 10 * 1024 * 1024) {
    toast.error("El archivo no puede superar los 10MB");
    return;
  }

  // Validación de tipo MIME (opcional, algunos navegadores varían)
  const validMimeTypes = ["text/csv", "text/plain", "application/vnd.ms-excel"];
  if (selectedFile.type && !validMimeTypes.includes(selectedFile.type)) {
    console.warn("MIME type sospechoso:", selectedFile.type);
  }

  setFile(selectedFile);

  Papa.parse(selectedFile, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const headers = results.meta.fields || [];
      const data = results.data as CSVRow[];
      
      // NUEVA validación de estructura
      const validation = validateCSVStructure(headers, data);
      
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        setStep("validation-error");
        return;
      }
      
      if (validation.warnings.length > 0) {
        setValidationWarnings(validation.warnings);
        setShowWarningDialog(true);
      }
      
      setCsvHeaders(headers);
      setCsvData(data);
      setColumnMappings(autoDetectMappings(headers));
      setStep("preview");
    },
    error: (error) => {
      toast.error(`Error al leer el archivo: ${error.message}`);
    },
  });
}, []);
```

## Cambios en TeamCSVImport.tsx

### Añadir validaciones similares

```typescript
// Añadir límite de tamaño
if (file.size > 5 * 1024 * 1024) {
  toast.error("El archivo no puede superar los 5MB");
  return;
}

// Añadir límite de filas
if (rows.length > 1000) {
  toast.error(`El archivo tiene ${rows.length} equipos. El máximo permitido es 1000.`);
  return;
}

// Validar formato de Team ID (debe ser numérico o alfanumérico específico)
const invalidTeamIds = rows.filter(r => 
  !r["Team ID"] || !/^[A-Za-z0-9-]+$/.test(r["Team ID"])
);
if (invalidTeamIds.length > 0) {
  toast.error(`${invalidTeamIds.length} filas tienen Team ID inválido`);
  return;
}
```

## Nuevo estado para errores de validación

```typescript
// Nuevos estados
const [validationErrors, setValidationErrors] = useState<string[]>([]);
const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
const [showWarningDialog, setShowWarningDialog] = useState(false);

// Nuevo paso
type ImportStep = "upload" | "validation-error" | "preview" | "processing" | "results";
```

## Resumen de Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/AdminImportCSV.tsx` | Añadir validación de estructura, UI de errores, límites de filas |
| `src/components/admin/TeamCSVImport.tsx` | Añadir límite de tamaño, límite de filas, validación de Team ID |

## Beneficios

1. **Prevención**: Detecta archivos incorrectos antes de intentar procesarlos
2. **Claridad**: Mensajes de error específicos que explican qué está mal
3. **Seguridad**: Limita tamaño y número de filas para evitar sobrecarga
4. **UX**: Permite al usuario corregir el error sin perder tiempo

