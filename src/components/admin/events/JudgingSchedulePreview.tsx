import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useJudgingAssignment } from '@/hooks/useJudgingAssignment';
import { useJudgingConfig } from '@/hooks/useJudgingConfig';

interface JudgingSchedulePreviewProps {
  eventId: string;
}

const catColors: Record<string, string> = {
  senior: 'bg-green-100 text-green-800 border-green-300',
  junior: 'bg-blue-100 text-blue-800 border-blue-300',
  beginner: 'bg-amber-100 text-amber-800 border-amber-300',
};

export function JudgingSchedulePreview({ eventId }: JudgingSchedulePreviewProps) {
  const { config } = useJudgingConfig(eventId);
  const { assignments, isLoading } = useJudgingAssignment(eventId);

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" />;
  }

  if (assignments.length === 0) return null;

  const panels = [...assignments].sort(
    (a, b) => a.session_number - b.session_number || a.room_number - b.room_number
  );

  const sessions = Array.from(new Set(panels.map(p => p.session_number))).sort();
  const maxRoom = Math.max(...panels.map(p => p.room_number), config?.total_rooms || 1);
  const allRooms = Array.from({ length: maxRoom }, (_, i) => i + 1);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-green-600 text-white">
            <th className="px-3 py-1.5 text-left w-[100px] border-r border-green-500 sticky left-0 bg-green-600 z-20" />
            {allRooms.map(room => (
              <th key={room} className="px-3 py-1.5 text-center font-semibold border-l border-green-500 min-w-[160px]">
                Aula {room}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(session => {
            const sessionPanels = panels.filter(p => p.session_number === session);
            const isMorning = session <= (config?.sessions_per_turn || 2);
            const isFirstOfTurn = isMorning ? session === 1 : session === (config?.sessions_per_turn || 2) + 1;
            const turnLabel = isMorning ? 'TURNO MAÑANA' : 'TURNO TARDE';

            const maxSub1 = Math.max(
              ...sessionPanels.map(p =>
                (p.judging_panel_teams || []).filter(t => t.subsession === 1 && t.is_active).length
              ), 0
            );
            const maxSub2 = Math.max(
              ...sessionPanels.map(p =>
                (p.judging_panel_teams || []).filter(t => t.subsession === 2 && t.is_active).length
              ), 0
            );

            return (
              <React.Fragment key={session}>
                {isFirstOfTurn && (
                  <tr>
                    <td colSpan={allRooms.length + 1} className="bg-green-700 text-white px-3 py-1.5 font-bold text-xs">
                      {turnLabel}
                    </td>
                  </tr>
                )}

                {/* Panel codes */}
                <tr className="bg-green-50 border-b border-t-2 border-green-300">
                  <td className="px-3 py-1 font-bold sticky left-0 bg-green-50 z-10 border-r text-[11px]">
                    Sesión {session}
                  </td>
                  {allRooms.map(room => {
                    const panel = sessionPanels.find(p => p.room_number === room);
                    return (
                      <td key={room} className="px-3 py-1 text-center font-bold border-l text-[11px]">
                        {panel?.panel_code || ''}
                      </td>
                    );
                  })}
                </tr>

                {/* Subsession 1 */}
                {Array.from({ length: Math.max(maxSub1, 1) }, (_, rowIdx) => (
                  <tr key={`s${session}-a-${rowIdx}`} className="border-b">
                    {rowIdx === 0 && (
                      <td rowSpan={Math.max(maxSub1, 1)} className="px-2 py-0.5 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[10px]">
                        Sub 1
                      </td>
                    )}
                    {allRooms.map(room => {
                      const panel = sessionPanels.find(p => p.room_number === room);
                      if (!panel) return <td key={room} className="border-l" />;
                      const teams = (panel.judging_panel_teams || []).filter(t => t.subsession === 1 && t.is_active);
                      const team = teams[rowIdx];
                      if (!team) return <td key={room} className="border-l" />;
                      return (
                        <td key={room} className="px-1.5 py-0.5 border-l">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`font-mono text-[9px] px-1 py-0 shrink-0 ${catColors[team.teams?.category || ''] || ''}`}>
                              {team.team_code}
                            </Badge>
                            <span className="truncate text-[11px]">{team.teams?.name}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Separator */}
                <tr className="border-b-2 border-green-200">
                  <td colSpan={allRooms.length + 1} className="h-px bg-green-100" />
                </tr>

                {/* Subsession 2 */}
                {Array.from({ length: Math.max(maxSub2, 1) }, (_, rowIdx) => (
                  <tr key={`s${session}-b-${rowIdx}`} className="border-b">
                    {rowIdx === 0 && (
                      <td rowSpan={Math.max(maxSub2, 1)} className="px-2 py-0.5 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[10px]">
                        Sub 2
                      </td>
                    )}
                    {allRooms.map(room => {
                      const panel = sessionPanels.find(p => p.room_number === room);
                      if (!panel) return <td key={room} className="border-l" />;
                      const teams = (panel.judging_panel_teams || []).filter(t => t.subsession === 2 && t.is_active);
                      const team = teams[rowIdx];
                      if (!team) return <td key={room} className="border-l" />;
                      return (
                        <td key={room} className="px-1.5 py-0.5 border-l">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`font-mono text-[9px] px-1 py-0 shrink-0 ${catColors[team.teams?.category || ''] || ''}`}>
                              {team.team_code}
                            </Badge>
                            <span className="truncate text-[11px]">{team.teams?.name}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Gap */}
                <tr><td colSpan={allRooms.length + 1} className="h-2" /></tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
