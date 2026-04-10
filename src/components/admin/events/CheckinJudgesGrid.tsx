import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useJudgingAssignment } from '@/hooks/useJudgingAssignment';
import { useJudgingConfig } from '@/hooks/useJudgingConfig';

interface CheckinJudgesGridProps {
  eventId: string;
  checkedInUserIds: Set<string>;
}

export function CheckinJudgesGrid({ eventId, checkedInUserIds }: CheckinJudgesGridProps) {
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

            // Count max judges per room in this session
            const maxJudges = Math.max(
              ...sessionPanels.map(p =>
                (p.judging_panel_judges || []).length
              ), 1
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

                {/* Judges rows */}
                {Array.from({ length: maxJudges }, (_, rowIdx) => (
                  <tr key={`s${session}-j-${rowIdx}`} className="border-b">
                    {rowIdx === 0 && (
                      <td rowSpan={maxJudges} className="px-2 py-0.5 text-muted-foreground font-medium sticky left-0 bg-white z-10 border-r align-top text-[10px]">
                        Jueces
                      </td>
                    )}
                    {allRooms.map(room => {
                      const panel = sessionPanels.find(p => p.room_number === room);
                      if (!panel) return <td key={room} className="border-l" />;
                      const judges = panel.judging_panel_judges || [];
                      const judge = judges[rowIdx];
                      if (!judge) return <td key={room} className="border-l" />;

                      const profile = judge.profiles as { id: string; first_name: string | null; last_name: string | null; email: string; hub_id: string | null } | null;
                      const judgeId = judge.judge_id;
                      const isCheckedIn = checkedInUserIds.has(judgeId);
                      const name = profile
                        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                        : 'Sin nombre';

                      return (
                        <td key={room} className={`px-1.5 py-0.5 border-l ${isCheckedIn ? 'bg-green-600' : ''}`}>
                          <span className={`truncate text-[11px] ${isCheckedIn ? 'text-white font-medium' : 'text-muted-foreground'}`}>
                            {isCheckedIn ? '✓ ' : ''}{name}
                          </span>
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
