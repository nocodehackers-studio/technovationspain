// Fields that are ALWAYS required from the user (never from CSV)
export const REQUIRED_PROFILE_FIELDS = [
  'first_name', 'last_name', 'date_of_birth',
  'dni', 'hub_id', 'postal_code'
] as const;

// Fields that can come from CSV — hidden if populated, shown if empty
const CSV_OPTIONAL_FIELDS = [
  'phone', 'city', 'state', 'school_name',
  'company_name', 'parent_name', 'parent_email'
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
  // CSV-optional fields — only show if empty
  CSV_OPTIONAL_FIELDS.forEach(field => {
    if (!profile[field]) missing.push(field);
  });
  return missing;
}
