import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingPage } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  // Capture role from URL params (passed from registration flow)
  const roleFromUrl = searchParams.get('role');

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
          // Check if user has completed onboarding
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name, date_of_birth, onboarding_completed')
            .eq('id', data.session.user.id)
            .maybeSingle();

          // Profile doesn't exist or onboarding not completed
          const needsOnboarding = !profile || 
            !profile.onboarding_completed || 
            !profile.first_name || 
            !profile.last_name || 
            !profile.date_of_birth;

          if (needsOnboarding) {
            // Preserve role param when redirecting to onboarding
            const onboardingUrl = roleFromUrl 
              ? `/onboarding?role=${roleFromUrl}` 
              : '/onboarding';
            navigate(onboardingUrl, { replace: true });
            return;
          }

          // Check user role for proper redirect - prioritize admin
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', data.session.user.id);

          type AppRole = 'admin' | 'mentor' | 'judge' | 'volunteer' | 'participant';
          const rolePriority: AppRole[] = ['admin', 'mentor', 'judge', 'volunteer', 'participant'];
          const userRoles = (rolesData?.map(r => r.role) || []) as AppRole[];
          const highestRole = rolePriority.find(r => userRoles.includes(r));

          if (highestRole === 'admin') {
            navigate('/admin', { replace: true });
          } else if (highestRole === 'volunteer') {
            navigate('/voluntario/dashboard', { replace: true });
          } else if (highestRole === 'mentor') {
            navigate('/mentor/dashboard', { replace: true });
          } else {
            // Redirect to dashboard for participants and judges
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