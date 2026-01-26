
# Plan: Exportación CSV de Datos en Bruto

## Resumen

Añadir una nueva pestaña "Exportar" en la página de Reportes que permita a los administradores descargar datos completos de las principales tablas de la base de datos en formato CSV.

---

## Cambios a Realizar

### Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminReports.tsx` | Añadir pestaña "Exportar" con botones de descarga |

---

## Implementación

### 1. Añadir nueva pestaña en el TabsList

```tsx
<TabsTrigger value="export" className="gap-2">
  <Download className="h-4 w-4" />
  <span className="hidden sm:inline">Exportar</span>
</TabsTrigger>
```

### 2. Mejorar función exportToCSV

La función actual tiene un problema: no escapa correctamente valores que contienen comas o comillas. Se mejorará para manejar estos casos:

```typescript
const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    toast.error("No hay datos para exportar");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
          // Escape values with commas, quotes, or newlines
          if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n")) {
            return `"${strVal.replace(/"/g, '""')}"`;
          }
          return strVal;
        })
        .join(",")
    ),
  ];

  const blob = new Blob(["\ufeff" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  toast.success(`${filename} exportado correctamente`);
};
```

### 3. Crear función genérica para exportar tablas

```typescript
const exportTable = async (
  tableName: string,
  displayName: string,
  selectQuery?: string
) => {
  toast.loading(`Exportando ${displayName}...`, { id: "export" });

  const { data, error } = await supabase
    .from(tableName)
    .select(selectQuery || "*");

  toast.dismiss("export");

  if (error) {
    toast.error(`Error al exportar: ${error.message}`);
    return;
  }

  exportToCSV(data || [], displayName);
};
```

### 4. Crear función para exportar registros de evento

```typescript
const exportEventRegistrations = async () => {
  if (!selectedEventId) {
    toast.error("Selecciona un evento primero");
    return;
  }

  toast.loading("Exportando registros del evento...", { id: "export" });

  const { data, error } = await supabase
    .from("event_registrations")
    .select(`
      registration_number,
      first_name,
      last_name,
      email,
      phone,
      team_name,
      team_id_tg,
      tg_email,
      registration_status,
      checked_in_at,
      image_consent,
      data_consent,
      created_at,
      ticket_type:event_ticket_types(name)
    `)
    .eq("event_id", selectedEventId);

  toast.dismiss("export");

  if (error) {
    toast.error(`Error al exportar: ${error.message}`);
    return;
  }

  // Flatten nested ticket_type
  const flatData = data?.map((r) => ({
    ...r,
    ticket_type: r.ticket_type?.name || "",
  }));

  const eventName = events?.find((e) => e.id === selectedEventId)?.name || "evento";
  exportToCSV(flatData || [], `registros_${eventName.replace(/\s+/g, "_")}`);
};
```

### 5. Añadir contenido de la pestaña Exportar

```tsx
<TabsContent value="export" className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>Exportar Datos en Bruto</CardTitle>
      <CardDescription>
        Descarga los datos completos de la plataforma en formato CSV
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Usuarios */}
      <div className="space-y-2">
        <h3 className="font-medium">Usuarios</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="outline"
            onClick={() => exportTable("profiles", "usuarios")}
          >
            <Download className="mr-2 h-4 w-4" />
            Perfiles (profiles)
          </Button>
          <Button
            variant="outline"
            onClick={() => exportTable("user_roles", "roles_usuario")}
          >
            <Download className="mr-2 h-4 w-4" />
            Roles de Usuario
          </Button>
          <Button
            variant="outline"
            onClick={() => exportTable("authorized_students", "estudiantes_autorizados")}
          >
            <Download className="mr-2 h-4 w-4" />
            Estudiantes Autorizados
          </Button>
        </div>
      </div>

      {/* Equipos */}
      <div className="space-y-2">
        <h3 className="font-medium">Equipos</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="outline"
            onClick={() => exportTable("teams", "equipos")}
          >
            <Download className="mr-2 h-4 w-4" />
            Equipos (teams)
          </Button>
          <Button
            variant="outline"
            onClick={() => exportTable("team_members", "miembros_equipo")}
          >
            <Download className="mr-2 h-4 w-4" />
            Miembros de Equipo
          </Button>
        </div>
      </div>

      {/* Eventos */}
      <div className="space-y-2">
        <h3 className="font-medium">Eventos</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="outline"
            onClick={() => exportTable("events", "eventos")}
          >
            <Download className="mr-2 h-4 w-4" />
            Eventos
          </Button>
          <Button
            variant="outline"
            onClick={() => exportTable("event_registrations", "todos_registros_eventos")}
          >
            <Download className="mr-2 h-4 w-4" />
            Todos los Registros
          </Button>
          <Button
            variant="outline"
            onClick={() => exportTable("companions", "acompanantes")}
          >
            <Download className="mr-2 h-4 w-4" />
            Acompañantes
          </Button>
        </div>
      </div>

      {/* Evento específico */}
      <div className="space-y-2">
        <h3 className="font-medium">Registros por Evento</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Seleccionar evento" />
            </SelectTrigger>
            <SelectContent>
              {events?.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="default"
            onClick={exportEventRegistrations}
            disabled={!selectedEventId}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar Registros
          </Button>
        </div>
      </div>

      {/* Otros */}
      <div className="space-y-2">
        <h3 className="font-medium">Otros</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="outline"
            onClick={() => exportTable("hubs", "hubs")}
          >
            <Download className="mr-2 h-4 w-4" />
            Hubs
          </Button>
          <Button
            variant="outline"
            onClick={() => exportTable("audit_logs", "logs_auditoria")}
          >
            <Download className="mr-2 h-4 w-4" />
            Logs de Auditoría
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

---

## Tablas Disponibles para Exportar

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Datos de todos los usuarios |
| `user_roles` | Roles asignados a cada usuario |
| `authorized_students` | Whitelist de estudiantes autorizados |
| `teams` | Equipos registrados |
| `team_members` | Miembros de cada equipo |
| `events` | Lista de eventos |
| `event_registrations` | Registros a eventos (todos) |
| `companions` | Acompañantes de registros |
| `hubs` | Hubs/sedes |
| `audit_logs` | Logs de auditoría |

---

## Características de la Exportación

1. **Formato CSV con BOM UTF-8**: Incluye marca de orden de bytes para compatibilidad con Excel en español
2. **Escape de caracteres especiales**: Maneja comas, comillas y saltos de línea correctamente
3. **Fecha en nombre de archivo**: Añade fecha actual al nombre del archivo descargado
4. **Objetos JSON**: Serializa campos JSONB (como `custom_fields`) como strings
5. **Toast de progreso**: Muestra indicador mientras se descarga

---

## Flujo de Usuario

```text
1. Admin navega a Reportes
2. Selecciona la pestaña "Exportar"
3. Ve las categorías de datos disponibles
4. Hace clic en el botón de la tabla deseada
5. Se muestra toast de carga
6. Se descarga el archivo CSV automáticamente
7. Toast de éxito confirma la descarga
```

---

## Resumen de Cambios

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/AdminReports.tsx` | Nueva pestaña "Exportar", función `exportTable` mejorada, `exportEventRegistrations` para evento específico |

No se requieren cambios en la base de datos.
