
# Plan: Corregir Generación de QR en Edge Function

## Problema

Los logs muestran que la función falla al generar el QR:
```
INFO: Generating QR code...
ERROR: You need to specify a canvas element
```

La librería `qrcode` importada desde `esm.sh` intenta usar Canvas del navegador, que no existe en Deno.

## Cambios a Realizar

### supabase/functions/send-registration-confirmation/index.ts

**Cambio 1 - Línea 3 (Importación):**
```typescript
// ANTES:
import QRCode from "https://esm.sh/qrcode@1.5.3";

// DESPUÉS:
import QRCode from "npm:qrcode@1.5.3";
```

**Cambio 2 - Líneas 50-66 (Función generateQRCode):**
```typescript
// ANTES:
async function generateQRCode(url: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "H",
  });
  
  const base64Data = dataUrl.split(",")[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// DESPUÉS:
async function generateQRCode(url: string): Promise<Uint8Array> {
  // Usar toBuffer que funciona en Node/Deno sin Canvas del navegador
  const buffer = await QRCode.toBuffer(url, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "H",
    type: "png",
  });
  
  return new Uint8Array(buffer);
}
```

## Por Qué Funciona

| Aspecto | esm.sh | npm: |
|---------|--------|------|
| Entorno | Navegador | Node.js/Deno |
| Canvas | Requiere DOM | Usa node-canvas nativo |
| toBuffer() | No disponible | Genera PNG directamente |

## Resultado Esperado

Después del despliegue, los logs mostrarán:
1. "Generating QR code..."
2. "QR image URL: https://..."
3. "Email sent successfully"

Y el email llegará con el código QR visible.
