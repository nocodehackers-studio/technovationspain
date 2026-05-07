import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PublicScheduleResponse } from '@/types/publicSchedule';

export function usePublicJudgingSchedule(token: string | undefined) {
  return useQuery({
    queryKey: ['public-judging-schedule', token],
    queryFn: async (): Promise<PublicScheduleResponse | null> => {
      if (!token) return null;
      const { data, error } = await supabase.rpc('get_public_judging_schedule', {
        p_token: token,
      });
      if (error) throw error;
      return (data as unknown as PublicScheduleResponse | null) ?? null;
    },
    enabled: !!token,
    staleTime: 30_000,
    retry: 1,
  });
}
