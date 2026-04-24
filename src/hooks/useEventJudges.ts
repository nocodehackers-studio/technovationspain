import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JudgeForAssignment {
  id: string;
  name: string;
  email: string;
  hubId: string | null;
  schedulePreference: 'morning' | 'afternoon' | 'no_preference' | null;
  conflictTeamIds: string[];
  conflictOtherText: string | null;
  onboardingCompleted: boolean;
  comments: string | null;
  isEventActive: boolean;
  judgeExcluded: boolean;
  chapter: string | null;
  city: string | null;
  state: string | null;
}

export function useEventJudges(eventId: string | undefined) {
  const judgesQuery = useQuery({
    queryKey: ['event-judges', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select(`
          id,
          user_id,
          is_active,
          onboarding_completed,
          schedule_preference,
          conflict_team_ids,
          conflict_other_text,
          comments,
          profiles!judge_assignments_user_id_fkey (
            id,
            first_name,
            last_name,
            email,
            hub_id,
            is_active,
            judge_excluded,
            chapter,
            city,
            state
          )
        `)
        .eq('event_id', eventId!);

      if (error) throw error;

      return (data || []).map((ja: any) => ({
        id: ja.profiles.id as string,
        name: `${ja.profiles.first_name || ''} ${ja.profiles.last_name || ''}`.trim(),
        email: ja.profiles.email as string,
        hubId: ja.profiles.hub_id as string | null,
        schedulePreference: ja.schedule_preference as JudgeForAssignment['schedulePreference'],
        conflictTeamIds: (ja.conflict_team_ids || []) as string[],
        conflictOtherText: ja.conflict_other_text as string | null,
        onboardingCompleted: ja.onboarding_completed as boolean,
        comments: ja.comments as string | null,
        isEventActive: ja.is_active as boolean,
        judgeExcluded: ja.profiles.judge_excluded as boolean,
        chapter: ja.profiles.chapter as string | null,
        city: ja.profiles.city as string | null,
        state: ja.profiles.state as string | null,
      })).filter((j: any) => !j.judgeExcluded) as JudgeForAssignment[];
    },
    enabled: !!eventId,
  });

  const readyJudges = (judgesQuery.data || []).filter(j => j.isEventActive && j.onboardingCompleted);
  const pendingJudges = (judgesQuery.data || []).filter(j => j.isEventActive && !j.onboardingCompleted);
  const bajaJudges = (judgesQuery.data || []).filter(j => !j.isEventActive && j.onboardingCompleted);
  const onboardingPendingJudges = (judgesQuery.data || []).filter(j => !j.isEventActive && !j.onboardingCompleted);

  return {
    judges: judgesQuery.data || [],
    readyJudges,
    pendingJudges,
    bajaJudges,
    onboardingPendingJudges,
    isLoading: judgesQuery.isLoading,
    error: judgesQuery.error,
  };
}
