/**
 * Clean and validate Spanish DNI/NIE format.
 * Normalizes input: trims, removes spaces/hyphens, uppercases.
 * @param value - The DNI/NIE string to validate
 * @param required - If true, empty values are invalid. If false, empty values pass.
 * @returns The cleaned, uppercase value if valid; null if invalid; '' if empty and not required.
 */
export function cleanAndValidateDNI(value: string, required: boolean = true): string | null {
  const cleaned = value?.trim().toUpperCase().replace(/[\s-]/g, '') || '';
  if (!cleaned) return required ? null : '';
  const dniRegex = /^[0-9]{8}[A-Z]$/;
  const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/;
  if (dniRegex.test(cleaned) || nieRegex.test(cleaned)) return cleaned;
  return null;
}

/**
 * Boolean validation helper (backwards-compatible with existing code).
 */
export function validateSpanishDNI(value: string, required: boolean = true): boolean {
  return cleanAndValidateDNI(value, required) !== null;
}
