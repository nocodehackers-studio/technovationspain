import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TicketTypeStats {
  name: string;
  registered: number;
  checkedIn: number;
  percentage: number;
}

export interface RoleStats {
  role: string;
  registered: number;
  checkedIn: number;
  percentage: number;
}

export interface TimelinePoint {
  time: string;
  cumulative: number;
}

export interface AccreditationStats {
  totalRegistered: number;
  totalCheckedIn: number;
  percentage: number;
  byTicketType: TicketTypeStats[];
  byRole: RoleStats[];
  timeline: TimelinePoint[];
  companionsRegistered: number;
  companionsCheckedIn: number;
}

interface TicketTypeJoin {
  id: string;
  name: string;
  allowed_roles: string[] | null;
}

function roundPercentage(checkedIn: number, registered: number): number {
  return registered > 0 ? Math.round((checkedIn / registered) * 100) : 0;
}

const BATCH_SIZE = 500;

async function fetchCompanionsBatched(regIds: string[]) {
  if (regIds.length === 0) return [];

  const results: { id: string; event_registration_id: string; checked_in_at: string | null }[] = [];
  for (let i = 0; i < regIds.length; i += BATCH_SIZE) {
    const batch = regIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("companions")
      .select("id, event_registration_id, checked_in_at")
      .in("event_registration_id", batch);
    if (error) throw error;
    if (data) results.push(...data);
  }
  return results;
}

function buildTimeline(timestamps: (string | null)[]): TimelinePoint[] {
  const validDates = timestamps
    .filter((t): t is string => t !== null)
    .map((t) => new Date(t))
    .sort((a, b) => a.getTime() - b.getTime());

  if (validDates.length === 0) return [];

  // Check if timestamps span multiple days
  const firstDay = validDates[0].toDateString();
  const lastDay = validDates[validDates.length - 1].toDateString();
  const isMultiDay = firstDay !== lastDay;

  // Group by 15-minute intervals
  const buckets = new Map<string, number>();
  for (const date of validDates) {
    const minutes = Math.floor(date.getMinutes() / 15) * 15;
    const bucketDate = new Date(date);
    bucketDate.setMinutes(minutes, 0, 0);
    const key = bucketDate.toISOString();
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  // Convert to cumulative timeline
  const sortedKeys = [...buckets.keys()].sort();
  let cumulative = 0;
  return sortedKeys.map((key) => {
    cumulative += buckets.get(key)!;
    const d = new Date(key);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    const time = isMultiDay
      ? `${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`
      : `${hh}:${mm}`;
    return { time, cumulative };
  });
}

export function useAccreditationStats(eventId: string | undefined) {
  return useQuery({
    queryKey: ["accreditation-stats", eventId],
    queryFn: async (): Promise<AccreditationStats> => {
      // Query 1: Main registrations with ticket type info
      const { data: registrations, error: regError } = await supabase
        .from("event_registrations")
        .select(
          "id, registration_status, checked_in_at, is_companion, ticket_type_id, event_ticket_types(id, name, allowed_roles)"
        )
        .eq("event_id", eventId!)
        .eq("is_companion", false)
        .in("registration_status", ["confirmed", "checked_in"]);

      if (regError) throw regError;
      if (!registrations || registrations.length === 0) {
        return {
          totalRegistered: 0,
          totalCheckedIn: 0,
          percentage: 0,
          byTicketType: [],
          byRole: [],
          timeline: [],
          companionsRegistered: 0,
          companionsCheckedIn: 0,
        };
      }

      // Query 2: Companions (batched to avoid URL length limits)
      const regIds = registrations.map((r) => r.id);
      const companions = await fetchCompanionsBatched(regIds);

      // Total metrics
      const totalRegistered = registrations.length;
      const totalCheckedIn = registrations.filter((r) => r.checked_in_at !== null).length;
      const percentage = roundPercentage(totalCheckedIn, totalRegistered);

      // By ticket type
      const ticketMap = new Map<string, { name: string; registered: number; checkedIn: number }>();
      for (const reg of registrations) {
        const tt = reg.event_ticket_types as TicketTypeJoin | null;
        const name = tt?.name || "Sin tipo";
        if (!ticketMap.has(name)) {
          ticketMap.set(name, { name, registered: 0, checkedIn: 0 });
        }
        const entry = ticketMap.get(name)!;
        entry.registered++;
        if (reg.checked_in_at) entry.checkedIn++;
      }
      const byTicketType: TicketTypeStats[] = [...ticketMap.values()]
        .filter((t) => t.registered > 0)
        .map((t) => ({
          ...t,
          percentage: roundPercentage(t.checkedIn, t.registered),
        }));

      // By role
      const roleMap = new Map<string, { registered: number; checkedIn: number }>();
      roleMap.set("Participantes", { registered: 0, checkedIn: 0 });
      roleMap.set("Mentores", { registered: 0, checkedIn: 0 });

      for (const reg of registrations) {
        const tt = reg.event_ticket_types as TicketTypeJoin | null;
        const roles = tt?.allowed_roles || [];
        let roleName = "Participantes";
        if (roles.includes("mentor") || roles.includes("collaborator")) {
          roleName = "Mentores";
        }
        const entry = roleMap.get(roleName)!;
        entry.registered++;
        if (reg.checked_in_at) entry.checkedIn++;
      }

      // Companions as a role
      const companionsRegistered = companions.length;
      const companionsCheckedIn = companions.filter((c) => c.checked_in_at !== null).length;

      const byRole: RoleStats[] = [...roleMap.entries()]
        .map(([role, data]) => ({
          role,
          ...data,
          percentage: roundPercentage(data.checkedIn, data.registered),
        }))
        .concat({
          role: "Acompañantes",
          registered: companionsRegistered,
          checkedIn: companionsCheckedIn,
          percentage: roundPercentage(companionsCheckedIn, companionsRegistered),
        })
        .filter((r) => r.registered > 0);

      // Timeline: merge registration + companion check-in timestamps
      const allTimestamps = [
        ...registrations.map((r) => r.checked_in_at),
        ...companions.map((c) => c.checked_in_at),
      ];
      const timeline = buildTimeline(allTimestamps);

      return {
        totalRegistered,
        totalCheckedIn,
        percentage,
        byTicketType,
        byRole,
        timeline,
        companionsRegistered,
        companionsCheckedIn,
      };
    },
    enabled: !!eventId,
    refetchInterval: 30000,
  });
}
