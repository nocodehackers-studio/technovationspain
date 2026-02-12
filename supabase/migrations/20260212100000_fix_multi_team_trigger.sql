-- Fix: Update auto_verify_authorized_user_after() to handle multi-team names
-- The team_name field can contain multiple teams separated by commas and/or "and"
-- e.g. "Kiwi Code Girls and Techno Happy" or "TeamA, TeamB, and TeamC"
-- Previously this did a single exact match which failed for multi-team strings.

CREATE OR REPLACE FUNCTION public.auto_verify_authorized_user_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  authorized_record authorized_users%ROWTYPE;
  role_to_assign app_role;
  found_team_id uuid;
  member_type_to_assign text;
  team_name_item text;
BEGIN
  -- Only execute if profile was verified and has tg_id (indicates from whitelist)
  IF NEW.verification_status = 'verified' AND NEW.tg_id IS NOT NULL THEN
    -- Get the authorized user record to determine role
    SELECT * INTO authorized_record
    FROM authorized_users
    WHERE lower(email) = lower(NEW.email)
    AND matched_profile_id IS NULL
    LIMIT 1;

    IF FOUND THEN
      -- Mark the authorized_users record as matched
      UPDATE authorized_users
      SET matched_profile_id = NEW.id
      WHERE id = authorized_record.id;

      -- Determine role based on profile_type
      CASE authorized_record.profile_type
        WHEN 'student' THEN role_to_assign := 'participant';
        WHEN 'mentor' THEN role_to_assign := 'mentor';
        WHEN 'chapter_ambassador' THEN role_to_assign := 'mentor';
        WHEN 'judge' THEN role_to_assign := 'judge';
        ELSE role_to_assign := 'participant';
      END CASE;

      -- Assign the appropriate role
      INSERT INTO user_roles (user_id, role)
      VALUES (NEW.id, role_to_assign)
      ON CONFLICT (user_id, role) DO NOTHING;

      -- Auto-link to team(s) - handles multi-team names separated by "and" or ","
      IF authorized_record.team_name IS NOT NULL AND authorized_record.team_name <> '' THEN
        -- Determine member_type based on profile_type
        IF authorized_record.profile_type = 'student' THEN
          member_type_to_assign := 'participant';
        ELSE
          member_type_to_assign := 'mentor';
        END IF;

        -- Split team_name by " and " and "," then iterate over each team
        FOR team_name_item IN
          SELECT trim(unnest(string_to_array(
            replace(authorized_record.team_name, ' and ', ', '),
            ','
          )))
        LOOP
          IF team_name_item <> '' THEN
            SELECT id INTO found_team_id
            FROM teams
            WHERE lower(name) = lower(team_name_item)
            LIMIT 1;

            IF found_team_id IS NOT NULL THEN
              INSERT INTO team_members (team_id, user_id, member_type)
              VALUES (found_team_id, NEW.id, member_type_to_assign)
              ON CONFLICT DO NOTHING;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
