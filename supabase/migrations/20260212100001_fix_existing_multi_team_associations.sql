-- One-time repair: Fix existing broken team associations for users with multi-team names.
-- This finds authorized_users records that have matched_profile_id set (user already registered)
-- and a multi-team team_name (contains " and " or ",") and creates missing team_members entries.

DO $$
DECLARE
  auth_rec RECORD;
  team_name_item text;
  found_team_id uuid;
  member_type_to_assign text;
  fixed_count integer := 0;
BEGIN
  FOR auth_rec IN
    SELECT au.id, au.email, au.team_name, au.profile_type, au.matched_profile_id
    FROM authorized_users au
    WHERE au.matched_profile_id IS NOT NULL
    AND au.team_name IS NOT NULL
    AND au.team_name <> ''
    AND (au.team_name LIKE '% and %' OR au.team_name LIKE '%,%')
  LOOP
    -- Determine member_type based on profile_type
    IF auth_rec.profile_type = 'student' THEN
      member_type_to_assign := 'participant';
    ELSE
      member_type_to_assign := 'mentor';
    END IF;

    -- Split team_name and link to each team
    FOR team_name_item IN
      SELECT trim(unnest(string_to_array(
        replace(auth_rec.team_name, ' and ', ', '),
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
          VALUES (found_team_id, auth_rec.matched_profile_id, member_type_to_assign)
          ON CONFLICT DO NOTHING;

          fixed_count := fixed_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Fixed % team_members associations for multi-team users', fixed_count;
END $$;

-- Also fix users who have a single team_name that matched but never got a team_members entry
-- (e.g., registered before the team auto-linking trigger was added)
DO $$
DECLARE
  auth_rec RECORD;
  found_team_id uuid;
  member_type_to_assign text;
  fixed_count integer := 0;
BEGIN
  FOR auth_rec IN
    SELECT au.id, au.email, au.team_name, au.profile_type, au.matched_profile_id
    FROM authorized_users au
    WHERE au.matched_profile_id IS NOT NULL
    AND au.team_name IS NOT NULL
    AND au.team_name <> ''
    AND NOT EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = au.matched_profile_id
    )
  LOOP
    IF auth_rec.profile_type = 'student' THEN
      member_type_to_assign := 'participant';
    ELSE
      member_type_to_assign := 'mentor';
    END IF;

    -- Handle both single and multi-team names
    FOR found_team_id IN
      SELECT t.id
      FROM teams t
      WHERE lower(t.name) IN (
        SELECT lower(trim(unnest(string_to_array(
          replace(auth_rec.team_name, ' and ', ', '),
          ','
        ))))
      )
    LOOP
      INSERT INTO team_members (team_id, user_id, member_type)
      VALUES (found_team_id, auth_rec.matched_profile_id, member_type_to_assign)
      ON CONFLICT DO NOTHING;

      fixed_count := fixed_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Fixed % additional team_members for users with no team associations', fixed_count;
END $$;
