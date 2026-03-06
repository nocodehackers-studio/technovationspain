import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScannedParticipant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  team_name: string | null;
  checked_in_at: string;
  companions: { first_name: string | null; last_name: string | null }[];
}

const BATCH_SIZE = 500;

async function fetchCheckedInCompanionsBatched(regIds: string[]) {
  if (regIds.length === 0) return [];

  const results: {
    event_registration_id: string;
    first_name: string | null;
    last_name: string | null;
  }[] = [];

  for (let i = 0; i < regIds.length; i += BATCH_SIZE) {
    const batch = regIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("companions")
      .select("event_registration_id, first_name, last_name")
      .in("event_registration_id", batch)
      .not("checked_in_at", "is", null);
    if (error) throw error;
    if (data) results.push(...data);
  }
  return results;
}

export function useScannedParticipants(eventId: string | undefined) {
  return useQuery({
    queryKey: ["scanned-participants", eventId],
    queryFn: async (): Promise<ScannedParticipant[]> => {
      const { data: registrations, error } = await supabase
        .from("event_registrations")
        .select("id, first_name, last_name, email, team_name, checked_in_at")
        .eq("event_id", eventId!)
        .eq("is_companion", false)
        .not("checked_in_at", "is", null)
        .order("checked_in_at", { ascending: false });

      if (error) throw error;
      if (!registrations || registrations.length === 0) return [];

      const regIds = registrations.map((r) => r.id);
      const companions = await fetchCheckedInCompanionsBatched(regIds);

      // Group companions by registration
      const companionMap = new Map<string, { first_name: string | null; last_name: string | null }[]>();
      for (const c of companions) {
        const list = companionMap.get(c.event_registration_id) || [];
        list.push({ first_name: c.first_name, last_name: c.last_name });
        companionMap.set(c.event_registration_id, list);
      }

      return registrations.map((r) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        team_name: r.team_name,
        checked_in_at: r.checked_in_at!,
        companions: companionMap.get(r.id) || [],
      }));
    },
    enabled: !!eventId,
    refetchInterval: 30000,
  });
}
