
# Plan: Export de Vista Configurada de Usuarios

## Resumen

Implementar la funcionalidad de exportar solo las columnas visibles y datos filtrados de la tabla de usuarios, respetando la configuración actual de la vista del administrador.

---

## Comportamiento Actual vs Propuesto

| Aspecto | Actual | Propuesto |
|---------|--------|-----------|
| Exportar | No implementado (toast) | CSV con datos filtrados |
| Columnas | N/A | Solo columnas visibles |
| Filtros | N/A | Respeta búsqueda global y filtros de columna |
| Datos | N/A | Solo filas que pasan los filtros |

---

## Cambios Necesarios

### 1. Modificar AirtableDataTable

Cambiar la firma del callback `onExport` para pasar contexto sobre la vista actual:

```typescript
// Antes
onExport?: () => void;

// Después
onExport?: (exportData: {
  rows: TData[];
  visibleColumns: { id: string; header: string }[];
}) => void;
```

El componente pasara:
- `table.getFilteredRowModel().rows` - filas filtradas
- `table.getVisibleLeafColumns()` - columnas visibles con sus headers

### 2. Implementar Lógica de Export en AdminUsers

Crear una función que:
1. Reciba las filas filtradas y columnas visibles
2. Extraiga los valores de cada columna visible para cada fila
3. Genere CSV con UTF-8 BOM para compatibilidad con Excel
4. Descargue el archivo

---

## Mapeo de Columnas a Valores

El reto principal es extraer el valor correcto de cada columna, ya que algunas usan `accessorKey` y otras `accessorFn`:

| Columna | Accessor | Valor a Exportar |
|---------|----------|------------------|
| name | accessorFn | `first_name + last_name` |
| tg_id | accessorKey | `row.tg_id` |
| role | accessorKey | `row.role` |
| verification_status | accessorKey | `row.verification_status` |
| team_name | accessorKey | `row.team_name` |
| school_name | accessorKey | `row.school_name` |
| hub_name | accessorKey | `row.hub_name` |
| phone | accessorKey | `row.phone` |
| created_at | accessorKey | Fecha formateada |
| custom_* | accessorKey | `row.custom_fields[key]` |

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/AirtableDataTable.tsx` | Actualizar tipo de `onExport` y pasar datos |
| `src/pages/admin/AdminUsers.tsx` | Implementar handler de export con logica CSV |

---

## Implementacion Detallada

### AirtableDataTable.tsx

```typescript
interface AirtableDataTableProps<TData, TValue> {
  // ... existing props
  onExport?: (exportData: {
    rows: TData[];
    visibleColumns: { id: string; header: string }[];
  }) => void;
}

// En el boton de Export:
onClick={() => {
  const visibleColumns = table.getVisibleLeafColumns().map(col => ({
    id: col.id,
    header: typeof col.columnDef.header === 'string' 
      ? col.columnDef.header 
      : col.id,
  }));
  const rows = table.getFilteredRowModel().rows.map(row => row.original);
  onExport?.({ rows, visibleColumns });
}}
```

### AdminUsers.tsx - Funcion de Export

```typescript
const handleExport = useCallback((exportData: {
  rows: UserWithRole[];
  visibleColumns: { id: string; header: string }[];
}) => {
  const { rows, visibleColumns } = exportData;
  
  if (rows.length === 0) {
    toast.error("No hay datos para exportar");
    return;
  }

  // Mapear columna ID a extractor de valor
  const getColumnValue = (row: UserWithRole, colId: string): string => {
    switch (colId) {
      case "name":
        return `${row.first_name || ""} ${row.last_name || ""}`.trim();
      case "tg_id":
        return row.tg_id || "";
      case "role":
        return row.role || "";
      // ... resto de columnas
      default:
        if (colId.startsWith("custom_")) {
          const key = colId.replace("custom_", "");
          return (row.custom_fields?.[key] as string) || "";
        }
        return "";
    }
  };

  // Generar CSV
  const headers = visibleColumns.map(c => c.header);
  const csvRows = [
    headers.join(","),
    ...rows.map(row =>
      visibleColumns.map(col => {
        const val = getColumnValue(row, col.id);
        // Escapar valores con comas/comillas
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",")
    ),
  ];

  // Descargar
  const blob = new Blob(["\ufeff" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `usuarios_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  toast.success(`Exportados ${rows.length} usuarios`);
}, []);
```

---

## Flujo de Usuario

1. Admin configura la vista:
   - Oculta columnas no necesarias via "Columnas"
   - Aplica filtros (Estado: Pendiente, Rol: Mentor)
   - Busca texto especifico

2. Hace clic en "Exportar"

3. Se descarga CSV con:
   - Solo las columnas visibles como headers
   - Solo las filas que coinciden con filtros/busqueda
   - Valores formateados correctamente

---

## Ejemplo de Salida

Si el admin tiene visible solo: Nombre, Email, Estado, Equipo
Y filtro: Estado = "verified"

```csv
Nombre,Email,Estado,Equipo
"Juan Perez",juan@example.com,verified,Equipo Alpha
"Maria Garcia",maria@example.com,verified,Equipo Beta
```

---

## Consideraciones

- **UTF-8 BOM**: Incluir `\ufeff` al inicio para que Excel interprete correctamente caracteres especiales
- **Escapado**: Valores con comas, comillas o saltos de linea se envuelven en comillas
- **Fechas**: Formatear en formato local (DD/MM/YYYY)
- **Campos vacios**: Exportar como cadena vacia, no "null" o "undefined"
