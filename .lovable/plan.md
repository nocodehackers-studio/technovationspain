
# Plan: Incluir QR de Acompañantes en Email de Confirmación

## Resumen

Modificar la Edge Function `send-registration-confirmation` para que, si el registro tiene acompañantes, incluya sus códigos QR en el email de confirmación.

## Análisis de Datos

Los acompañantes se almacenan en la tabla `companions`:
- `event_registration_id` → ID del registro principal
- `first_name`, `last_name` → Nombre del acompañante
- `relationship` → Relación (mother, father, guardian, etc.)
- `qr_code` → Código QR único ya generado (ej: `TGM-2026-RJT50XB5`)

## Cambios en la Edge Function

### Archivo: `supabase/functions/send-registration-confirmation/index.ts`

#### 1. Añadir Query de Acompañantes (después de línea ~148)

```typescript
// Fetch companions for this registration
const { data: companions } = await supabase
  .from("companions")
  .select("*")
  .eq("event_registration_id", registrationId)
  .order("created_at");

console.log("Found companions:", companions?.length || 0);
```

#### 2. Generar QRs de Acompañantes (después de línea ~223)

```typescript
// Generate and upload companion QR codes
interface CompanionWithQR {
  first_name: string;
  last_name: string;
  relationship: string;
  qr_code: string;
  qr_image_url: string;
}

const companionQRs: CompanionWithQR[] = [];

if (companions && companions.length > 0) {
  console.log("Generating companion QR codes...");
  
  for (const companion of companions) {
    const companionValidateUrl = `https://technovationspain.lovable.app/validate/${companion.qr_code}`;
    const companionQrBuffer = await generateQRCode(companionValidateUrl);
    const companionQrFileName = `qr-codes/${companion.qr_code}.png`;
    
    await supabase.storage
      .from("Assets")
      .upload(companionQrFileName, companionQrBuffer, {
        contentType: "image/png",
        upsert: true,
      });
    
    const { data: companionUrlData } = supabase.storage
      .from("Assets")
      .getPublicUrl(companionQrFileName);
    
    companionQRs.push({
      first_name: companion.first_name,
      last_name: companion.last_name,
      relationship: companion.relationship || "",
      qr_code: companion.qr_code,
      qr_image_url: companionUrlData?.publicUrl || "",
    });
  }
  
  console.log("Generated", companionQRs.length, "companion QR codes");
}
```

#### 3. Generar HTML de Sección Acompañantes

```typescript
// Relationship labels
const relationshipLabels: Record<string, string> = {
  mother: "Madre",
  father: "Padre",
  guardian: "Tutor/a legal",
  grandparent: "Abuelo/a",
  sibling: "Hermano/a mayor",
  other: "Otro familiar",
};

// Generate companions HTML section
let companionsHtml = "";
if (companionQRs.length > 0) {
  const companionCards = companionQRs.map((c) => `
    <div style="display: inline-block; width: 48%; min-width: 200px; vertical-align: top; margin: 10px 1%; text-align: center; background-color: #f9fafb; border-radius: 8px; padding: 20px;">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Acompañante</p>
      <p style="font-weight: 600; color: #1f2937; margin: 0 0 5px 0;">${c.first_name} ${c.last_name}</p>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 15px 0;">${relationshipLabels[c.relationship] || c.relationship}</p>
      <img src="${c.qr_image_url}" alt="QR ${c.first_name}" style="width: 140px; height: 140px; display: block; margin: 0 auto;" />
      <p style="color: #7c3aed; font-size: 12px; font-family: monospace; margin: 10px 0 0 0;">${c.qr_code}</p>
    </div>
  `).join("");

  companionsHtml = `
    <!-- Companion QR Codes Section -->
    <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
      <h3 style="color: #1f2937; font-size: 18px; text-align: center; margin: 0 0 20px 0;">
        🎫 Entradas de Acompañantes (${companionQRs.length})
      </h3>
      <div style="text-align: center;">
        ${companionCards}
      </div>
    </div>
  `;
}
```

#### 4. Insertar en el Email HTML (antes del Important Note)

Añadir `${companionsHtml}` después de la sección del QR principal y antes del "Important Note".

#### 5. Actualizar Mensaje de Importante

Si hay acompañantes, el mensaje debe indicar que cada persona necesita su propio QR:

```typescript
const importantNote = companionQRs.length > 0
  ? `<strong>⚠️ Importante:</strong> Cada persona debe presentar su propio código QR en la entrada del evento. Los acompañantes también necesitan mostrar sus entradas individuales.`
  : `<strong>⚠️ Importante:</strong> Presenta el código QR de tu entrada en la entrada del evento para acceder. Puedes mostrarlo desde tu móvil o imprimirlo.`;
```

## Resultado Final del Email

```text
┌─────────────────────────────────────────┐
│  ¡Inscripción confirmada!               │
│  Technovation Girls España              │
├─────────────────────────────────────────┤
│                                         │
│  Hola {nombre}, ...                     │
│                                         │
│  ┌─────────────────────┐                │
│  │ Tu código QR:       │                │
│  │    [QR Principal]   │                │
│  │  TGM-2026-XXXXXX    │                │
│  └─────────────────────┘                │
│                                         │
│  [Ver mi entrada]                       │
│                                         │
│  ── Entradas de Acompañantes (2) ──     │
│                                         │
│  ┌─────────┐ ┌─────────┐                │
│  │ Padre   │ │ Madre   │                │
│  │ [QR 1]  │ │ [QR 2]  │                │
│  │ TGM-XXX │ │ TGM-XXX │                │
│  └─────────┘ └─────────┘                │
│                                         │
│  ⚠️ Importante: Cada persona debe       │
│  presentar su propio QR...              │
│                                         │
└─────────────────────────────────────────┘
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/send-registration-confirmation/index.ts` | Consultar acompañantes, generar sus QRs, añadir sección al email |
