import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { hasMissingFields } from '@/lib/profile-fields';
import { LoadingPage } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          setError(error.message);
          return;
        }

        if (data.session) {
          // Fetch profile with all fields needed for routing decisions
          const { data: profile } = await supabase
            .from('profiles')
            .select('*, terms_accepted_at, verification_status')
            .eq('id', data.session.user.id)
            .maybeSingle();

          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', data.session.user.id);

          const isVerified = profile?.verification_status === 'verified';

          // Priority: admin → !verified → !consent → missing fields → role dashboard
          type AppRole = 'admin' | 'chapter_ambassador' | 'mentor' | 'judge' | 'participant';
          const rolePriority: AppRole[] = ['admin', 'chapter_ambassador', 'mentor', 'judge', 'participant'];
          const userRoles = (rolesData?.map(r => r.role) || []) as AppRole[];
          const highestRole = rolePriority.find(r => userRoles.includes(r));

          if (highestRole === 'admin') {
            navigate('/admin', { replace: true });
          } else if (!isVerified) {
            navigate('/pending-verification', { replace: true });
          } else if (!profile?.terms_accepted_at) {
            navigate('/onboarding', { replace: true });
          } else if (profile && hasMissingFields(profile as Record<string, unknown>)) {
            navigate('/onboarding', { replace: true });
          } else if (highestRole === 'mentor' || highestRole === 'chapter_ambassador') {
            navigate('/mentor/dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } else {
          setError('No se pudo verificar tu sesión. Por favor, intenta de nuevo.');
        }
      } catch (err) {
        console.error('Callback processing error:', err);
        setError('Ha ocurrido un error inesperado.');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
        <Card className="w-full max-w-md border-destructive/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Error de autenticación</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => navigate('/', { replace: true })}
            >
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <LoadingPage message="Verificando tu acceso..." />;
}
