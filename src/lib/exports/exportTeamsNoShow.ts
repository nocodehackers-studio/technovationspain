export interface TeamNoShowRow {
  teamCode: string;
  name: string;
  category: string;
  turn: string;
  hubName?: string;
  sessionNumber?: number;
  roomNumber?: number;
  panelCode?: string;
  notArrivedAt: string;
  notArrivedByName?: string;
}

export function exportTeamsNoShowCSV(rows: TeamNoShowRow[], eventLabel?: string): void {
  const headers = [
    'Código',
    'Equipo',
    'Categoría',
    'Turno',
    'Hub',
    'Sesión',
    'Aula',
    'Panel',
    'Marcado a las',
    'Marcado por',
  ];

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const dataRows = rows.map(r => [
    r.teamCode,
    r.name,
    r.category,
    r.turn,
    r.hubName ?? '',
    r.sessionNumber != null ? String(r.sessionNumber) : '',
    r.roomNumber != null ? String(r.roomNumber) : '',
    r.panelCode ?? '',
    formatDateTime(r.notArrivedAt),
    r.notArrivedByName ?? '',
  ]);

  const csv =
    '﻿' +
    [headers, ...dataRows].map(r => r.map(escape).join(';')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const slug = eventLabel
    ? eventLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : 'evento';
  a.href = url;
  a.download = `equipos-no-llegados-${slug}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
