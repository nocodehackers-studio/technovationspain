import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, Mail, CheckCircle2 } from 'lucide-react';
import { LoadingPage } from '@/components/ui/loading-spinner';

export default function PendingVerification() {
  const navigate = useNavigate();
  const { profile, isLoading, signOut, isVerified } = useAuth();

  // Redirect if already verified
  if (!isLoading && isVerified) {
    navigate('/events', { replace: true });
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
      <Card className="w-full max-w-lg border-warning/20 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center">
            <Clock className="h-10 w-10 text-warning" />
          </div>
          <CardTitle className="text-2xl">Verificación pendiente</CardTitle>
          <CardDescription className="text-base">
            Tu cuenta está siendo revisada por nuestro equipo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              ¿Por qué necesito verificación?
            </h4>
            <p className="text-sm text-muted-foreground">
              Para garantizar la seguridad de todos los participantes, verificamos que cada cuenta 
              esté asociada con un registro válido en Technovation Global.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              ¿Qué debo hacer?
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Asegúrate de haber completado tu registro en Technovation Global</li>
              <li>• Espera mientras nuestro equipo valida tu información</li>
              <li>• Recibirás un email cuando tu cuenta sea verificada</li>
            </ul>
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
