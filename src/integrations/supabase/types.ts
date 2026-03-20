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
      companions: {
        Row: {
          checked_in_at: string | null
          created_at: string | null
          dni: string | null
          event_registration_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          qr_code: string
          relationship: string | null
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string | null
          dni?: string | null
          event_registration_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          qr_code: string
          relationship?: string | null
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string | null
          dni?: string | null
          event_registration_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
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
          admin_email: string | null
          errors: Json | null
          file_name: string
          id: string
          import_type: string | null
          imported_at: string | null
          records_activated: number | null
          records_new: number | null
          records_processed: number | null
          records_updated: number | null
          status: string | null
          storage_paths: Json | null
          total_records: number | null
          uploaded_by: string | null
        }
        Insert: {
          admin_email?: string | null
          errors?: Json | null
          file_name: string
          id?: string
          import_type?: string | null
          imported_at?: string | null
          records_activated?: number | null
          records_new?: number | null
          records_processed?: number | null
          records_updated?: number | null
          status?: string | null
          storage_paths?: Json | null
          total_records?: number | null
          uploaded_by?: string | null
        }
        Update: {
          admin_email?: string | null
          errors?: Json | null
          file_name?: string
          id?: string
          import_type?: string | null
          imported_at?: string | null
          records_activated?: number | null
          records_new?: number | null
          records_processed?: number | null
          records_updated?: number | null
          status?: string | null
          storage_paths?: Json | null
          total_records?: number | null
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
      development_tickets: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: []
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
          consent_token: string
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
          participant_count: number | null
          phone: string | null
          qr_code: string
          registration_number: string | null
          registration_status: string | null
          team_id: string | null
          team_id_tg: string | null
          team_name: string | null
          ticket_type_id: string | null
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          companion_of_registration_id?: string | null
          consent_token?: string
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
          participant_count?: number | null
          phone?: string | null
          qr_code: string
          registration_number?: string | null
          registration_status?: string | null
          team_id?: string | null
          team_id_tg?: string | null
          team_name?: string | null
          ticket_type_id?: string | null
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          companion_of_registration_id?: string | null
          consent_token?: string
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
          participant_count?: number | null
          phone?: string | null
          qr_code?: string
          registration_number?: string | null
          registration_status?: string | null
          team_id?: string | null
          team_id_tg?: string | null
          team_name?: string | null
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
      event_ticket_consents: {
        Row: {
          created_at: string
          event_registration_id: string
          id: string
          ip_address: string | null
          minor_age: number | null
          minor_name: string | null
          signature: string
          signed_at: string
          signer_dni: string
          signer_full_name: string
          signer_relationship: string
        }
        Insert: {
          created_at?: string
          event_registration_id: string
          id?: string
          ip_address?: string | null
          minor_age?: number | null
          minor_name?: string | null
          signature: string
          signed_at?: string
          signer_dni: string
          signer_full_name: string
          signer_relationship: string
        }
        Update: {
          created_at?: string
          event_registration_id?: string
          id?: string
          ip_address?: string | null
          minor_age?: number | null
          minor_name?: string | null
          signature?: string
          signed_at?: string
          signer_dni?: string
          signer_full_name?: string
          signer_relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_consents_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: true
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_types: {
        Row: {
          allowed_roles: string[] | null
          companion_fields_config: Json | null
          created_at: string | null
          current_count: number | null
          description: string | null
          event_id: string | null
          for_judges: boolean
          id: string
          is_active: boolean | null
          max_capacity: number
          max_companions: number
          name: string
          required_fields: string[] | null
          requires_team: boolean | null
          requires_verification: boolean | null
          sort_order: number | null
        }
        Insert: {
          allowed_roles?: string[] | null
          companion_fields_config?: Json | null
          created_at?: string | null
          current_count?: number | null
          description?: string | null
          event_id?: string | null
          for_judges?: boolean
          id?: string
          is_active?: boolean | null
          max_capacity: number
          max_companions?: number
          name: string
          required_fields?: string[] | null
          requires_team?: boolean | null
          requires_verification?: boolean | null
          sort_order?: number | null
        }
        Update: {
          allowed_roles?: string[] | null
          companion_fields_config?: Json | null
          created_at?: string | null
          current_count?: number | null
          description?: string | null
          event_id?: string | null
          for_judges?: boolean
          id?: string
          is_active?: boolean | null
          max_capacity?: number
          max_companions?: number
          name?: string
          required_fields?: string[] | null
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
      event_volunteers: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_volunteers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_volunteers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          workshop_preferences_open: boolean
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
          workshop_preferences_open?: boolean
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
          workshop_preferences_open?: boolean
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
          notes: string | null
        }
        Insert: {
          coordinator_id?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
        }
        Update: {
          coordinator_id?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
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
      judge_assignments: {
        Row: {
          comments: string | null
          conflict_other_text: string | null
          conflict_team_ids: string[] | null
          created_at: string | null
          event_id: string
          id: string
          is_active: boolean
          onboarding_completed: boolean
          schedule_preference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comments?: string | null
          conflict_other_text?: string | null
          conflict_team_ids?: string[] | null
          created_at?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          onboarding_completed?: boolean
          schedule_preference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comments?: string | null
          conflict_other_text?: string | null
          conflict_team_ids?: string[] | null
          created_at?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          onboarding_completed?: boolean
          schedule_preference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_assignments_user_id_fkey"
            columns: ["user_id"]
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
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          chapter: string | null
          city: string | null
          company_name: string | null
          created_at: string | null
          custom_fields: Json | null
          date_of_birth: string | null
          dni: string | null
          email: string
          first_name: string | null
          hub_id: string | null
          id: string
          is_active: boolean
          is_judge: boolean
          is_volunteer: boolean
          judge_how_discovered_program: string | null
          judge_previous_participation: string | null
          last_name: string | null
          onboarding_completed: boolean | null
          parent_email: string | null
          parent_name: string | null
          phone: string | null
          postal_code: string | null
          privacy_accepted_at: string | null
          profile_type: string | null
          school_name: string | null
          state: string | null
          terms_accepted_at: string | null
          tg_id: string | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          chapter?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          dni?: string | null
          email: string
          first_name?: string | null
          hub_id?: string | null
          id: string
          is_active?: boolean
          is_judge?: boolean
          is_volunteer?: boolean
          judge_how_discovered_program?: string | null
          judge_previous_participation?: string | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          parent_email?: string | null
          parent_name?: string | null
          phone?: string | null
          postal_code?: string | null
          privacy_accepted_at?: string | null
          profile_type?: string | null
          school_name?: string | null
          state?: string | null
          terms_accepted_at?: string | null
          tg_id?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          chapter?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          dni?: string | null
          email?: string
          first_name?: string | null
          hub_id?: string | null
          id?: string
          is_active?: boolean
          is_judge?: boolean
          is_volunteer?: boolean
          judge_how_discovered_program?: string | null
          judge_previous_participation?: string | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          parent_email?: string | null
          parent_name?: string | null
          phone?: string | null
          postal_code?: string | null
          privacy_accepted_at?: string | null
          profile_type?: string | null
          school_name?: string | null
          state?: string | null
          terms_accepted_at?: string | null
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
          city: string | null
          created_at: string | null
          hub_id: string | null
          id: string
          name: string
          notes: string | null
          season: string | null
          state: string | null
          status: string
          tg_team_id: string | null
          updated_at: string | null
          validated: boolean
        }
        Insert: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          hub_id?: string | null
          id?: string
          name: string
          notes?: string | null
          season?: string | null
          state?: string | null
          status?: string
          tg_team_id?: string | null
          updated_at?: string | null
          validated?: boolean
        }
        Update: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          hub_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          season?: string | null
          state?: string | null
          status?: string
          tg_team_id?: string | null
          updated_at?: string | null
          validated?: boolean
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
      workshop_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assignment_slot: string
          assignment_type: string | null
          event_id: string
          id: string
          preference_matched: number | null
          team_id: string
          time_slot_id: string
          workshop_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignment_slot: string
          assignment_type?: string | null
          event_id: string
          id?: string
          preference_matched?: number | null
          team_id: string
          time_slot_id: string
          workshop_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignment_slot?: string
          assignment_type?: string | null
          event_id?: string
          id?: string
          preference_matched?: number | null
          team_id?: string
          time_slot_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_assignments_time_slot_id_fkey"
            columns: ["time_slot_id"]
            isOneToOne: false
            referencedRelation: "workshop_time_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_assignments_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_preferences: {
        Row: {
          event_id: string
          id: string
          preference_order: number
          submitted_at: string | null
          submitted_by: string
          team_id: string
          workshop_id: string
        }
        Insert: {
          event_id: string
          id?: string
          preference_order: number
          submitted_at?: string | null
          submitted_by: string
          team_id: string
          workshop_id: string
        }
        Update: {
          event_id?: string
          id?: string
          preference_order?: number
          submitted_at?: string | null
          submitted_by?: string
          team_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_preferences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_preferences_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_preferences_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
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
      workshop_time_slots: {
        Row: {
          created_at: string | null
          end_time: string
          event_id: string
          id: string
          slot_number: number
          start_time: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          event_id: string
          id?: string
          slot_number: number
          start_time: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          event_id?: string
          id?: string
          slot_number?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_time_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          category: string | null
          company: string | null
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
          company?: string | null
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
          company?: string | null
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
      app_role:
        | "participant"
        | "mentor"
        | "chapter_ambassador"
        | "admin"
        | "collaborator"
      ticket_priority: "nice_to_have" | "mandatory"
      ticket_status: "pending" | "in_progress" | "completed"
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
      app_role: [
        "participant",
        "mentor",
        "chapter_ambassador",
        "admin",
        "collaborator",
      ],
      ticket_priority: ["nice_to_have", "mandatory"],
      ticket_status: ["pending", "in_progress", "completed"],
      verification_status: ["pending", "verified", "rejected", "manual_review"],
    },
  },
} as const
