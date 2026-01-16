export function generateQRCode(): string {
  // Generates a unique code for the QR
  // Format: TGM-{year}-{random alphanumeric}
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shortCode = '';
  for (let i = 0; i < 8; i++) {
    shortCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TGM-${year}-${shortCode}`;
}

export function generateRegistrationNumber(count: number): string {
  // Format: TGM-2025-00001
  const year = new Date().getFullYear();
  const paddedCount = String(count).padStart(5, '0');
  return `TGM-${year}-${paddedCount}`;
}
