export interface JudgeRow {
  user_id: string;
  is_active: boolean;
  onboarding_completed: boolean;
  tech_global_onboarded: boolean | null;
  schedule_preference: string | null;
  event_id: string | null;
  event: { id: string; name: string } | null;
  profiles: {
    hub_id: string | null;
    company_name: string | null;
    state: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export function buildEventDistribution(
  rows: Pick<JudgeRow, "event_id" | "event">[]
): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  const UNASSIGNED = "__SIN_ASIGNAR__";
  const UNKNOWN = "__EVENTO_DESCONOCIDO__";
  rows.forEach((r) => {
    let key: string;
    if (r.event?.name) {
      key = r.event.name;
    } else if (r.event_id) {
      // event_id set but embed missing (deleted/RLS-hidden) — surface as a single labeled bucket instead of leaking the UUID.
      key = UNKNOWN;
    } else {
      key = UNASSIGNED;
    }
    counts[key] = (counts[key] || 0) + 1;
  });
  const relabel = (name: string) => {
    if (name === UNASSIGNED) return "Sin asignar";
    if (name === UNKNOWN) return "Evento desconocido";
    return name;
  };
  return Object.entries(counts)
    .map(([name, value]) => ({ name: relabel(name), value }))
    .sort((a, b) => b.value - a.value);
}
