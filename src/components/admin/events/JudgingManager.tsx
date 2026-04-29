import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shuffle, Calendar, AlertTriangle, Gavel, Download } from 'lucide-react';
import { useJudgingConfig } from '@/hooks/useJudgingConfig';
import { useEventJudges } from '@/hooks/useEventJudges';
import { useJudgingAssignment } from '@/hooks/useJudgingAssignment';
import { useToast } from '@/hooks/use-toast';
import {
  buildJudgeRowsByCategory,
  generateTechnovationGlobalJudgesZip,
} from '@/lib/exports/exportTechnovationGlobalJudges';
import { JudgingConfigForm } from './JudgingConfigForm';
import { JudgingSchedulePreview } from './JudgingSchedulePreview';

interface JudgingManagerProps {
  eventId: string;
}

export function JudgingManager({ eventId }: JudgingManagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    config,
    isLoading: configLoading,
    createConfig,
    updateConfig,
    isCreating,
    isUpdating,
  } = useJudgingConfig(eventId);

  const { readyJudges, pendingJudges, isLoading: judgesLoading } = useEventJudges(eventId);
  const { assignments } = useJudgingAssignment(eventId);
  const [isExporting, setIsExporting] = useState(false);

  // Get distinct turns from imported teams
  const { data: activeTurns = [] } = useQuery({
    queryKey: ['event-teams-turns', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_teams')
        .select('turn')
        .eq('event_id', eventId!);
      if (error) throw error;
      const turns = [...new Set((data || []).map(d => d.turn))] as ('morning' | 'afternoon')[];
      return turns.sort((a, b) => (a === 'morning' ? -1 : 1));
    },
    enabled: !!eventId,
  });

  const numberOfTurns = activeTurns.length || 1;
  const totalPanels = config
    ? config.total_rooms * config.sessions_per_turn * numberOfTurns
    : 0;
  const neededJudges = totalPanels * (config?.judges_per_group || 6);
  const hasEnoughJudges = readyJudges.length >= neededJudges;

  // Fetch judge_access_enabled + event_type + name from DB
  const { data: eventData } = useQuery({
    queryKey: ['event-judge-access', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('judge_access_enabled, event_type, name')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const judgeAccessEnabled = eventData?.judge_access_enabled ?? false;

  // Toggle judge access and send welcome emails when enabling
  const toggleJudgeAccess = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('events')
        .update({ judge_access_enabled: enabled })
        .eq('id', eventId);
      if (error) throw error;

      // When enabling, send welcome emails to onboarded judges who haven't been emailed yet
      if (enabled) {
        const { data: judges, error: judgesError } = await supabase
          .from('judge_assignments')
          .select('id, user_id, profiles!inner(email, first_name)')
          .eq('event_id', eventId)
          .eq('onboarding_completed', true)
          .is('welcome_email_sent_at', null);
        if (judgesError) throw judgesError;

        // Batch send emails and mark as sent
        const emailPromises = (judges || []).map(async (judge: any) => {
          try {
            const { error: invokeError } = await supabase.functions.invoke('send-judge-event-email', {
              body: {
                email: judge.profiles.email,
                firstName: judge.profiles.first_name,
                eventId,
              },
            });
            if (invokeError) throw invokeError;
            // Mark this judge as emailed only on success
            await supabase
              .from('judge_assignments')
              .update({ welcome_email_sent_at: new Date().toISOString() })
              .eq('id', judge.id);
          } catch (err: any) {
            console.error('Judge email error:', err);
          }
        });
        await Promise.allSettled(emailPromises);
      }
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['event-judge-access', eventId] });
      toast({
        title: enabled ? 'Acceso habilitado' : 'Acceso deshabilitado',
        description: enabled
          ? 'Los jueces pueden acceder a la plataforma. Se han enviado los correos de bienvenida.'
          : 'Los jueces ya no pueden acceder a la plataforma.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el acceso de jueces.',
        variant: 'destructive',
      });
    },
  });

  const handleExportTechnovationGlobal = async () => {
    setIsExporting(true);
    try {
      const { data: auxData, error: auxErr } = await supabase
        .from('judge_assignments')
        .select('user_id, external_judge_id, profiles:user_id(company_name, judge_excluded)')
        .eq('event_id', eventId)
        .eq('is_active', true);
      if (auxErr) throw auxErr;

      const externalIdByUserId = new Map<string, string | null>();
      const companyByUserId = new Map<string, string | null>();
      const excludedUserIds = new Set<string>();
      for (const r of auxData || []) {
        const profile = r.profiles as { company_name: string | null; judge_excluded: boolean } | null;
        externalIdByUserId.set(r.user_id, r.external_judge_id ?? null);
        companyByUserId.set(r.user_id, profile?.company_name ?? null);
        if (profile?.judge_excluded) excludedUserIds.add(r.user_id);
      }

      const filteredPanels = assignments.map(panel => ({
        ...panel,
        judging_panel_judges: panel.judging_panel_judges.filter(pj =>
          externalIdByUserId.has(pj.judge_id) && !excludedUserIds.has(pj.judge_id)
        ),
      }));

      const exports = buildJudgeRowsByCategory({
        panels: filteredPanels,
        externalIdByUserId,
        companyByUserId,
      });

      if (exports.length === 0) {
        toast({
          title: 'Sin jueces para exportar',
          description: 'No hay jueces activos asignados a paneles en este evento.',
        });
        return;
      }

      // TODO: parametrizar hub cuando haya más sedes (events.hub_id → hubs.name)
      const blob = await generateTechnovationGlobalJudgesZip(exports, 'Madrid');

      const eventName = eventData?.name || 'evento';
      const slug = eventName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'evento';
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const filename = `jueces-technovation-${slug}-${today}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err: any) {
      console.error('Export Technovation Global error:', err);
      toast({
        title: 'Error al exportar',
        description: err.message || 'No se pudo generar el ZIP de jueces.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Config — collapses when saved */}
      <JudgingConfigForm
        config={config}
        isLoading={configLoading}
        onSave={createConfig}
        onUpdate={updateConfig}
        isSaving={isCreating || isUpdating}
        activeTurns={activeTurns}
      />

      {/* Status bar + Actions — single row */}
      {config && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Stats inline */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Jueces:</span>
                  <span className="font-bold">{readyJudges.length}</span>
                  <span className="text-muted-foreground">/ {neededJudges}</span>
                  {pendingJudges.length > 0 && (
                    <Badge variant="outline" className="text-xs ml-1">{pendingJudges.length} pendientes</Badge>
                  )}
                  {!hasEnoughJudges && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
                <span className="text-muted-foreground">|</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Paneles:</span>
                  <span className="font-bold">{totalPanels}</span>
                </div>
                <span className="text-muted-foreground">|</span>
                <div className="flex items-center gap-1.5">
                  {!config.algorithm_run_at ? (
                    <Badge variant="secondary" className="text-xs">Sin asignar</Badge>
                  ) : (
                    <>
                      <Badge className="bg-green-100 text-green-800 text-xs">Asignado</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(config.algorithm_run_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate(`/admin/events/${eventId}/judging/assign`)}
                >
                  <Shuffle className="h-3.5 w-3.5 mr-1.5" />
                  Asignación
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/events/${eventId}/judging/schedule`)}
                  disabled={!config.algorithm_run_at}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  Escaleta
                </Button>
                {eventData?.event_type === 'regional_final' && config?.algorithm_run_at && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportTechnovationGlobal}
                    disabled={isExporting}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {isExporting ? 'Generando...' : 'Exportar Technovation Global'}
                  </Button>
                )}
              </div>
            </div>

            {/* Warning inline */}
            {!hasEnoughJudges && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded mt-3 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                Faltan {neededJudges - readyJudges.length} jueces para cubrir todos los paneles.
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Schedule preview — read-only */}
      {config?.algorithm_run_at && (
        <JudgingSchedulePreview eventId={eventId} />
      )}
    </div>
  );
}
