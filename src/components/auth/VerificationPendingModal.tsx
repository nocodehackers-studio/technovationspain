import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Mail, LogOut, Timer } from 'lucide-react';

export function VerificationPendingModal() {
  const { profile, isVerified, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show modal if user has completed onboarding but is not verified
    if (!isLoading && profile?.onboarding_completed && !isVerified) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [profile, isVerified, isLoading]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Don't render anything if loading or verified
  if (isLoading || isVerified || !profile?.onboarding_completed) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <DialogTitle className="text-xl font-display">
            Verificación pendiente
          </DialogTitle>
          <DialogDescription className="text-base space-y-4">
            <p>
              Tu cuenta está siendo verificada. Para acceder a todas las funcionalidades, 
              necesitamos validar tu registro con <strong>Technovation Global</strong>.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">¿Por qué necesitamos verificarte?</p>
                <p className="text-muted-foreground mt-1">
                  Para garantizar la seguridad de todas las participantes, verificamos que todos los 
                  usuarios estén registrados en Technovation Global.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">¿Qué debo hacer?</p>
                <ul className="text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                  <li>
                    Asegúrate de estar registrada en{' '}
                    <a 
                      href="https://technovationchallenge.org" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Technovation Global
                    </a>
                  </li>
                  <li>
                    Usa el <strong>mismo email</strong> que usaste aquí para registrarte en Technovation Global
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-secondary/20 bg-secondary/5 p-4">
            <div className="flex items-start gap-3">
              <Timer className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Tiempo de espera</p>
                <p className="text-muted-foreground mt-1">
                  <strong>Este proceso puede durar hasta 24 horas.</strong> Recibirás un correo 
                  de confirmación cuando tu cuenta esté activa.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Si tienes dudas, contacta con nosotros en{' '}
            <a href="mailto:soporte@powertocode.org" className="text-primary hover:underline">
              soporte@powertocode.org
            </a>
          </p>
        </div>

        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}