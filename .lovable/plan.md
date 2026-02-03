

## Plan: Corregir Detección de Conflictos en Importación CSV

### Problema Identificado

Al importar un CSV de 3,678 registros, el sistema ignoró todas las filas sin mostrar conflictos porque:

1. **La consulta `.in("email", uniqueEmails)` falla con listas de ~3,500+ emails** - Supabase/PostgreSQL tiene límites en el número de elementos
2. Al no detectar duplicados, el sistema intentó INSERT que falló por violación de unicidad
3. Estos fallos se contabilizaron silenciosamente como `skipped`

---

### Datos Actuales

| Métrica | Valor |
|---------|-------|
| Registros en `authorized_users` | 3,693 |
| Registros en CSV | 3,678 |
| Registros procesados (log) | 3,678 |
| Nuevos insertados | 0 |
| Actualizados | 0 |
| **Resultado** | Todos ignorados silenciosamente |

---

### Cambios a Realizar

#### 1. Procesar detección de conflictos en lotes

Dividir la consulta de emails existentes en lotes de 500 elementos para evitar límites de PostgreSQL:

```text
Antes:
┌─────────────────────────────────────────────────┐
│ .in("email", [3678 emails])  → FALLA/TIMEOUT   │
└─────────────────────────────────────────────────┘

Después:
┌─────────────────────────────────────────────────┐
│ Lote 1: .in("email", [500 emails]) → OK        │
│ Lote 2: .in("email", [500 emails]) → OK        │
│ ...                                             │
│ Lote 8: .in("email", [178 emails]) → OK        │
└─────────────────────────────────────────────────┘
```

#### 2. Mejorar feedback cuando todos los registros ya existen

Mostrar mensaje claro cuando el CSV contiene registros que ya están en la whitelist:

```text
┌─────────────────────────────────────────────────────────┐
│ ℹ️  Todos los registros ya existen                      │
│                                                         │
│ Los 3,678 registros de este CSV ya están en la         │
│ lista de autorizados.                                   │
│                                                         │
│ [Actualizar datos existentes]  [Cancelar]               │
└─────────────────────────────────────────────────────────┘
```

#### 3. Añadir opción de "Actualizar todos" para reimportaciones

Cuando se detecten muchos conflictos de whitelist, ofrecer un botón para actualizar todos los registros de una vez.

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/AdminImportUnified.tsx` | Procesar emails en lotes de 500 para detección de conflictos |
| `src/components/admin/import/ConflictResolver.tsx` | Añadir opción "Actualizar todos" cuando hay muchos conflictos |

---

### Sección Técnica

#### Detección de Conflictos en Lotes

```typescript
// Función helper para procesar en lotes
async function fetchExistingAuthorizedInBatches(emails: string[]) {
  const BATCH_SIZE = 500;
  const allResults: AuthorizedUser[] = [];
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const { data } = await supabase
      .from("authorized_users")
      .select("id, email, matched_profile_id, first_name, last_name")
      .in("email", batch);
    
    if (data) {
      allResults.push(...data);
    }
  }
  
  return allResults;
}

// En processCSVData:
const existingAuthorized = await fetchExistingAuthorizedInBatches(uniqueEmails);
const authorizedMap = new Map(
  existingAuthorized.map(a => [a.email.toLowerCase(), a])
);
```

#### Detección Optimizada de Perfiles Existentes

```typescript
// También procesar profiles en lotes
async function fetchExistingProfilesInBatches(emails: string[]) {
  const BATCH_SIZE = 200; // Menor por la complejidad del OR
  const allEmails = new Set<string>();
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const { data } = await supabase
      .from("profiles")
      .select("email, tg_email")
      .or(batch.map(e => `email.ilike.${e},tg_email.ilike.${e}`).join(","));
    
    if (data) {
      data.forEach(p => {
        if (p.email) allEmails.add(p.email.toLowerCase());
        if (p.tg_email) allEmails.add(p.tg_email.toLowerCase());
      });
    }
  }
  
  return allEmails;
}
```

#### UI para "Actualizar Todos"

```typescript
// En ConflictResolver cuando hay muchos conflictos de whitelist
{whitelistConflicts.length > 100 && (
  <Alert>
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Muchos registros ya existen</AlertTitle>
    <AlertDescription className="flex items-center justify-between">
      <span>
        {whitelistConflicts.length} registros ya están en la whitelist.
      </span>
      <Button 
        variant="outline" 
        onClick={() => onSelectAllUpdate()}
      >
        Actualizar todos
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

### Resumen de Cambios

| Problema | Solución |
|----------|----------|
| `.in()` falla con +3000 emails | Procesar en lotes de 500 |
| Errores de INSERT silenciosos | Detectar duplicados antes de intentar INSERT |
| No hay opción de actualizar masivo | Añadir botón "Actualizar todos" |
| Feedback confuso | Mensaje claro cuando todo ya existe |

