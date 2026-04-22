import { describe, it, expect } from 'vitest';
import { buildEventDistribution } from '@/pages/admin/reports-judges-helpers';

type Row = { event_id: string | null; event: { id: string; name: string } | null };

describe('buildEventDistribution', () => {
  it('returns empty array for no rows', () => {
    expect(buildEventDistribution([])).toEqual([]);
  });

  it('groups assignments by event name, sorted desc by count', () => {
    const rows: Row[] = [
      { event_id: 'e1', event: { id: 'e1', name: 'Final Madrid' } },
      { event_id: 'e1', event: { id: 'e1', name: 'Final Madrid' } },
      { event_id: 'e1', event: { id: 'e1', name: 'Final Madrid' } },
      { event_id: 'e2', event: { id: 'e2', name: 'Final Barcelona' } },
    ];
    expect(buildEventDistribution(rows)).toEqual([
      { name: 'Final Madrid', value: 3 },
      { name: 'Final Barcelona', value: 1 },
    ]);
  });

  it('includes a "Sin asignar" bucket for rows with event_id null', () => {
    const rows: Row[] = [
      { event_id: 'e1', event: { id: 'e1', name: 'Final Madrid' } },
      { event_id: null, event: null },
      { event_id: null, event: null },
    ];
    const result = buildEventDistribution(rows);
    expect(result).toContainEqual({ name: 'Sin asignar', value: 2 });
    expect(result).toContainEqual({ name: 'Final Madrid', value: 1 });
    expect(result[0].name).toBe('Sin asignar');
  });

  it('does NOT dedup by user: same user assigned to two events counts 1 in each', () => {
    const rows: Row[] = [
      { event_id: 'e1', event: { id: 'e1', name: 'Final Madrid' } },
      { event_id: 'e2', event: { id: 'e2', name: 'Final Barcelona' } },
    ];
    const result = buildEventDistribution(rows);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.value === 1)).toBe(true);
  });

  it('labels orphan event_id (embed missing) as "Evento desconocido"', () => {
    const rows: Row[] = [
      { event_id: 'orphan-id', event: null },
    ];
    expect(buildEventDistribution(rows)).toEqual([
      { name: 'Evento desconocido', value: 1 },
    ]);
  });

  it('separates "Sin asignar" from "Evento desconocido"', () => {
    const rows: Row[] = [
      { event_id: 'orphan-id', event: null },
      { event_id: null, event: null },
      { event_id: null, event: null },
    ];
    const result = buildEventDistribution(rows);
    expect(result).toContainEqual({ name: 'Sin asignar', value: 2 });
    expect(result).toContainEqual({ name: 'Evento desconocido', value: 1 });
  });

  it('bucket "Sin asignar" collapses all null event_ids regardless of relation shape', () => {
    const rows: Row[] = [
      { event_id: null, event: null },
      { event_id: null, event: null },
      { event_id: null, event: null },
    ];
    expect(buildEventDistribution(rows)).toEqual([
      { name: 'Sin asignar', value: 3 },
    ]);
  });
});
