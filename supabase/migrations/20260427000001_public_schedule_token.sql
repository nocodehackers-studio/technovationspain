-- ============================================================================
-- Migration: Public Judging Schedule Token
-- Description: Adds events.public_schedule_token + SECURITY DEFINER function
--              get_public_judging_schedule(token) returning the consolidated
--              data needed by the public schedule page. The function only
--              returns data when the token matches an event with
--              event_type = 'regional_final'; otherwise returns NULL.
-- ============================================================================

-- 1. Column on events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS public_schedule_token TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_public_schedule_token_key'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_public_schedule_token_key UNIQUE (public_schedule_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_public_schedule_token
  ON public.events(public_schedule_token)
  WHERE public_schedule_token IS NOT NULL;

-- 2. Function: get_public_judging_schedule
CREATE OR REPLACE FUNCTION public.get_public_judging_schedule(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event RECORD;
  v_result JSONB;
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id, name, date, status, event_type
    INTO v_event
    FROM public.events
   WHERE public_schedule_token = p_token
     AND event_type = 'regional_final'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  WITH panels_cte AS (
    SELECT
      jp.id,
      jp.event_id,
      jp.panel_code,
      jp.session_number,
      jp.room_number,
      jp.turn,
      jp.created_at,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', jpj.id,
            'panel_id', jpj.panel_id,
            'judge_id', jpj.judge_id,
            'is_active', jpj.is_active,
            'assignment_type', jpj.assignment_type,
            'deactivated_at', jpj.deactivated_at,
            'deactivated_reason', jpj.deactivated_reason,
            'manual_change_comment', jpj.manual_change_comment,
            'manual_change_by', jpj.manual_change_by,
            'manual_change_at', jpj.manual_change_at,
            'profiles', jsonb_build_object(
              'id', jp_p.id,
              'first_name', jp_p.first_name,
              'last_name', jp_p.last_name,
              'email', jp_p.email,
              'hub_id', jp_p.hub_id,
              'chapter', jp_p.chapter,
              'city', jp_p.city,
              'state', jp_p.state
            ),
            'manual_change_by_profile', CASE
              WHEN mcp.id IS NULL THEN NULL
              ELSE jsonb_build_object('first_name', mcp.first_name, 'last_name', mcp.last_name)
            END
          )
        ), '[]'::jsonb)
        FROM public.judging_panel_judges jpj
        LEFT JOIN public.profiles jp_p ON jp_p.id = jpj.judge_id
        LEFT JOIN public.profiles mcp ON mcp.id = jpj.manual_change_by
        WHERE jpj.panel_id = jp.id
      ) AS judging_panel_judges,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', jpt.id,
            'panel_id', jpt.panel_id,
            'team_id', jpt.team_id,
            'team_code', jpt.team_code,
            'subsession', jpt.subsession,
            'assignment_type', jpt.assignment_type,
            'is_active', jpt.is_active,
            'display_order', jpt.display_order,
            'manual_change_comment', jpt.manual_change_comment,
            'manual_change_by', jpt.manual_change_by,
            'manual_change_at', jpt.manual_change_at,
            'teams', CASE
              WHEN t.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', t.id,
                'name', t.name,
                'category', t.category,
                'hub_id', t.hub_id
              )
            END,
            'manual_change_by_profile', CASE
              WHEN mcp2.id IS NULL THEN NULL
              ELSE jsonb_build_object('first_name', mcp2.first_name, 'last_name', mcp2.last_name)
            END
          )
        ), '[]'::jsonb)
        FROM public.judging_panel_teams jpt
        LEFT JOIN public.teams t ON t.id = jpt.team_id
        LEFT JOIN public.profiles mcp2 ON mcp2.id = jpt.manual_change_by
        WHERE jpt.panel_id = jp.id
      ) AS judging_panel_teams
    FROM public.judging_panels jp
    WHERE jp.event_id = v_event.id
    ORDER BY jp.session_number, jp.room_number
  ),
  judges_cte AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ja.id,
        'user_id', ja.user_id,
        'is_active', ja.is_active,
        'onboarding_completed', ja.onboarding_completed,
        'tech_global_onboarded', ja.tech_global_onboarded,
        'schedule_preference', ja.schedule_preference,
        'conflict_team_ids', COALESCE(ja.conflict_team_ids, ARRAY[]::uuid[]),
        'conflict_other_text', ja.conflict_other_text,
        'comments', ja.comments,
        'profiles', jsonb_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'email', p.email,
          'hub_id', p.hub_id,
          'is_active', p.is_active,
          'judge_excluded', p.judge_excluded,
          'chapter', p.chapter,
          'city', p.city,
          'state', p.state
        )
      )
    ) AS judges
    FROM public.judge_assignments ja
    LEFT JOIN public.profiles p ON p.id = ja.user_id
    WHERE ja.event_id = v_event.id
      AND COALESCE(p.judge_excluded, false) = false
  ),
  event_teams_cte AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', et.id,
        'team_id', et.team_id,
        'team_code', et.team_code,
        'category', et.category,
        'turn', et.turn,
        'is_active', et.is_active,
        'teams', CASE
          WHEN t.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'category', t.category,
            'hub_id', t.hub_id
          )
        END
      )
    ) AS event_teams
    FROM public.event_teams et
    LEFT JOIN public.teams t ON t.id = et.team_id
    WHERE et.event_id = v_event.id
  ),
  hubs_cte AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name)), '[]'::jsonb) AS hubs
    FROM public.hubs h
  ),
  config_cte AS (
    SELECT to_jsonb(c) AS config
    FROM public.judging_event_config c
    WHERE c.event_id = v_event.id
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'date', v_event.date,
      'status', v_event.status,
      'event_type', v_event.event_type
    ),
    'panels', COALESCE((SELECT jsonb_agg(to_jsonb(panels_cte)) FROM panels_cte), '[]'::jsonb),
    'config', (SELECT config FROM config_cte),
    'judges', COALESCE((SELECT judges FROM judges_cte), '[]'::jsonb),
    'event_teams', COALESCE((SELECT event_teams FROM event_teams_cte), '[]'::jsonb),
    'hubs', (SELECT hubs FROM hubs_cte)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_judging_schedule(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_judging_schedule(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
