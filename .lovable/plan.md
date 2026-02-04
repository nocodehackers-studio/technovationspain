
## Plan: Tabla Compacta de Talleres con Edición Modal

### Cambios a Realizar

**Archivo: `src/pages/admin/AdminWorkshops.tsx`**

#### 1. Tabla compacta de solo lectura (líneas 529-644)

Cambiar la tabla con inputs editables a una tabla de solo lectura más compacta:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Nombre              │ Empresa    │ Sala   │ Aforo │ Turnos   │ Acciones│
├────────────────────────────────────────────────────────────────────────┤
│ Ética e IA          │ Santander  │ Sala 1 │ 30    │ T1 T2 T3 │ ✏️ 🗑️  │
│ Comunicación        │ Repsol     │ Sala 2 │ 30    │ T1 T2 T3 │ ✏️ 🗑️  │
│ Diseño UX           │ GFT        │ Sala 3 │ 30    │ T1 T2    │ ✏️ 🗑️  │
│ ML 4 Kids           │ Verisure   │ Sala 4 │ 30    │ T2 T3    │ ✏️ 🗑️  │
└────────────────────────────────────────────────────────────────────────┘
```

Cambios en la tabla:
- Eliminar todos los `<Input>` y mostrar texto plano con `<span>`
- Usar `text-sm` para texto más compacto
- Padding reducido: `py-2 pr-3` en lugar de `py-3 pr-4`
- Mostrar "-" cuando no hay valor en campos opcionales
- Click en la fila completa abre el modal de edición (UX mejorada)

#### 2. Selector de turnos en el modal de edición (WorkshopForm)

Añadir al formulario existente (líneas 742-840) un campo de selección múltiple de turnos:

```text
┌──────────────────────────────────────────────────────┐
│                   Editar Taller                       │
├──────────────────────────────────────────────────────┤
│ Nombre del taller *    │ Empresa/Patrocinador        │
│ [Ética e IA_________]  │ [Santander____________]     │
│                                                       │
│ Sala/Ubicación         │ Aforo Máximo *              │
│ [Sala 1_____________]  │ [30____]                    │
│                                                       │
│ Categoría              │                             │
│ [General (todas)___▼]  │                             │
│                                                       │
│ Turnos en los que se imparte                         │
│ ┌─────────────────────────────────────────────┐     │
│ │ ☑ Turno 1 (10:30 - 11:15)                   │     │
│ │ ☑ Turno 2 (11:30 - 12:15)                   │     │
│ │ ☑ Turno 3 (12:30 - 13:00)                   │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ Descripción                                           │
│ [________________________________]                    │
│                                                       │
│                              [Actualizar]            │
└──────────────────────────────────────────────────────┘
```

### Cambios Técnicos

**1. Modificar la tabla (líneas 529-644)**

Reemplazar los inputs por texto plano:
- `<Input defaultValue={workshop.name} ...>` → `<span className="font-medium">{workshop.name}</span>`
- `<Input defaultValue={workshop.company} ...>` → `<span className="text-muted-foreground">{workshop.company || '-'}</span>`
- Igual para location y max_capacity
- Hacer la fila clickeable con `onClick={() => handleEditWorkshop(workshop)}`

**2. Ampliar WorkshopForm (líneas 742-840)**

- Añadir prop `timeSlots` para recibir los turnos disponibles
- Añadir estado local `selectedSlots` para los turnos seleccionados
- Añadir prop `workshopSlots` (turnos actuales del taller, por ahora todos)
- Renderizar checkboxes para cada turno con formato `Turno X (HH:MM - HH:MM)`

**3. Actualizar llamada a WorkshopForm (línea 675)**

Pasar las props adicionales:
```tsx
<WorkshopForm
  workshop={selectedWorkshop}
  timeSlots={timeSlots || []}
  onSubmit={(data) => { ... }}
  loading={...}
/>
```

### Nota sobre los turnos

Por ahora, todos los talleres se imparten en todos los turnos (modelo actual). El selector de turnos servirá como base para una futura funcionalidad donde cada taller pueda estar solo en ciertos turnos. Por ahora, mostraremos todos los turnos seleccionados por defecto y el campo será informativo/preparatorio.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/AdminWorkshops.tsx` | Tabla compacta sin inputs + selector turnos en modal |
