// Custom types for Technovation España
// These extend the auto-generated Supabase types

export type AppRole = 'participant' | 'mentor' | 'judge' | 'volunteer' | 'admin';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'manual_review';

export type TeamCategory = 'beginner' | 'junior' | 'senior';

export type EventType = 'intermediate' | 'regional_final' | 'workshop';

export type RegistrationStatus = 'confirmed' | 'cancelled' | 'checked_in';

export type ConsentType = 'participation' | 'image_rights' | 'data_processing';

export type ConsentStatus = 'pending' | 'accepted' | 'revoked';

export interface Profile {
  id: string;
  email: string;
  tg_email?: string | null;
  tg_id?: string | null;
  verification_status: VerificationStatus;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  postal_code?: string | null;
  hub_id?: string | null;
  onboarding_completed: boolean;
  custom_fields?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TableCustomColumn {
  id: string;
  table_name: string;
  column_key: string;
  column_label: string;
  column_type: string;
  sort_order: number;
  created_by?: string | null;
  created_at: string;
}

export interface AdminTablePreferences {
  id: string;
  user_id: string;
  table_name: string;
  hidden_columns: string[];
  column_order: string[];
  saved_filters: Record<string, unknown>;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Hub {
  id: string;
  name: string;
  organization?: string | null;
  location?: string | null;
  coordinator_id?: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  tg_team_id?: string | null;
  category?: TeamCategory | null;
  hub_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  member_type: 'participant' | 'mentor';
  joined_at: string;
}

export interface Event {
  id: string;
  name: string;
  event_type?: EventType | null;
  date: string;
  status?: 'draft' | 'published' | null;
  location?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  location_city?: string | null;
  location_coordinates?: Record<string, unknown> | null;
  image_url?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  max_capacity?: number | null;
  current_registrations: number;
  registration_open_date?: string | null;
  registration_close_date?: string | null;
  description?: string | null;
  created_at: string;
}

export interface Workshop {
  id: string;
  event_id: string;
  name: string;
  description?: string | null;
  category?: TeamCategory | 'general' | null;
  time_slot?: string | null;
  max_capacity: number;
  current_registrations: number;
  location?: string | null;
  created_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  team_id?: string | null;
  registration_status: RegistrationStatus;
  qr_code: string;
  checked_in_at?: string | null;
  created_at: string;
}

export interface Companion {
  id: string;
  event_registration_id: string;
  first_name?: string | null;
  last_name?: string | null;
  dni?: string | null;
  relationship?: string | null;
  qr_code: string;
  checked_in_at?: string | null;
  created_at: string;
}

export interface WorkshopRegistration {
  id: string;
  workshop_id: string;
  team_id: string;
  preference_order?: number | null;
  assigned: boolean;
  created_at: string;
}

export interface ParentalConsent {
  id: string;
  user_id: string;
  parent_email: string;
  parent_name: string;
  consent_type?: ConsentType | null;
  status: ConsentStatus;
  consent_token?: string | null;
  consent_date?: string | null;
  revocation_date?: string | null;
  created_at: string;
}

export interface CSVImport {
  id: string;
  uploaded_by?: string | null;
  file_name: string;
  status: 'processing' | 'completed' | 'failed';
  records_processed: number;
  records_updated: number;
  records_new: number;
  errors?: Record<string, unknown> | null;
  imported_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  changes?: Record<string, unknown> | null;
  timestamp: string;
}

// Extended types with relations
export interface ProfileWithRole extends Profile {
  role?: AppRole;
}

export interface TeamWithMembers extends Team {
  members?: (TeamMember & { profile: Profile })[];
  hub?: Hub;
}

export interface EventWithWorkshops extends Event {
  workshops?: Workshop[];
}

export interface EventRegistrationWithDetails extends EventRegistration {
  event?: Event;
  team?: Team;
  companions?: Companion[];
  profile?: Profile;
}

export interface EventVolunteer {
  id: string;
  event_id: string;
  user_id: string;
  notes?: string | null;
  created_at: string;
}

export interface EventVolunteerWithDetails extends EventVolunteer {
  event?: Event;
  profile?: Profile;
}