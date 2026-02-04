

## Plan: Corregir Navegación "Atrás" en Páginas de Talleres

### Problema
Actualmente, cuando navegas desde `/admin/workshops` a un evento específico (como "Encuentro Equipos Technovation") y entras en sus talleres, el botón de "atrás" te lleva a `/admin/events/${eventId}/edit` (editor del evento) en lugar de volver a `/admin/workshops`.

Lo mismo ocurre en las sub-páginas de talleres (Estado Preferencias, Asignar, Cuadrante).

### Solución

Cambiar el destino del botón "atrás" en 4 archivos:

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `AdminWorkshops.tsx` | 371 | `/admin/events/${eventId}/edit` → `/admin/workshops` |
| `AdminWorkshopPreferences.tsx` | 100 | `/admin/events/${eventId}/edit` → `/admin/workshops` |
| `AdminWorkshopSchedule.tsx` | 145 | `/admin/events/${eventId}/edit` → `/admin/workshops` |
| `AdminWorkshopAssignment.tsx` | 149 | `/admin/events/${eventId}/edit` → `/admin/workshops` |

### Flujo de navegación corregido

```text
/admin/workshops (lista de eventos con talleres)
    │
    ├── Click en evento "Encuentro Equipos" 
    │       ↓
    │   /admin/workshops (con eventId seleccionado - muestra talleres del evento)
    │       │
    │       ├── [←] Vuelve a lista de eventos en /admin/workshops ✓
    │       │
    │       ├── Click "Estado Preferencias"
    │       │       ↓
    │       │   /admin/events/{id}/workshops/preferences
    │       │       [←] Vuelve a /admin/workshops ✓
    │       │
    │       ├── Click "Asignar"  
    │       │       ↓
    │       │   /admin/events/{id}/workshops/assign
    │       │       [←] Vuelve a /admin/workshops ✓
    │       │
    │       └── Click "Cuadrante"
    │               ↓
    │           /admin/events/{id}/workshops/schedule
    │               [←] Vuelve a /admin/workshops ✓
```

### Archivos a modificar

1. **`src/pages/admin/AdminWorkshops.tsx`** - Línea 371
2. **`src/pages/admin/AdminWorkshopPreferences.tsx`** - Línea 100
3. **`src/pages/admin/AdminWorkshopSchedule.tsx`** - Línea 145
4. **`src/pages/admin/AdminWorkshopAssignment.tsx`** - Línea 149

