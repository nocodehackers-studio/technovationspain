

# Plan: Optimizar Consultas de Profiles para Importación CSV

## Problema Detectado

La consulta a `profiles` está fallando silenciosamente porque:

1. **Filtro OR demasiado largo**: Con 200 emails por batch, se generan 400 condiciones OR (2 por email: `email.ilike` y `tg_email.ilike`)
2. **PostgREST tiene límites**: Las URLs muy largas o queries muy complejas pueden fallar
3. **Caracteres especiales**: Los emails contienen `@` y `.` que necesitan escaparse para `ilike`

## Solución Propuesta

Cambiar la estrategia de consulta:
- En lugar de usar filtros OR masivos, usar el operador `in` que es más eficiente
- Reducir el tamaño del batch
- Separar las consultas de `email` y `tg_email`

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminImportUnified.tsx` | Optimizar `fetchExistingProfilesInBatches` |

---

## Cambios Técnicos

### Reemplazar la función `fetchExistingProfilesInBatches`

**Antes (problemático):**
```typescript
const orFilter = batch.map(e => `email.ilike.${e},tg_email.ilike.${e}`).join(",");
const { data, error } = await supabase
  .from("profiles")
  .select("email, tg_email")
  .or(orFilter);
```

**Después (optimizado):**
```typescript
const fetchExistingProfilesInBatches = async (emails: string[]) => {
  console.log('[CSV Import] fetchExistingProfilesInBatches started, total emails:', emails.length);
  const BATCH_SIZE = 500; // Larger batch since IN is more efficient
  const allEmails = new Set<string>();
  
  // Normalize emails for comparison
  const normalizedEmails = emails.map(e => e.toLowerCase());
  
  for (let i = 0; i < normalizedEmails.length; i += BATCH_SIZE) {
    const batch = normalizedEmails.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`[CSV Import] Profiles batch ${batchNum}, size: ${batch.length}`);
    
    try {
      // Query by email (using IN operator which is more efficient)
      const { data: emailData, error: emailError } = await supabase
        .from("profiles")
        .select("email, tg_email")
        .in("email", batch);
      
      if (emailError) {
        console.error('[CSV Import] Error fetching profiles by email:', emailError);
      } else {
        console.log(`[CSV Import] Profiles batch ${batchNum} (email) result: ${emailData?.length || 0} records`);
        emailData?.forEach(p => {
          if (p.email) allEmails.add(p.email.toLowerCase());
          if (p.tg_email) allEmails.add(p.tg_email.toLowerCase());
        });
      }
      
      // Also query by tg_email
      const { data: tgData, error: tgError } = await supabase
        .from("profiles")
        .select("email, tg_email")
        .in("tg_email", batch);
      
      if (tgError) {
        console.error('[CSV Import] Error fetching profiles by tg_email:', tgError);
      } else {
        console.log(`[CSV Import] Profiles batch ${batchNum} (tg_email) result: ${tgData?.length || 0} records`);
        tgData?.forEach(p => {
          if (p.email) allEmails.add(p.email.toLowerCase());
          if (p.tg_email) allEmails.add(p.tg_email.toLowerCase());
        });
      }
    } catch (err) {
      console.error('[CSV Import] Exception in profiles batch:', err);
    }
  }
  
  console.log('[CSV Import] fetchExistingProfilesInBatches complete, found:', allEmails.size);
  return allEmails;
};
```

---

## Por qué funciona mejor

| Aspecto | Antes | Después |
|---------|-------|---------|
| Operador | `or` con `ilike` | `in` (igualdad exacta) |
| Condiciones por batch | 400 (2 × 200) | 2 queries separadas |
| Tamaño URL | Muy largo | Moderado |
| Eficiencia SQL | Baja (ILIKE es lento) | Alta (IN usa índices) |
| Manejo de errores | Ninguno | Try-catch con logs |

---

## Nota sobre Case Sensitivity

El operador `in` es case-sensitive en PostgreSQL. Por eso:
1. Normalizamos los emails del CSV a minúsculas
2. Esto funcionará si los emails en la BD ya están normalizados
3. Si hay emails con mayúsculas en la BD, podríamos usar una función SQL adicional, pero en la mayoría de casos los emails se guardan en minúsculas

---

## Resultado Esperado

1. Las consultas se ejecutarán mucho más rápido
2. No habrá timeouts ni errores silenciosos
3. El proceso de importación avanzará al paso de preview correctamente

