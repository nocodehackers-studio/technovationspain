/**
 * Calculate age at a given reference date (defaults to today).
 * Uses UTC to avoid timezone-dependent off-by-one errors.
 * Returns -1 if birthDate is null/undefined/empty (caller should treat as minor).
 */
export function calculateAge(birthDate: string | null | undefined, referenceDate?: string): number {
  if (!birthDate) return -1;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return -1;
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

/**
 * Get the August 1st reference date for the current cycle.
 * The cycle runs August 1 → July 31. All age-driven legal decisions
 * (minor/adult, consent routing, parental fields) use this date.
 *
 * - Aug–Dec → August 1st of the current year
 * - Jan–Jul → August 1st of the previous year
 *
 * @param now - Optional date for testability (defaults to current date)
 * @returns ISO date string "YYYY-08-01"
 */
export function getCycleReferenceDate(now?: Date): string {
  const d = now ?? new Date();
  const month = d.getUTCMonth(); // 0-indexed, August = 7
  const year = month >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${year}-08-01`;
}

/**
 * Check if a person is a minor (≤13) based on the current cycle reference date (August 1st).
 * Returns true if birthDate is null/missing (safest default).
 * Used at registration time to determine consent flow and in onboarding.
 *
 * @param now - Optional date for testability (forwarded to getCycleReferenceDate)
 */
export function isMinor(birthDate: string | null | undefined, now?: Date): boolean {
  return calculateAge(birthDate, getCycleReferenceDate(now)) <= 13;
}
