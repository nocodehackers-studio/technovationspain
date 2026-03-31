import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shuffle, Calendar, AlertTriangle, Gavel } from 'lucide-react';
import { useJudgingConfig } from '@/hooks/useJudgingConfig';
import { useEventJudges } from '@/hooks/useEventJudges';
import { useToast } from '@/hooks/use-toast';
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

  // Fetch judge_access_enabled from DB
  const { data: eventData } = useQuery({
    queryKey: ['event-judge-access', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('judge_access_enabled')
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
            const { error: invokeError } = await supabase.functions.invoke('send-judge-welcome-email', {
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

  return (
    <div className="space-y-4">
      {/* Judge Access Toggle — compact */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <Gavel className="h-4 w-4 text-muted-foreground" />
          <div>
            <Label htmlFor="judge-access" className="font-medium text-sm cursor-pointer">Acceso de jueces</Label>
            <p className="text-xs text-muted-foreground">
              {judgeAccessEnabled
                ? 'Registro abierto — los jueces pueden completar onboarding y obtener entrada.'
                : 'Registro cerrado.'}
            </p>
          </div>
        </div>
        <Switch
          id="judge-access"
          checked={judgeAccessEnabled}
          onCheckedChange={(checked) => toggleJudgeAccess.mutate(checked)}
          disabled={toggleJudgeAccess.isPending}
        />
      </div>

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
