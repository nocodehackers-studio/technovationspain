import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  member_type: string | null;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface Hub {
  name: string;
  location: string | null;
}

interface Team {
  id: string;
  name: string;
  category: string | null;
  hub: Hub | null;
  members: TeamMember[];
}

export function useMentorTeams(userId: string | undefined) {
  return useQuery({
    queryKey: ['mentor-teams', userId],
    queryFn: async (): Promise<Team[]> => {
      if (!userId) return [];
      
      // Get teams where user is mentor
      const { data: teamMemberships, error } = await supabase
        .from('team_members')
        .select(`
          team_id,
          team:teams(
            id, 
            name, 
            category,
            hub:hubs(name, location)
          )
        `)
        .eq('user_id', userId)
        .eq('member_type', 'mentor');
      
      if (error) throw error;
      if (!teamMemberships?.length) return [];
      
      // For each team, get its members
      const teamsWithMembers = await Promise.all(
        teamMemberships.map(async (tm) => {
          const teamData = tm.team as any;
          if (!teamData) return null;
          
          const { data: members, error: membersError } = await supabase
            .from('team_members')
            .select(`
              member_type,
              user:profiles(id, first_name, last_name, email)
            `)
            .eq('team_id', tm.team_id);
          
          if (membersError) {
            console.error('Error fetching team members:', membersError);
            return null;
          }
          
          return {
            id: teamData.id,
            name: teamData.name,
            category: teamData.category,
            hub: teamData.hub as Hub | null,
            members: (members || []) as TeamMember[],
          };
        })
      );
      
      return teamsWithMembers.filter((t): t is Team => t !== null);
    },
    enabled: !!userId,
  });
}
