
# Plan: Actualizar Modal de Consentimiento con Texto Legal Completo

## Resumen

Reemplazar el texto de consentimiento actual en el modal `ConsentModal.tsx` con el texto legal completo de RGPD proporcionado, formateado con dos tablas de información estructurada similar al diseño mostrado en la imagen de referencia.

---

## Cambios Detallados

### Archivo: `src/components/events/ConsentModal.tsx`

#### 1. Ampliar el ancho del modal

El contenido legal es extenso, por lo que necesitamos un modal más ancho:

```tsx
// Cambiar de:
<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">

// A:
<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
```

#### 2. Reemplazar el contenido del consentimiento

Sustituir el bloque actual (líneas 86-98) con el texto legal completo estructurado:

**Estructura del nuevo contenido:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ AVISO LEGAL PARA LA RECOGIDA DE DATOS DE CARÁCTER PERSONAL     │
│ (título centrado en negrita)                                    │
├─────────────────────────────────────────────────────────────────┤
│ Nombre y apellidos del Titular: [participantName dinámico]     │
├─────────────────────────────────────────────────────────────────┤
│ Párrafo introductorio sobre Asociación Power to Code           │
│ (NIF G-88095351, domicilio, etc.)                               │
├─────────────────────────────────────────────────────────────────┤
│ Párrafo: "De acuerdo con la actual legislación..."             │
├─────────────────────────────────────────────────────────────────┤
│           Información sobre protección de datos                 │
│ ┌──────────────────────────┬───────────────────────────────────┐│
│ │ Responsable del         │ Asociación Power to Code          ││
│ │ tratamiento             │                                   ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Finalidad del           │ Gestionar participación...        ││
│ │ Tratamiento             │ cesión derechos imagen (*)        ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Legitimación            │ Consentimiento del Titular        ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Cesiones                │ No se realizan cesiones...        ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Derechos                │ A retirar consentimiento...       ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Transferencias          │ No se realizarán...               ││
│ │ Internacionales         │                                   ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Información adicional   │ [enlace a política privacidad]    ││
│ └──────────────────────────┴───────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│     (*) Información específica sobre tratamiento de imágenes    │
│ ┌──────────────────────────┬───────────────────────────────────┐│
│ │ Responsable             │ Universidad Carlos III...         ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Soportes                │ Fotografías, vídeos...            ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Ámbito de Utilización   │ No se circunscribe...             ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Cesiones                │ Exclusivamente social...          ││
│ ├──────────────────────────┼───────────────────────────────────┤│
│ │ Términos de la cesión   │ El Titular acepta...              ││
│ └──────────────────────────┴───────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ Párrafo final sobre responsabilidad del tutor                  │
├─────────────────────────────────────────────────────────────────┤
│ Nombre del Padre/Madre o Tutor: [campo signature dinámico]     │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Implementación con componentes Tailwind

Se usará una estructura de tabla HTML con clases Tailwind para el formato visual:

- **Título**: `<h3 className="text-center font-bold text-base mb-4">`
- **Tablas de información**: Usando `<table>` con:
  - Primera columna (`th`): fondo gris claro, texto en negrita, ancho fijo
  - Segunda columna (`td`): texto normal
  - Bordes sutiles entre filas
- **Enlaces**: Color primario con hover underline
- **Campos dinámicos**: `{participantName}` y `{signature}` mostrados en negrita

#### 4. Actualizar las etiquetas de los campos

- Cambiar "DNI/NIE *" por usar el valor dinámico en el texto legal
- Actualizar el placeholder del campo de firma para reflejar "Padre/Madre o Tutor legal"

---

## Código de las tablas (estructura aproximada)

```tsx
<div className="space-y-4 text-sm">
  {/* Título principal */}
  <h3 className="text-center font-bold uppercase">
    Aviso Legal para la Recogida de Datos de Carácter Personal
  </h3>
  
  {/* Nombre del titular */}
  <p>
    <strong>Nombre y apellidos del Titular:</strong> {participantName}
  </p>
  
  {/* Párrafos introductorios */}
  <p className="text-muted-foreground">
    Asociación Power to Code con NIF G-88095351...
  </p>
  
  {/* Tabla 1: Información sobre protección de datos */}
  <h4 className="text-center font-semibold">
    Información sobre protección de datos
  </h4>
  <table className="w-full border text-sm">
    <tbody>
      <tr className="border-b">
        <th className="w-1/3 p-2 bg-muted text-left font-semibold align-top">
          Responsable del tratamiento
        </th>
        <td className="p-2">Asociación Power to Code</td>
      </tr>
      {/* ... más filas ... */}
    </tbody>
  </table>
  
  {/* Tabla 2: Información sobre imágenes */}
  <h4 className="text-center font-semibold">
    (*) Información específica sobre el tratamiento de imágenes
  </h4>
  <table className="w-full border text-sm">
    {/* ... filas de la tabla ... */}
  </table>
  
  {/* Párrafos finales */}
  <p className="text-muted-foreground">
    El padre/madre o tutor legal del Titular...
  </p>
</div>
```

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/events/ConsentModal.tsx` | Reemplazar texto de consentimiento con el formato legal completo |

---

## Consideraciones

- El modal será más largo, pero ya tiene scroll habilitado (`overflow-y-auto`)
- Se aumenta el ancho a `max-w-3xl` para acomodar las tablas
- Los campos dinámicos (`participantName`, `signature`) se muestran en los lugares apropiados del texto legal
- El enlace a la política de privacidad abrirá en nueva pestaña
- Se mantiene la funcionalidad existente de validación de DNI y firma
