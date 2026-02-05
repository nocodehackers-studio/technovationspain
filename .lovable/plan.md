
# Plan: Añadir Logs de Debugging para el Procesamiento CSV

## Problema
El sistema se queda en "Procesando archivo CSV..." y nunca avanza al paso de preview. Esto indica que algo está fallando silenciosamente en el proceso asíncrono.

## Puntos Críticos a Monitorear

Hay varios lugares donde el proceso podría quedarse atascado:

1. **Papa.parse** - Parsing del archivo CSV
2. **processCSVData** - Función principal de procesamiento
3. **fetchExistingProfilesInBatches** - Consulta a `profiles` en lotes
4. **fetchExistingAuthorizedInBatches** - Consulta a `authorized_users` en lotes
5. **Consulta de equipos existentes** - Query a `teams`

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminImportUnified.tsx` | Añadir console.log en cada paso crítico |

## Logs a Añadir

### 1. En handleFileUpload (línea ~437)
```typescript
console.log('[CSV Import] Starting file parse:', selectedFile.name);

Papa.parse(selectedFile, {
  // ...
  complete: async (results) => {
    console.log('[CSV Import] Papa.parse complete, rows:', results.data.length);
    try {
      // ...
      console.log('[CSV Import] Headers found:', headers.length, headers.slice(0, 5));
      console.log('[CSV Import] Starting processCSVData...');
      await processCSVData(headers, data);
      console.log('[CSV Import] processCSVData complete, moving to preview');
      setStep("preview");
    } catch (error) {
      console.error('[CSV Import] Error in complete callback:', error);
    } finally {
      setIsParsing(false);
    }
  },
  error: (error) => {
    console.error('[CSV Import] Papa.parse error:', error);
    // ...
  },
});
```

### 2. En fetchExistingProfilesInBatches (línea ~206)
```typescript
const fetchExistingProfilesInBatches = async (emails: string[]) => {
  console.log('[CSV Import] fetchExistingProfilesInBatches, total emails:', emails.length);
  const BATCH_SIZE = 200;
  const allEmails = new Set<string>();
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    console.log(`[CSV Import] Profiles batch ${i / BATCH_SIZE + 1}, size: ${batch.length}`);
    
    const { data, error } = await supabase
      .from("profiles")
      .select("email, tg_email")
      .or(orFilter);
    
    if (error) {
      console.error('[CSV Import] Error fetching profiles batch:', error);
    } else {
      console.log(`[CSV Import] Profiles batch result: ${data?.length || 0} records`);
    }
    // ...
  }
  
  console.log('[CSV Import] fetchExistingProfilesInBatches complete, found:', allEmails.size);
  return allEmails;
};
```

### 3. En fetchExistingAuthorizedInBatches (línea ~186)
```typescript
const fetchExistingAuthorizedInBatches = async (emails: string[]) => {
  console.log('[CSV Import] fetchExistingAuthorizedInBatches, total emails:', emails.length);
  // ... similar logging pattern
};
```

### 4. En processCSVData (línea ~231)
```typescript
const processCSVData = useCallback(async (headers: string[], data: CSVRow[]) => {
  console.log('[CSV Import] processCSVData started, rows:', data.length);
  
  const records = data.map((row, index) => ({...}));
  console.log('[CSV Import] Records mapped:', records.length);
  
  // After summary calculation
  console.log('[CSV Import] Summary calculated, byProfileType:', byProfileType);
  
  // After email counting
  console.log('[CSV Import] Unique emails found:', uniqueEmails.length);
  
  // Before batch fetches
  console.log('[CSV Import] Starting batch fetches...');
  const existingProfileEmails = await fetchExistingProfilesInBatches(uniqueEmails);
  console.log('[CSV Import] Existing profiles fetched:', existingProfileEmails.size);
  
  const existingAuthorized = await fetchExistingAuthorizedInBatches(uniqueEmails);
  console.log('[CSV Import] Existing authorized fetched:', existingAuthorized.length);
  
  // Before teams query
  console.log('[CSV Import] Checking existing teams, unique teams in CSV:', uniqueTeamsMap.size);
  
  // At the end
  console.log('[CSV Import] processCSVData complete', {
    records: records.length,
    conflicts: detectedConflicts.length,
    teamsToCreate: newTeamsToCreate.length,
  });
  
  return detectedConflicts;
}, []);
```

## Resultado Esperado

Con estos logs podremos ver en la consola del navegador:
1. Qué paso se está ejecutando
2. Dónde se queda atascado (el último log antes del bloqueo)
3. Si hay errores silenciosos en las consultas a Supabase

El usuario podrá compartir los logs de consola para identificar el problema exacto.
