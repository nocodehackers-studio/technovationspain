export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_table_preferences: {
        Row: {
          column_order: string[] | null
          hidden_columns: string[] | null
          id: string
          saved_filters: Json | null
          table_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          column_order?: string[] | null
          hidden_columns?: string[] | null
          id?: string
          saved_filters?: Json | null
          table_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          column_order?: string[] | null
          hidden_columns?: string[] | null
          id?: string
          saved_filters?: Json | null
          table_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authorized_students: {
        Row: {
          age: number | null
          city: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          imported_at: string
          last_name: string | null
          matched_profile_id: string | null
          media_consent: string | null
          parent_email: string | null
          parent_name: string | null
          parental_consent: string | null
          phone: string | null
          school_name: string | null
          signed_up_at: string | null
          state: string | null
          team_division: string | null
          team_name: string | null
          tg_id: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          city?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          imported_at?: string
          last_name?: string | null
          matched_profile_id?: string | null
          media_consent?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parental_consent?: string | null
          phone?: string | null
          school_name?: string | null
          signed_up_at?: string | null
          state?: string | null
          team_division?: string | null
          team_name?: string | null
          tg_id?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          city?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          imported_at?: string
          last_name?: string | null
          matched_profile_id?: string | null
          media_consent?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parental_consent?: string | null
          phone?: string | null
          school_name?: string | null
          signed_up_at?: string | null
          state?: string | null
          team_division?: string | null
          team_name?: string | null
          tg_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_students_matched_profile_id_fkey"
            columns: ["matched_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authorized_users: {
        Row: {
          age: number | null
          city: string | null
          company_name: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          imported_at: string
          last_name: string | null
          matched_profile_id: string | null
          media_consent: string | null
          parent_email: string | null
          parent_name: string | null
          parental_consent: string | null
          phone: string | null
          profile_type: string
          school_name: string | null
          signed_up_at: string | null
          state: string | null
          team_division: string | null
          team_name: string | null
          tg_id: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          imported_at?: string
          last_name?: string | null
          matched_profile_id?: string | null
          media_consent?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parental_consent?: string | null
          phone?: string | null
          profile_type: string
          school_name?: string | null
          signed_up_at?: string | null
          state?: string | null
          team_division?: string | null
          team_name?: string | null
          tg_id?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          imported_at?: string
          last_name?: string | null
          matched_profile_id?: string | null
          media_consent?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parental_consent?: string | null
          phone?: string | null
          profile_type?: string
          school_name?: string | null
          signed_up_at?: string | null
          state?: string | null
          team_division?: string | null
          team_name?: string | null
          tg_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_users_matched_profile_id_fkey"
            columns: ["matched_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companions: {
        Row: {
          checked_in_at: string | null
          created_at: string | null
          event_registration_id: string | null
          first_name: string
          id: string
          last_name: string
          qr_code: string
          relationship: string | null
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string | null
          event_registration_id?: string | null
          first_name: string
          id?: string
          last_name: string
          qr_code: string
          relationship?: string | null
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string | null
          event_registration_id?: string | null
          first_name?: string
          id?: string
          last_name?: string
          qr_code?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companions_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_imports: {
        Row: {
          errors: Json | null
          file_name: string
          id: string
          imported_at: string | null
          records_new: number | null
          records_processed: number | null
          records_updated: number | null
          status: string | null
          uploaded_by: string | null
        }
        Insert: {
          errors?: Json | null
          file_name: string
          id?: string
          imported_at?: string | null
          records_new?: number | null
          records_processed?: number | null
          records_updated?: number | null
          status?: string | null
          uploaded_by?: string | null
        }
        Update: {
          errors?: Json | null
          file_name?: string
          id?: string
          imported_at?: string | null
          records_new?: number | null
          records_processed?: number | null
          records_updated?: number | null
          status?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csv_imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_agenda: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          end_time: string
          event_id: string | null
          id: string
          sort_order: number | null
          start_time: string
          title: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          event_id?: string | null
          id?: string
          sort_order?: number | null
          start_time: string
          title: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_id?: string | null
          id?: string
          sort_order?: number | null
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_agenda_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_email_sends: {
        Row: {
          body_content: string | null
          created_at: string | null
          error_message: string | null
          event_id: string
          id: string
          recipients_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
          target_audience: string | null
          target_ticket_type_id: string | null
          template_type: string
        }
        Insert: {
          body_content?: string | null
          created_at?: string | null
          error_message?: string | null
          event_id: string
          id?: string
          recipients_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
          target_audience?: string | null
          target_ticket_type_id?: string | null
          template_type: string
        }
        Update: {
          body_content?: string | null
          created_at?: string | null
          error_message?: string | null
          event_id?: string
          id?: string
          recipients_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
          target_audience?: string | null
          target_ticket_type_id?: string | null
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_email_sends_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_sends_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_sends_target_ticket_type_id_fkey"
            columns: ["target_ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      event_email_templates: {
        Row: {
          body_content: string
          created_at: string | null
          event_id: string
          id: string
          is_active: boolean | null
          reply_to_email: string | null
          subject: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          body_content?: string
          created_at?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          reply_to_email?: string | null
          subject?: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          body_content?: string
          created_at?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          reply_to_email?: string | null
          subject?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_email_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          companion_of_registration_id: string | null
          created_at: string | null
          data_consent: boolean | null
          dni: string | null
          email: string | null
          event_id: string | null
          first_name: string | null
          id: string
          image_consent: boolean | null
          is_companion: boolean | null
          last_name: string | null
          phone: string | null
          qr_code: string
          registration_number: string | null
          registration_status: string | null
          team_id: string | null
          team_id_tg: string | null
          team_name: string | null
          tg_email: string | null
          ticket_type_id: string | null
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          companion_of_registration_id?: string | null
          created_at?: string | null
          data_consent?: boolean | null
          dni?: string | null
          email?: string | null
          event_id?: string | null
          first_name?: string | null
          id?: string
          image_consent?: boolean | null
          is_companion?: boolean | null
          last_name?: string | null
          phone?: string | null
          qr_code: string
          registration_number?: string | null
          registration_status?: string | null
          team_id?: string | null
          team_id_tg?: string | null
          team_name?: string | null
          tg_email?: string | null
          ticket_type_id?: string | null
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          companion_of_registration_id?: string | null
          created_at?: string | null
          data_consent?: boolean | null
          dni?: string | null
          email?: string | null
          event_id?: string | null
          first_name?: string | null
          id?: string
          image_consent?: boolean | null
          is_companion?: boolean | null
          last_name?: string | null
          phone?: string | null
          qr_code?: string
          registration_number?: string | null
          registration_status?: string | null
          team_id?: string | null
          team_id_tg?: string | null
          team_name?: string | null
          tg_email?: string | null
          ticket_type_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_companion_of_registration_id_fkey"
            columns: ["companion_of_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_types: {
        Row: {
          allowed_roles: string[] | null
          created_at: string | null
          current_count: number | null
          description: string | null
          event_id: string | null
          id: string
          is_active: boolean | null
          max_capacity: number
          max_companions: number
          name: string
          requires_team: boolean | null
          requires_verification: boolean | null
          sort_order: number | null
        }
        Insert: {
          allowed_roles?: string[] | null
          created_at?: string | null
          current_count?: number | null
          description?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          max_capacity: number
          max_companions?: number
          name: string
          requires_team?: boolean | null
          requires_verification?: boolean | null
          sort_order?: number | null
        }
        Update: {
          allowed_roles?: string[] | null
          created_at?: string | null
          current_count?: number | null
          description?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          max_capacity?: number
          max_companions?: number
          name?: string
          requires_team?: boolean | null
          requires_verification?: boolean | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          current_registrations: number | null
          date: string
          description: string | null
          end_time: string | null
          event_type: string | null
          id: string
          image_url: string | null
          location: string | null
          location_address: string | null
          location_city: string | null
          location_coordinates: Json | null
          location_name: string | null
          max_capacity: number | null
          name: string
          registration_close_date: string | null
          registration_open_date: string | null
          start_time: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          current_registrations?: number | null
          date: string
          description?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          location_address?: string | null
          location_city?: string | null
          location_coordinates?: Json | null
          location_name?: string | null
          max_capacity?: number | null
          name: string
          registration_close_date?: string | null
          registration_open_date?: string | null
          start_time?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          current_registrations?: number | null
          date?: string
          description?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          location_address?: string | null
          location_city?: string | null
          location_coordinates?: Json | null
          location_name?: string | null
          max_capacity?: number | null
          name?: string
          registration_close_date?: string | null
          registration_open_date?: string | null
          start_time?: string | null
          status?: string | null
        }
        Relationships: []
      }
      hubs: {
        Row: {
          coordinator_id: string | null
          created_at: string | null
          id: string
          location: string | null
          name: string
          organization: string | null
        }
        Insert: {
          coordinator_id?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
          organization?: string | null
        }
        Update: {
          coordinator_id?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
          organization?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hubs_coordinator_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consents: {
        Row: {
          consent_date: string | null
          consent_token: string | null
          consent_type: string | null
          created_at: string | null
          id: string
          parent_email: string
          parent_name: string
          revocation_date: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          consent_date?: string | null
          consent_token?: string | null
          consent_type?: string | null
          created_at?: string | null
          id?: string
          parent_email: string
          parent_name: string
          revocation_date?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          consent_date?: string | null
          consent_token?: string | null
          consent_type?: string | null
          created_at?: string | null
          id?: string
          parent_email?: string
          parent_name?: string
          revocation_date?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parental_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          custom_fields: Json | null
          date_of_birth: string | null
          email: string
          first_name: string | null
          hub_id: string | null
          id: string
          last_name: string | null
          onboarding_completed: boolean | null
          phone: string | null
          postal_code: string | null
          tg_email: string | null
          tg_id: string | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          created_at?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          email: string
          first_name?: string | null
          hub_id?: string | null
          id: string
          last_name?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          postal_code?: string | null
          tg_email?: string | null
          tg_id?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          created_at?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          email?: string
          first_name?: string | null
          hub_id?: string | null
          id?: string
          last_name?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          postal_code?: string | null
          tg_email?: string | null
          tg_id?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      table_custom_columns: {
        Row: {
          column_key: string
          column_label: string
          column_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          sort_order: number | null
          table_name: string
        }
        Insert: {
          column_key: string
          column_label: string
          column_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          sort_order?: number | null
          table_name: string
        }
        Update: {
          column_key?: string
          column_label?: string
          column_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          sort_order?: number | null
          table_name?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          member_type: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          member_type?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          member_type?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category: string | null
          created_at: string | null
          hub_id: string | null
          id: string
          name: string
          tg_team_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          hub_id?: string | null
          id?: string
          name: string
          tg_team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          hub_id?: string | null
          id?: string
          name?: string
          tg_team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workshop_registrations: {
        Row: {
          assigned: boolean | null
          created_at: string | null
          id: string
          preference_order: number | null
          team_id: string | null
          workshop_id: string | null
        }
        Insert: {
          assigned?: boolean | null
          created_at?: string | null
          id?: string
          preference_order?: number | null
          team_id?: string | null
          workshop_id?: string | null
        }
        Update: {
          assigned?: boolean | null
          created_at?: string | null
          id?: string
          preference_order?: number | null
          team_id?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workshop_registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_registrations_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          category: string | null
          created_at: string | null
          current_registrations: number | null
          description: string | null
          event_id: string | null
          id: string
          location: string | null
          max_capacity: number
          name: string
          time_slot: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          current_registrations?: number | null
          description?: string | null
          event_id?: string | null
          id?: string
          location?: string | null
          max_capacity: number
          name: string
          time_slot?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          current_registrations?: number | null
          description?: string | null
          event_id?: string | null
          id?: string
          location?: string | null
          max_capacity?: number
          name?: string
          time_slot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workshops_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_registration_count:
        | {
            Args: { p_event_id: string; p_ticket_type_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_companions_count?: number
              p_event_id: string
              p_ticket_type_id: string
            }
            Returns: undefined
          }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_team_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_registration_count:
        | {
            Args: { p_event_id: string; p_ticket_type_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_companions_count?: number
              p_event_id: string
              p_ticket_type_id: string
            }
            Returns: undefined
          }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "participant" | "mentor" | "judge" | "volunteer" | "admin"
      verification_status: "pending" | "verified" | "rejected" | "manual_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["participant", "mentor", "judge", "volunteer", "admin"],
      verification_status: ["pending", "verified", "rejected", "manual_review"],
    },
  },
} as const
