

# Plan: Gestión de Hubs y Selección en Registro

## Resumen

Implementar la funcionalidad completa de Hubs:
1. **Creación manual** desde el panel de administración (ya existente)
2. **Selección opcional de Hub** durante el onboarding de usuarios
3. Permitir dejarlo en blanco si el usuario no conoce su hub

## Situación Actual

- **Tabla `hubs`**: Vacía - necesita datos
- **Admin de Hubs**: Funcional - permite crear, editar, eliminar
- **Onboarding**: No incluye selector de Hub
- **`hub_id` en profiles**: Campo nullable, listo para usar

## Cambios a Implementar

### 1. Modificar `src/pages/Onboarding.tsx`

Añadir un selector de Hub en el **Paso 2** (Información adicional):

```text
┌─────────────────────────────────────────────────────────────────┐
│  Información adicional                                          │
│  ────────────────────────────────────────────────────────────── │
│                                                                 │
│  Email en Technovation Global                                   │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ 📧 email@technovation.org                           │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─ Nuevo campo ─────────────────────────────────────────────┐ │
│  │  Hub Regional (opcional)                                   │ │
│  │  ┌───────────────────────────────────────────────────┐    │ │
│  │  │ 🏢 Selecciona tu hub...                        ▼ │    │ │
│  │  └───────────────────────────────────────────────────┘    │ │
│  │  Si no conoces tu hub, puedes dejarlo en blanco.          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Teléfono                    Código postal                      │
│  ┌────────────────────┐     ┌────────────────────┐             │
│  │ +34 600 000 000    │     │ 28001              │             │
│  └────────────────────┘     └────────────────────┘             │
│                                                                 │
│            [◀ Atrás]        [Completar registro ▶]             │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Lógica del Selector de Hub

```typescript
// Añadir al estado del formulario
const [formData, setFormData] = useState<OnboardingData>({
  // ... campos existentes
  hub_id: '', // Nuevo campo
});

// Query para cargar hubs disponibles
const { data: hubs } = useQuery({
  queryKey: ["available-hubs"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("hubs")
      .select("id, name, location")
      .order("name", { ascending: true });
    if (error) throw error;
    return data;
  },
});

// Incluir en el profileUpdate
const profileUpdate = {
  // ... otros campos
  hub_id: formData.hub_id || null, // null si está vacío
};
```

### 3. Componente Select para Hub

```typescript
<div className="space-y-2">
  <Label htmlFor="hub_id">Hub Regional (opcional)</Label>
  <div className="relative">
    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    <select
      id="hub_id"
      value={formData.hub_id}
      onChange={(e) => updateField('hub_id', e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer"
    >
      <option value="">Selecciona tu hub...</option>
      {hubs?.map((hub) => (
        <option key={hub.id} value={hub.id}>
          {hub.name} {hub.location ? `(${hub.location})` : ''}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
  </div>
  <p className="text-xs text-muted-foreground">
    Si no conoces tu hub, puedes dejarlo en blanco. 
    Tu mentor o el admin puede asignártelo después.
  </p>
</div>
```

### 4. Actualización del Tipo OnboardingData

```typescript
type OnboardingData = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  role: AllowedRole;
  tg_email: string;
  phone: string;
  postal_code: string;
  hub_id: string; // Nuevo campo
};
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Onboarding.tsx` | Añadir selector de Hub en paso 2 |

## Sobre la Creación de Hubs

### Opción Recomendada: Creación Manual

Ya tienes el panel en **Admin → Hubs** funcionando. Para cada hub necesitas:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Nombre** | Nombre identificativo del hub | "Hub Madrid Norte" |
| **Organización** | Empresa/institución que lo aloja | "Banco Santander" |
| **Ubicación** | Ciudad o zona | "Madrid" |

### Lista de Hubs Sugerida (basada en Technovation España)

Podrías crear hubs como:
- Hub Madrid
- Hub Barcelona  
- Hub Valencia
- Hub Sevilla
- Hub Bilbao
- Hub Málaga
- Hub Zaragoza
- (otros según vuestra estructura)

## Flujo de Usuario Final

```text
Usuario se registra
       │
       ▼
   Onboarding
       │
       ▼
┌──────────────────┐
│ Paso 1: Datos    │
│ - Nombre         │
│ - Apellidos      │
│ - Fecha nac.     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Paso 2: Info     │
│ - Email TG       │
│ - Hub (opcional) │◄── NUEVO
│ - Teléfono       │
│ - Código postal  │
└────────┬─────────┘
         │
         ▼
    Registro completo
```

## Beneficios

1. **Flexibilidad**: El hub es opcional, no bloquea el registro
2. **Asignación posterior**: Admins pueden asignar hubs después desde el panel de usuarios
3. **Autoservicio**: Usuarios que conocen su hub pueden seleccionarlo directamente
4. **Datos organizados**: Facilita filtrar participantes por zona geográfica

