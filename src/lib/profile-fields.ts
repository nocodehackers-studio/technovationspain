// Fields that are ALWAYS required from the user (never from CSV)
export const REQUIRED_PROFILE_FIELDS = [
  'first_name', 'last_name', 'date_of_birth',
  'dni', 'postal_code'
] as const;

// Fields that can come from CSV — hidden if populated, shown if empty
// NOTE: school_name, company_name are CSV-only (never shown in onboarding)
// NOTE: parent_name, parent_email are handled by age logic in Onboarding component
// NOTE: hub_id is optional — hub selector only renders when hubs are available
const CSV_OPTIONAL_FIELDS = [
  'phone', 'city', 'state', 'hub_id'
] as const;

export type RequiredField = typeof REQUIRED_PROFILE_FIELDS[number];

export function hasMissingFields(profile: Record<string, unknown>): boolean {
  return REQUIRED_PROFILE_FIELDS.some(field => !profile[field]);
}

export function getMissingFields(profile: Record<string, unknown>): string[] {
  const missing: string[] = [];
  // Always-required fields
  REQUIRED_PROFILE_FIELDS.forEach(field => {
    if (!profile[field]) missing.push(field);
  });
  // CSV-optional fields — only show if empty (hub_id excluded: null is a valid value)
  CSV_OPTIONAL_FIELDS.forEach(field => {
    if (field === 'hub_id') return;
    if (!profile[field]) missing.push(field);
  });
  return missing;
}
