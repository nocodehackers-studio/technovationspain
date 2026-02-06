/**
 * Calculate age at a given reference date (defaults to today).
 * Uses UTC to avoid timezone-dependent off-by-one errors.
 * Returns -1 if birthDate is null/undefined/empty (caller should treat as minor).
 */
export function calculateAge(birthDate: string | null | undefined, referenceDate?: string): number {
  if (!birthDate) return -1;
  const birth = new Date(birthDate);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

/**
 * Check if a person is currently a minor (≤13).
 * Returns true if birthDate is null/missing (safest default).
 * Used at registration time to determine consent flow and in onboarding.
 */
export function isMinor(birthDate: string | null | undefined): boolean {
  return calculateAge(birthDate) <= 13;
}
