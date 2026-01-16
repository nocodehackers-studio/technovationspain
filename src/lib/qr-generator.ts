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

export function generateRegistrationNumber(): string {
  // Format: TGM-YYYY-XXXXXXXX (year + unique alphanumeric)
  // Using timestamp + random to avoid collisions
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase(); // Base36 timestamp
  const random = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 random chars
  const uniquePart = (timestamp + random).slice(-8); // Take last 8 characters
  return `TGM-${year}-${uniquePart}`;
}
