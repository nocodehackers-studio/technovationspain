import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  buildJudgeRowsByCategory,
  generateTechnovationGlobalJudgesZip,
} from '@/lib/exports/exportTechnovationGlobalJudges';
import type { PanelWithRelations } from '@/hooks/useJudgingAssignment';
import type { TeamCategory } from '@/types/database';

interface JudgeFixture {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active?: boolean;
}

interface TeamFixture {
  id: string;
  name: string;
  category: TeamCategory | string;
  display_order: number;
  subsession?: 1 | 2;
  is_active?: boolean;
}

interface PanelFixture {
  id: string;
  category?: TeamCategory;
  turn?: 'morning' | 'afternoon';
  judges: JudgeFixture[];
  teams: TeamFixture[];
}

function makePanel(p: PanelFixture): PanelWithRelations {
  return {
    id: p.id,
    event_id: 'event-1',
    panel_code: `JUECES ${p.id}`,
    session_number: 1,
    room_number: 1,
    turn: p.turn || 'morning',
    created_at: '',
    updated_at: '',
    judging_panel_judges: p.judges.map((j, idx) => ({
      id: `pj-${p.id}-${idx}`,
      panel_id: p.id,
      judge_id: j.id,
      assignment_type: 'algorithm' as const,
      is_active: j.is_active ?? true,
      assigned_by: null,
      deactivated_at: null,
      deactivated_reason: null,
      manual_change_comment: null,
      manual_change_by: null,
      manual_change_at: null,
      created_at: '',
      updated_at: '',
      profiles: {
        id: j.id,
        first_name: j.first_name,
        last_name: j.last_name,
        email: j.email,
        hub_id: null,
        chapter: null,
        city: null,
        state: null,
      },
      manual_change_by_profile: null,
    })),
    judging_panel_teams: p.teams.map((t, idx) => ({
      id: `pt-${p.id}-${idx}`,
      panel_id: p.id,
      team_id: t.id,
      team_code: t.id,
      subsession: (t.subsession ?? 1) as 1 | 2,
      assignment_type: 'algorithm' as const,
      is_active: t.is_active ?? true,
      assigned_by: null,
      moved_from_panel_id: null,
      display_order: t.display_order,
      manual_change_comment: null,
      manual_change_by: null,
      manual_change_at: null,
      created_at: '',
      updated_at: '',
      teams: {
        id: t.id,
        name: t.name,
        category: t.category as TeamCategory,
        hub_id: null,
      },
      manual_change_by_profile: null,
    })),
  } as unknown as PanelWithRelations;
}

const emptyMaps = {
  externalIdByUserId: new Map<string, string | null>(),
  companyByUserId: new Map<string, string | null>(),
};

describe('buildJudgeRowsByCategory', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('happy path: 1 panel beginner mañana con 2 jueces y 6 equipos', () => {
    const panel = makePanel({
      id: 'p1',
      turn: 'morning',
      judges: [
        { id: 'j1', first_name: 'Ana', last_name: 'García', email: 'ana@x.com' },
        { id: 'j2', first_name: 'Beto', last_name: 'López', email: 'beto@x.com' },
      ],
      teams: [
        { id: 't1', name: 'Team A', category: 'beginner', display_order: 0, subsession: 1 },
        { id: 't2', name: 'Team B', category: 'beginner', display_order: 1, subsession: 1 },
        { id: 't3', name: 'Team C', category: 'beginner', display_order: 2, subsession: 1 },
        { id: 't4', name: 'Team D', category: 'beginner', display_order: 3, subsession: 2 },
        { id: 't5', name: 'Team E', category: 'beginner', display_order: 4, subsession: 2 },
        { id: 't6', name: 'Team F', category: 'beginner', display_order: 5, subsession: 2 },
      ],
    });

    const externalIdByUserId = new Map([
      ['j1', 'EXT-001'],
      ['j2', 'EXT-002'],
    ]);
    const companyByUserId = new Map([
      ['j1', 'Acme'],
      ['j2', 'Globex'],
    ]);

    const result = buildJudgeRowsByCategory({
      panels: [panel],
      externalIdByUserId,
      companyByUserId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('beginner');
    expect(result[0].turn).toBe('morning');
    expect(result[0].rows).toHaveLength(2);

    const ana = result[0].rows.find(r => r.name === 'Ana García')!;
    expect(ana.email).toBe('ana@x.com');
    expect(ana.judgeId).toBe('EXT-001');
    expect(ana.company).toBe('Acme');
    expect(ana.numberOfAssignedTeams).toBe(6);
    expect(ana.assignedTeams).toBe('Team A;Team B;Team C;Team D;Team E;Team F');
  });

  it('multi-categoría: juez en panel beginner y junior aparece en ambas', () => {
    const beginnerPanel = makePanel({
      id: 'pB',
      turn: 'morning',
      judges: [{ id: 'j1', first_name: 'Multi', last_name: 'Cat', email: 'm@x.com' }],
      teams: [{ id: 't1', name: 'B1', category: 'beginner', display_order: 0 }],
    });
    const juniorPanel = makePanel({
      id: 'pJ',
      turn: 'morning',
      judges: [{ id: 'j1', first_name: 'Multi', last_name: 'Cat', email: 'm@x.com' }],
      teams: [{ id: 't2', name: 'J1', category: 'junior', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({
      panels: [beginnerPanel, juniorPanel],
      ...emptyMaps,
    });

    expect(result).toHaveLength(2);
    const beg = result.find(c => c.category === 'beginner')!;
    const jun = result.find(c => c.category === 'junior')!;
    expect(beg.rows).toHaveLength(1);
    expect(beg.rows[0].assignedTeams).toBe('B1');
    expect(jun.rows).toHaveLength(1);
    expect(jun.rows[0].assignedTeams).toBe('J1');
  });

  it('inactivos excluidos: panel_judges.is_active=false y panel_teams.is_active=false', () => {
    const panel = makePanel({
      id: 'p1',
      judges: [
        { id: 'jA', first_name: 'Activo', last_name: 'X', email: 'a@x.com' },
        { id: 'jI', first_name: 'Inactivo', last_name: 'Y', email: 'i@x.com', is_active: false },
      ],
      teams: [
        { id: 't1', name: 'T1', category: 'beginner', display_order: 0 },
        { id: 't2', name: 'T2', category: 'beginner', display_order: 1, is_active: false },
        { id: 't3', name: 'T3', category: 'beginner', display_order: 2 },
      ],
    });

    const result = buildJudgeRowsByCategory({ panels: [panel], ...emptyMaps });

    expect(result).toHaveLength(1);
    expect(result[0].rows).toHaveLength(1);
    const row = result[0].rows[0];
    expect(row.name).toBe('Activo X');
    expect(row.numberOfAssignedTeams).toBe(2);
    expect(row.assignedTeams).toBe('T1;T3');
  });

  it('judge_excluded: contrato — caller filtra antes; función produce diferencia', () => {
    // El contrato del módulo es que el caller pre-filtra excluidos del array
    // judging_panel_judges antes de pasarlo. Verificamos ambos lados del contrato:
    // (1) si NO se filtra, el juez SÍ aparece (el módulo no implementa el filtro);
    // (2) si SÍ se filtra, el juez no aparece.
    const panelWithExcluded = makePanel({
      id: 'p1',
      judges: [
        { id: 'jExc', first_name: 'Excluido', last_name: 'Bad', email: 'e@x.com' },
        { id: 'jOk', first_name: 'OK', last_name: 'Good', email: 'ok@x.com' },
      ],
      teams: [{ id: 't1', name: 'T1', category: 'beginner', display_order: 0 }],
    });

    // Sin pre-filtrar: el juez excluido aparece (responsabilidad del caller).
    const unfiltered = buildJudgeRowsByCategory({
      panels: [panelWithExcluded],
      ...emptyMaps,
    });
    expect(unfiltered[0].rows.map(r => r.name).sort()).toEqual([
      'Excluido Bad',
      'OK Good',
    ]);

    // Pre-filtrado por el caller (como hace JudgingManager): el excluido desaparece.
    const filteredPanel = {
      ...panelWithExcluded,
      judging_panel_judges: panelWithExcluded.judging_panel_judges.filter(
        pj => pj.judge_id !== 'jExc',
      ),
    };
    const filtered = buildJudgeRowsByCategory({
      panels: [filteredPanel],
      ...emptyMaps,
    });
    expect(filtered[0].rows).toHaveLength(1);
    expect(filtered[0].rows[0].name).toBe('OK Good');
  });

  it('sin external_judge_id: judgeId queda vacío', () => {
    const panel = makePanel({
      id: 'p1',
      judges: [{ id: 'j1', first_name: 'Sin', last_name: 'ID', email: 's@x.com' }],
      teams: [{ id: 't1', name: 'T1', category: 'beginner', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({
      panels: [panel],
      externalIdByUserId: new Map([['j1', null]]),
      companyByUserId: new Map(),
    });

    expect(result[0].rows[0].judgeId).toBe('');
  });

  it('sin company_name: company queda vacío', () => {
    const panel = makePanel({
      id: 'p1',
      judges: [{ id: 'j1', first_name: 'Sin', last_name: 'Co', email: 'c@x.com' }],
      teams: [{ id: 't1', name: 'T1', category: 'beginner', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({
      panels: [panel],
      externalIdByUserId: new Map([['j1', 'EXT-9']]),
      companyByUserId: new Map([['j1', null]]),
    });

    expect(result[0].rows[0].judgeId).toBe('EXT-9');
    expect(result[0].rows[0].company).toBe('');
  });

  it('categoría vacía: senior sin jueces no se incluye', () => {
    const panel = makePanel({
      id: 'p1',
      judges: [{ id: 'j1', first_name: 'A', last_name: 'B', email: 'a@x.com' }],
      teams: [{ id: 't1', name: 'T1', category: 'beginner', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({ panels: [panel], ...emptyMaps });

    expect(result.map(c => c.category)).toEqual(['beginner']);
    expect(result.find(c => c.category === 'senior')).toBeUndefined();
  });

  it('orden: jueces ASC por nombre, equipos ASC por display_order', () => {
    const panel = makePanel({
      id: 'p1',
      judges: [
        { id: 'jZ', first_name: 'Zoe', last_name: 'X', email: 'z@x.com' },
        { id: 'jA', first_name: 'Ana', last_name: 'X', email: 'a@x.com' },
        { id: 'jM', first_name: 'María', last_name: 'X', email: 'm@x.com' },
      ],
      teams: [
        { id: 't3', name: 'C', category: 'beginner', display_order: 5 },
        { id: 't1', name: 'A', category: 'beginner', display_order: 1 },
        { id: 't2', name: 'B', category: 'beginner', display_order: 3 },
      ],
    });

    const result = buildJudgeRowsByCategory({ panels: [panel], ...emptyMaps });

    expect(result[0].rows.map(r => r.name)).toEqual(['Ana X', 'María X', 'Zoe X']);
    expect(result[0].rows[0].assignedTeams).toBe('A;B;C');
  });

  it('normaliza categorías capitalize (Beginner/Junior/Senior) — escenario de prod', () => {
    const beginner = makePanel({
      id: 'pB',
      turn: 'morning',
      judges: [{ id: 'jB', first_name: 'Bea', last_name: 'B', email: 'b@x.com' }],
      teams: [{ id: 'tB', name: 'TB', category: 'Beginner', display_order: 0 }],
    });
    const junior = makePanel({
      id: 'pJ',
      turn: 'morning',
      judges: [{ id: 'jJ', first_name: 'Jul', last_name: 'J', email: 'j@x.com' }],
      teams: [{ id: 'tJ', name: 'TJ', category: 'Junior', display_order: 0 }],
    });
    const senior = makePanel({
      id: 'pS',
      turn: 'morning',
      judges: [{ id: 'jS', first_name: 'Sam', last_name: 'S', email: 's@x.com' }],
      teams: [{ id: 'tS', name: 'TS', category: 'Senior', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({
      panels: [beginner, junior, senior],
      ...emptyMaps,
    });

    expect(result.map(c => c.category)).toEqual(['beginner', 'junior', 'senior']);
    expect(result.find(c => c.category === 'beginner')!.rows).toHaveLength(1);
    expect(result.find(c => c.category === 'junior')!.rows).toHaveLength(1);
    expect(result.find(c => c.category === 'senior')!.rows).toHaveLength(1);
  });

  it('mezcla capitalize + lowercase en mismo evento se agrupa correctamente', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cap1 = makePanel({
      id: 'pCap1',
      turn: 'morning',
      judges: [{ id: 'j1', first_name: 'A', last_name: '1', email: 'a1@x.com' }],
      teams: [{ id: 't1', name: 'T1', category: 'Beginner', display_order: 0 }],
    });
    const cap2 = makePanel({
      id: 'pCap2',
      turn: 'morning',
      judges: [{ id: 'j2', first_name: 'B', last_name: '2', email: 'b2@x.com' }],
      teams: [{ id: 't2', name: 'T2', category: 'Beginner', display_order: 0 }],
    });
    const low = makePanel({
      id: 'pLow',
      turn: 'morning',
      judges: [{ id: 'j3', first_name: 'C', last_name: '3', email: 'c3@x.com' }],
      teams: [{ id: 't3', name: 'T3', category: 'beginner', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({
      panels: [cap1, cap2, low],
      ...emptyMaps,
    });

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('beginner');
    expect(result[0].rows).toHaveLength(3);
    expect(
      warnSpy.mock.calls.some(args =>
        typeof args[0] === 'string' && args[0].includes('tiene categorías mezcladas'),
      ),
    ).toBe(false);
  });

  it('categoría desconocida: panel descartado y warn emitido', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unknown = makePanel({
      id: 'pUnk',
      turn: 'morning',
      judges: [{ id: 'jU', first_name: 'U', last_name: 'N', email: 'u@x.com' }],
      teams: [{ id: 'tU', name: 'TU', category: 'None assigned yet', display_order: 0 }],
    });
    const valid = makePanel({
      id: 'pOk',
      turn: 'morning',
      judges: [{ id: 'jOk', first_name: 'O', last_name: 'K', email: 'ok@x.com' }],
      teams: [{ id: 'tOk', name: 'TOk', category: 'beginner', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({
      panels: [unknown, valid],
      ...emptyMaps,
    });

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('beginner');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /Categoría desconocida "None assigned yet" en panel JUECES pUnk/,
      ),
    );
  });

  it('múltiples paneles desconocidos no afectan a los válidos', () => {
    const u1 = makePanel({
      id: 'pu1',
      turn: 'morning',
      judges: [{ id: 'ju1', first_name: 'X', last_name: '1', email: 'x1@x.com' }],
      teams: [{ id: 'tu1', name: 'TU1', category: 'None assigned yet', display_order: 0 }],
    });
    const u2 = makePanel({
      id: 'pu2',
      turn: 'morning',
      judges: [{ id: 'ju2', first_name: 'X', last_name: '2', email: 'x2@x.com' }],
      teams: [{ id: 'tu2', name: 'TU2', category: 'WeirdCat', display_order: 0 }],
    });
    const u3 = makePanel({
      id: 'pu3',
      turn: 'morning',
      judges: [{ id: 'ju3', first_name: 'X', last_name: '3', email: 'x3@x.com' }],
      teams: [{ id: 'tu3', name: 'TU3', category: 'unknown', display_order: 0 }],
    });
    const v1 = makePanel({
      id: 'pv1',
      turn: 'morning',
      judges: [{ id: 'jv1', first_name: 'V', last_name: '1', email: 'v1@x.com' }],
      teams: [{ id: 'tv1', name: 'TV1', category: 'Junior', display_order: 0 }],
    });
    const v2 = makePanel({
      id: 'pv2',
      turn: 'morning',
      judges: [{ id: 'jv2', first_name: 'V', last_name: '2', email: 'v2@x.com' }],
      teams: [{ id: 'tv2', name: 'TV2', category: 'junior', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({
      panels: [u1, u2, u3, v1, v2],
      ...emptyMaps,
    });

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('junior');
    expect(result[0].rows).toHaveLength(2);
    expect(result[0].rows.map(r => r.name).sort()).toEqual(['V 1', 'V 2']);
  });

  it('category null/empty: panel descartado sin warn (caso legítimo)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Cast a `string`/`unknown as string` necesario porque `PanelWithRelations.teams.category`
    // está tipado como `TeamCategory` no-nullable, mientras que la columna `teams.category`
    // en DB es `text` nullable. Reproducimos el caso real de prod.
    const nullPanel = makePanel({
      id: 'pNull',
      turn: 'morning',
      judges: [{ id: 'jn', first_name: 'N', last_name: 'L', email: 'n@x.com' }],
      teams: [{ id: 'tn', name: 'TN', category: null as unknown as string, display_order: 0 }],
    });
    const emptyPanel = makePanel({
      id: 'pEmpty',
      turn: 'morning',
      judges: [{ id: 'je', first_name: 'E', last_name: 'M', email: 'e@x.com' }],
      teams: [{ id: 'te', name: 'TE', category: '', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({
      panels: [nullPanel, emptyPanel],
      ...emptyMaps,
    });

    expect(result).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('panel canonicalizado con equipo unknown intercalado: warn de contaminación', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const panel = makePanel({
      id: 'pMix',
      turn: 'morning',
      judges: [{ id: 'jM', first_name: 'M', last_name: 'X', email: 'm@x.com' }],
      teams: [
        { id: 'tA', name: 'TA', category: 'Beginner', display_order: 0 },
        { id: 'tB', name: 'TB', category: 'None assigned yet', display_order: 1 },
        { id: 'tC', name: 'TC', category: 'Beginner', display_order: 2 },
      ],
    });

    const result = buildJudgeRowsByCategory({ panels: [panel], ...emptyMaps });

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('beginner');
    expect(result[0].rows).toHaveLength(1);
    expect(result[0].rows[0].assignedTeams).toBe('TA;TB;TC');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /Panel JUECES pMix contiene equipos con categoría desconocida — incluidos en la export como "beginner"/,
      ),
    );
    // No debe disparar el warn de "categorías mezcladas" (eso es para mezclas válidas).
    expect(
      warnSpy.mock.calls.some(args =>
        typeof args[0] === 'string' && args[0].includes('tiene categorías mezcladas'),
      ),
    ).toBe(false);
  });

  it('whitespace en categoría se trata como desconocido (decisión deliberada: sin trim)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const panel = makePanel({
      id: 'pWs',
      turn: 'morning',
      judges: [{ id: 'jW', first_name: 'W', last_name: 'S', email: 'w@x.com' }],
      teams: [{ id: 'tW', name: 'TW', category: ' Beginner', display_order: 0 }],
    });

    const result = buildJudgeRowsByCategory({ panels: [panel], ...emptyMaps });

    expect(result).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Categoría desconocida " Beginner"/),
    );
  });
});

describe('generateTechnovationGlobalJudgesZip', () => {
  it('genera filenames con categoría capitalizada y turno en español (invariante load-bearing)', async () => {
    const blob = await generateTechnovationGlobalJudgesZip([
      { category: 'beginner', turn: 'morning', rows: [] },
      { category: 'junior', turn: 'afternoon', rows: [] },
      { category: 'senior', turn: 'morning', rows: [] },
    ]);

    const zip = await JSZip.loadAsync(blob);
    const names = Object.keys(zip.files).sort();

    expect(names).toEqual([
      'Madrid Beginner - Turno mañana.xlsx',
      'Madrid Junior - Turno tarde.xlsx',
      'Madrid Senior - Turno mañana.xlsx',
    ]);
  });
});
