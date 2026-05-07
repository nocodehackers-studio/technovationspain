// Shapes returned by the SQL function `get_public_judging_schedule`.
// Naming mirrors the Postgres tables 1:1 so the response can be consumed
// directly by the read-only AdminJudgingSchedule view.

export interface PublicScheduleEvent {
  id: string;
  name: string;
  date: string | null;
  status: string | null;
  event_type: 'regional_final';
}

export interface PublicScheduleProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  hub_id: string | null;
  chapter: string | null;
  city: string | null;
  state: string | null;
}

export interface PublicScheduleManualChangeProfile {
  first_name: string;
  last_name: string;
}

export interface PublicSchedulePanelJudge {
  id: string;
  panel_id: string;
  judge_id: string;
  is_active: boolean;
  assignment_type: 'algorithm' | 'manual';
  deactivated_at: string | null;
  deactivated_reason: string | null;
  manual_change_comment: string | null;
  manual_change_by: string | null;
  manual_change_at: string | null;
  profiles: PublicScheduleProfile;
  manual_change_by_profile: PublicScheduleManualChangeProfile | null;
}

export interface PublicSchedulePanelTeam {
  id: string;
  panel_id: string;
  team_id: string;
  team_code: string;
  subsession: 1 | 2;
  assignment_type: 'algorithm' | 'manual';
  is_active: boolean;
  display_order: number;
  manual_change_comment: string | null;
  manual_change_by: string | null;
  manual_change_at: string | null;
  teams: {
    id: string;
    name: string;
    category: string | null;
    hub_id: string | null;
  } | null;
  manual_change_by_profile: PublicScheduleManualChangeProfile | null;
}

export interface PublicSchedulePanel {
  id: string;
  event_id: string;
  panel_code: string;
  session_number: number;
  room_number: number;
  turn: 'morning' | 'afternoon';
  created_at: string | null;
  judging_panel_judges: PublicSchedulePanelJudge[];
  judging_panel_teams: PublicSchedulePanelTeam[];
}

export interface PublicScheduleConfig {
  id: string;
  event_id: string;
  total_rooms: number;
  teams_per_group: number;
  judges_per_group: number;
  sessions_per_turn: number;
  algorithm_run_at: string | null;
  algorithm_run_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PublicScheduleJudge {
  id: string;
  user_id: string;
  is_active: boolean;
  onboarding_completed: boolean;
  tech_global_onboarded: boolean | null;
  schedule_preference: 'morning' | 'afternoon' | 'no_preference' | null;
  conflict_team_ids: string[];
  conflict_other_text: string | null;
  comments: string | null;
  profiles: PublicScheduleProfile & {
    is_active: boolean;
    judge_excluded: boolean;
  };
}

export interface PublicScheduleEventTeam {
  id: string;
  team_id: string;
  team_code: string | null;
  category: string | null;
  turn: string | null;
  is_active: boolean;
  teams: {
    id: string;
    name: string;
    category: string | null;
    hub_id: string | null;
  } | null;
}

export interface PublicScheduleHub {
  id: string;
  name: string;
}

export interface PublicScheduleResponse {
  event: PublicScheduleEvent;
  panels: PublicSchedulePanel[];
  config: PublicScheduleConfig | null;
  judges: PublicScheduleJudge[];
  event_teams: PublicScheduleEventTeam[];
  hubs: PublicScheduleHub[];
}
