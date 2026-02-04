
## Plan: Simplificar Interfaz de Talleres

### Cambios a Realizar

**Archivo: `src/pages/admin/AdminWorkshops.tsx`**

#### 1. Eliminar elementos innecesarios
- **Stats Overview** (líneas 408-446): Eliminar las 3 cards de métricas (Turnos, Talleres, Aforo Total)
- **Sección "¿Cómo funciona?"** (líneas 448-464): Eliminar completamente

#### 2. Reordenar tabs
- Cambiar `defaultValue="slots"` a `defaultValue="workshops"`
- Mover la tab "Talleres" a primera posición
- Mover la tab "Turnos Horarios" a segunda posición

#### 3. Añadir badges de turnos en cada taller
En la card de cada taller, añadir badges visuales que muestren en qué turnos se imparte:

```text
┌─────────────────────────────────────────────────────────────┐
│ Ética e IA                                    [Edit][Delete]│
│ Santander                                                   │
├─────────────────────────────────────────────────────────────┤
│ 📍 Sala 1                                                   │
│                                                             │
│ Aforo: 30 personas                                          │
│ [████████████░░░░░░░] 60%                                   │
│                                                             │
│ [T1 10:30] [T2 11:30] [T3 12:30]  ← Badges de turnos       │
└─────────────────────────────────────────────────────────────┘
```

Como cada taller se realiza en TODOS los turnos simultáneamente (7 talleres × 3 turnos), mostraremos los turnos disponibles del evento.

### Resultado Visual Final

```text
┌─────────────────────────────────────────────────────────────┐
│ ← Talleres                                                  │
│   Evento Intermedio 2025                                    │
│                                                             │
│ [Estado Preferencias] [Asignar] [Cuadrante]                │
│                                                             │
│ [Talleres] [Turnos Horarios]  ← Tabs (Talleres primero)    │
│                                                             │
│ Talleres Disponibles                     [+ Añadir Taller] │
│ Estos talleres se realizan en cada turno                   │
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │Ética e IA   │ │Comunicación │ │ Diseño UX   │            │
│ │Santander    │ │Repsol       │ │ GFT         │            │
│ │📍 Sala 1    │ │📍 Sala 2    │ │📍 Sala 3    │            │
│ │30 personas  │ │30 personas  │ │30 personas  │            │
│ │[T1][T2][T3] │ │[T1][T2][T3] │ │[T1][T2][T3] │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Cambios Técnicos

| Líneas | Acción |
|--------|--------|
| 408-446 | Eliminar grid de stats cards |
| 448-464 | Eliminar sección "¿Cómo funciona?" |
| 467 | Cambiar `defaultValue="slots"` → `defaultValue="workshops"` |
| 469-476 | Intercambiar orden de TabsTrigger (Talleres primero) |
| 480-553 | Mover TabsContent de slots después de workshops |
| 613-637 | Añadir sección de badges de turnos en cada workshop card |

### Beneficios
- Interfaz más limpia y directa
- Los talleres son lo primero que ve el admin (lo más importante)
- Se visualiza claramente en qué turnos está cada taller
- Se elimina información redundante que no aporta valor
