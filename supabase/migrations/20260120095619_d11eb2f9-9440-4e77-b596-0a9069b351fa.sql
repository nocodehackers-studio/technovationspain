-- Create a security definer function to check team membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

-- Create a function to get all team_ids for a user
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = _user_id
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;

-- Create new policy using the security definer function
CREATE POLICY "Users can view team members of their teams" 
ON public.team_members 
FOR SELECT 
USING (
  team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'volunteer'::app_role)
);