import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';
import { LoadingPage } from '@/components/ui/loading-spinner';
import { getDashboardPath } from '@/lib/dashboard-routes';

export default function JudgePendingEvent() {
  const navigate = useNavigate();
  const { user, profile, isLoading, signOut, refreshProfile, role, judgeHasNoEvent } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll judge_assignments every 30s for new event assignment
  useEffect(() => {
    if (!user) return;

    const checkForEvent = async () => {
      const { data } = await supabase
        .from('judge_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .not('event_id', 'is', null)
        .limit(1);

      if (data && data.length > 0) {
        await refreshProfile();
        navigate(getDashboardPath(role), { replace: true });
      }
    };

    checkForEvent();
    intervalRef.current = setInterval(checkForEvent, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, refreshProfile, navigate, role]);

  // Redirect if judge already has an event
  if (!isLoading && !judgeHasNoEvent && user) {
    navigate(getDashboardPath(role), { replace: true });
    return null;
  }

  if (isLoading) {
    return <LoadingPage message="Verificando estado..." />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
      <Card className="w-full max-w-lg border-primary/20 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Registro completado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Gracias por completar tu registro como juez. Te notificaremos cuando puedas acceder al evento.
            </p>
          </div>

          {profile?.email && (
            <div className="text-center text-sm text-muted-foreground">
              Cuenta: <span className="font-medium">{profile.email}</span>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
