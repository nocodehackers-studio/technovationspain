import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { PanelWithRelations } from '@/hooks/useJudgingAssignment';
import type { TeamCategory } from '@/types/database';

export interface BuildInput {
  panels: PanelWithRelations[];
  externalIdByUserId: Map<string, string | null>;
  companyByUserId: Map<string, string | null>;
}

export interface JudgeRow {
  name: string;
  email: string;
  judgeId: string;
  company: string;
  numberOfAssignedTeams: number;
  assignedTeams: string;
}

export interface CategoryExport {
  category: TeamCategory;
  turn: 'morning' | 'afternoon';
  rows: JudgeRow[];
}

const CATEGORY_ORDER: TeamCategory[] = ['beginner', 'junior', 'senior'];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildJudgeRowsByCategory(input: BuildInput): CategoryExport[] {
  const { panels, externalIdByUserId, companyByUserId } = input;

  const rowsByCategory = new Map<TeamCategory, JudgeRow[]>();
  const turnsByCategory = new Map<TeamCategory, ('morning' | 'afternoon')[]>();

  for (const panel of panels) {
    const activeTeams = (panel.judging_panel_teams || []).filter(t => t.is_active);
    if (activeTeams.length === 0) continue;

    // Concatenate subsessions then sort by display_order within each (per spec).
    const sortedTeams = [...activeTeams].sort((a, b) => {
      if (a.subsession !== b.subsession) return a.subsession - b.subsession;
      return a.display_order - b.display_order;
    });

    const panelCategory = sortedTeams[0].teams?.category as TeamCategory | undefined;
    if (!panelCategory) continue;

    // Defensive: warn if a panel has mixed categories (algorithm invariant says it shouldn't).
    const distinctCategories = new Set(
      sortedTeams.map(t => t.teams?.category).filter(Boolean),
    );
    if (distinctCategories.size > 1) {
      console.warn(
        `[exportTechnovationGlobalJudges] Panel ${panel.panel_code} tiene categorías mezcladas (${[...distinctCategories].join(', ')}). Usando "${panelCategory}".`,
      );
    }
    const teamNames = sortedTeams
      .map(t => t.teams?.name || '')
      .filter(n => n.length > 0);
    const assignedTeams = teamNames.join(';');
    const numberOfAssignedTeams = teamNames.length;

    const activeJudges = (panel.judging_panel_judges || []).filter(pj => pj.is_active);

    for (const pj of activeJudges) {
      const profile = pj.profiles;
      if (!profile) continue;

      const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      const row: JudgeRow = {
        name,
        email: profile.email,
        judgeId: externalIdByUserId.get(profile.id) ?? '',
        company: companyByUserId.get(profile.id) ?? '',
        numberOfAssignedTeams,
        assignedTeams,
      };

      const existing = rowsByCategory.get(panelCategory) || [];
      existing.push(row);
      rowsByCategory.set(panelCategory, existing);

      const turns = turnsByCategory.get(panelCategory) || [];
      turns.push(panel.turn);
      turnsByCategory.set(panelCategory, turns);
    }
  }

  const result: CategoryExport[] = [];
  for (const category of CATEGORY_ORDER) {
    const rows = rowsByCategory.get(category);
    if (!rows || rows.length === 0) continue;

    const turns = turnsByCategory.get(category) || [];
    const morningCount = turns.filter(t => t === 'morning').length;
    const afternoonCount = turns.filter(t => t === 'afternoon').length;
    const turn: 'morning' | 'afternoon' =
      morningCount >= afternoonCount ? 'morning' : 'afternoon';
    if (morningCount > 0 && afternoonCount > 0) {
      console.warn(
        `[exportTechnovationGlobalJudges] Categoría ${category} tiene paneles en ambos turnos (${morningCount} mañana / ${afternoonCount} tarde). Usando "${turn}".`,
      );
    }

    rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    result.push({ category, turn, rows });
  }

  return result;
}

export async function generateTechnovationGlobalJudgesZip(
  exports: CategoryExport[],
  hubLabel: string = 'Madrid',
): Promise<Blob> {
  const zip = new JSZip();

  for (const exp of exports) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Judges');

    ws.columns = [
      { header: 'Name', key: 'name', width: 28 },
      { header: 'Email', key: 'email', width: 36 },
      { header: 'Judge ID', key: 'judgeId', width: 12 },
      { header: 'Company', key: 'company', width: 24 },
      { header: 'Number of asigned teams', key: 'numberOfAssignedTeams', width: 10 },
      { header: 'Asigned teams', key: 'assignedTeams', width: 60 },
    ];

    for (const row of exp.rows) {
      ws.addRow({
        name: row.name,
        email: row.email,
        judgeId: row.judgeId,
        company: row.company,
        numberOfAssignedTeams: row.numberOfAssignedTeams,
        assignedTeams: row.assignedTeams,
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    const turnLabel = exp.turn === 'morning' ? 'mañana' : 'tarde';
    const filename = `${hubLabel} ${capitalize(exp.category)} - Turno ${turnLabel}.xlsx`;
    zip.file(filename, buf as unknown as Uint8Array);
  }

  return await zip.generateAsync({ type: 'blob' });
}
