import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePlatformSetting(key: string) {
  return useQuery({
    queryKey: ['platform_settings', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings' as any)
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.value ?? false;
    },
  });
}

export function useUpdatePlatformSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from('platform_settings' as any)
        .update({ value, updated_at: new Date().toISOString() } as any)
        .eq('key', key);
      if (error) throw error;
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['platform_settings', key] });
    },
  });
}
