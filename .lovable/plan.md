
# Plan: Actualizar ConsentModal con el Texto Legal del Evento Intermedio

## Resumen

Reemplazar el contenido legal del modal de consentimiento (`ConsentModal.tsx`) para que coincida exactamente con el HTML proporcionado, incluyendo:
- Añadir la edad del participante junto al nombre
- Actualizar el texto de legislación que diferencia mayores/menores de 14 años
- Cambiar la tabla de imágenes para que solo mencione Power to Code (sin UC3M)
- Añadir el párrafo final específico del evento intermedio con fecha y ubicación
- Actualizar las etiquetas de los campos de firma

---

## Cambios Detallados en `src/components/events/ConsentModal.tsx`

### 1. Añadir prop para la edad del participante

```typescript
interface ConsentModalProps {
  // ... props existentes
  participantAge?: number;  // Nueva prop
}
```

### 2. Actualizar el nombre del titular (línea 79-82)

**Antes:**
```tsx
<p>
  <strong>Nombre y apellidos del Titular:</strong> {participantName}
</p>
```

**Después:**
```tsx
<p>
  <strong>Nombre y apellidos del Titular:</strong>{' '}
  <span className="text-primary font-semibold">{participantName}</span>
  {participantAge !== undefined && (
    <> de <span className="text-primary font-semibold">{participantAge}</span> años</>
  )}
</p>
```

### 3. Actualizar el párrafo de legislación (línea 89-91)

**Después:**
```tsx
<p className="text-muted-foreground leading-relaxed">
  De acuerdo con la actual legislación, el Titular queda informado y, si es mayor de 14 años, 
  otorga su consentimiento expreso para el tratamiento de sus datos personales con la finalidad 
  descrita a continuación. Si el Titular es menor de 14 años, dicho consentimiento expreso es 
  otorgado por su padre, madre o tutor legal.
</p>
```

### 4. Actualizar Tabla 2 - Responsable de imágenes (líneas 166-172)

**Antes:** Universidad Carlos III de Madrid (UC3M)...

**Después:**
```tsx
<td className="p-3">
  Asociación Power to Code con NIF G-88095351 (en adelante "Power to Code") 
  y domicilio en Plaza de Segovia 5, 28600, Navalcarnero, Madrid
</td>
```

### 5. Actualizar Tabla 2 - Soportes (líneas 177-179)

**Antes:** ...en el marco de los proyectos de Power to Code y la UC3M

**Después:**
```tsx
<td className="p-3">
  Fotografías, vídeos, vídeos con voz, material gráfico, etc., o parte de las mismas 
  en las que interviene o ha intervenido el Titular en el marco de los proyectos de Power to Code
</td>
```

### 6. Actualizar Tabla 2 - Ámbito de Utilización (líneas 185-187)

**Antes:** ...UC3M y Power to Code podrá utilizar...

**Después:**
```tsx
<td className="p-3">
  No se circunscribe a un ámbito temporal o territorial determinados, por lo que Power to Code 
  podrá utilizar estas Imágenes, o parte de las mismas, en todos los países del mundo sin 
  limitación geográfica de ninguna clase y con la máxima extensión temporal permitida en la 
  legislación vigente.
</td>
```

### 7. Actualizar Tabla 2 - Cesiones (líneas 193-197)

**Antes:** UC3M y Power to Code podrá ceder...

**Después:**
```tsx
<td className="p-3">
  Exclusivamente con carácter social y nunca comercial, Power to Code podrá ceder a terceros, 
  tales como entidades colaboradoras o patrocinadores, las imágenes, o parte de las mismas, 
  en las que el Titular aparece como modelo, entrevistado, narrador o participante principal 
  o secundario en el ámbito (sea cual fuere el medio de comunicación interno o externo) 
  y finalidades de los proyectos de Power to Code.
  <br /><br />
  El objeto de la cesión será la promoción de las actividades de Power to Code, en medios de 
  comunicación internos o externos a la misma, para que puedan ser difundidas en todos los 
  medios de comunicación conocidos en la actualidad incluidos los online (Youtube, Linkedin, 
  Instagram, Tik Tok Facebook, etc), streaming y los que pudieran desarrollarse en el futuro. 
  Todo ello con la única salvedad y limitación de aquellas utilizaciones o aplicaciones que 
  pudieran atentar al derecho al honor, a la moral y/o al orden público, en los términos 
  previstos en la legislación vigente en cada país.
</td>
```

### 8. Actualizar párrafos finales (líneas 211-216)

**Después:**
```tsx
<p className="text-muted-foreground leading-relaxed mt-4">
  El padre/madre o tutor legal del Titular, o el Titular, cuyo nombre y apellidos figuran 
  a continuación, será el único responsable de la veracidad y exactitud de los datos 
  facilitados a Power to Code.
</p>
<p className="text-muted-foreground leading-relaxed">
  El padre, madre o tutor legal del Titular, o el Titular, declara que ha leído, entiende 
  y autoriza expresamente el tratamiento de sus datos de carácter personal al sacar una 
  entrada para el evento <strong>{eventName}</strong> que se celebrará el{' '}
  <strong>{eventDate}</strong> y que cancela su entrada en caso de no autorizar el mencionado 
  tratamiento de sus datos de carácter personal.
</p>
```

### 9. Actualizar etiqueta del campo de firma (línea 237)

**Antes:** Nombre y apellidos del Padre/Madre o Tutor legal *

**Después:**
```tsx
<Label htmlFor="consent-signature">
  Nombre y apellidos del Padre/Madre o Tutor legal (o del Titular para mayores de 14 años) *
</Label>
```

---

## Resumen de cambios de texto

| Sección | Antes | Después |
|---------|-------|---------|
| Nombre titular | Solo nombre | Nombre + edad en años |
| Párrafo legislación | "con consentimiento de su padre..." | Texto exacto con diferenciación mayor/menor 14 años |
| Tabla 2 - Responsable | UC3M | Power to Code únicamente |
| Tabla 2 - Soportes | Menciona UC3M | Solo Power to Code |
| Tabla 2 - Ámbito | UC3M y Power to Code | Solo Power to Code |
| Tabla 2 - Cesiones | UC3M y Power to Code | Solo Power to Code |
| Párrafo final | Genérico | Incluye nombre evento y fecha, más opción de "o el Titular" |
| Etiqueta firma | Solo tutor | Incluye "(o del Titular para mayores de 14 años)" |

---

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/events/ConsentModal.tsx` | Actualizar texto legal completo según HTML proporcionado |

---

## Consideraciones Técnicas

- Se necesitará pasar la edad del participante como prop desde `EventRegistrationPage.tsx`
- El `eventName` y `eventDate` ya están disponibles como props
- El texto hace referencia específica al evento intermedio, pero usamos props dinámicos para que funcione con cualquier evento
