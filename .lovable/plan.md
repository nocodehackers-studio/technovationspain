
## Plan: Mostrar equipos en la matriz de ocupacion

### Que se va a hacer

Hacer que cada celda de la matriz de ocupacion sea expandible para ver los nombres de los equipos asignados. Al hacer clic en una celda (o con un tooltip/popover), se mostraran los equipos que estan en ese taller en ese turno.

### Propuesta de diseno

Cada celda de la matriz mantendra el indicador actual (semaforo + "3/20" + "2 equipos"), pero al hacer clic se abrira un **Popover** debajo mostrando la lista de equipos con su numero de participantes. Asi no se pierde la vista compacta pero tienes el detalle cuando lo necesitas.

```text
+---------------------+------------------+------------------+
| Taller              | Turno 1          | Turno 2          |
+---------------------+------------------+------------------+
| Diseno y Usabilidad |  [clic]          |                  |
|                     |  +-------------+ |                  |
|                     |  | Equipo A (4)|  |                  |
|                     |  | Equipo B (3)|  |                  |
|                     |  +-------------+ |                  |
+---------------------+------------------+------------------+
```

### Cambios

**`src/pages/admin/AdminWorkshopCapacity.tsx`:**

1. Importar `Popover`, `PopoverTrigger`, `PopoverContent` de los componentes UI
2. Modificar la query de assignments para incluir tambien el `teamId` en el objeto de occupancy (ahora solo guarda `teamName`), para poder mostrar el conteo de participantes por equipo
3. Cambiar la estructura de datos de `teams: string[]` a `teams: { name: string; participants: number }[]`
4. Envolver cada celda de la tabla en un `Popover`:
   - El trigger sera el indicador actual (semaforo + cifras) con cursor pointer
   - El content mostrara una lista con el nombre de cada equipo y su numero de participantes entre parentesis
   - Si no hay equipos, no se muestra popover
5. Anadir un indicador visual (cursor pointer, hover sutil) para que se entienda que la celda es clicable

### Resultado

- Vista compacta: misma matriz actual con semaforos y numeros
- Al hacer clic en cualquier celda: popover con la lista de equipos y participantes de cada uno
- Sin cambios en la estructura de la pagina ni navegacion adicional
