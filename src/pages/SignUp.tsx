import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Mail, Sparkles, ArrowRight, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Por favor, introduce un email válido');

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [understandsVerification, setUnderstandsVerification] = useState(false);
  const { toast } = useToast();

  const canSubmit = acceptedTerms && understandsVerification && email.trim().length > 0;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    if (!acceptedTerms) {
      setError('Debes aceptar los términos y condiciones');
      return;
    }

    if (!understandsVerification) {
      setError('Debes confirmar que entiendes el proceso de verificación');
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          setError('Has enviado demasiados enlaces. Por favor, espera unos minutos.');
        } else {
          setError(error.message);
        }
        return;
      }

      setEmailSent(true);
      toast({
        title: '¡Enlace enviado!',
        description: 'Revisa tu bandeja de entrada para completar el registro.',
      });
    } catch (err) {
      setError('Ha ocurrido un error. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
        <Card className="w-full max-w-md border-none shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-2xl font-display">¡Revisa tu email!</CardTitle>
            <CardDescription className="text-base">
              Hemos enviado un enlace de registro a <strong className="text-foreground">{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground space-y-2">
              <p>El enlace expirará en 1 hora. Si no lo recibes, revisa tu carpeta de spam.</p>
              <p className="font-medium text-foreground">
                Recuerda: después de registrarte, tu cuenta estará pendiente de verificación hasta que 
                validemos tu registro en Technovation Global.
              </p>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setEmailSent(false)}
            >
              Usar otro email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <span className="text-3xl font-display font-bold text-gradient-primary">
              Technovation
            </span>
          </div>
          <p className="text-muted-foreground">España</p>
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">Registro de Participante</CardTitle>
            <CardDescription>
              Crea tu cuenta para participar en Technovation España
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Important notice about verification */}
            <div className="rounded-lg border border-warning/50 bg-warning/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-semibold text-foreground">
                    Importante: Proceso de verificación
                  </p>
                  <p className="text-muted-foreground">
                    Para completar tu registro en Technovation España, necesitas estar registrada 
                    también en <strong>Technovation Global</strong>.
                  </p>
                  <a 
                    href="https://technovationchallenge.org" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    Ir a Technovation Global
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usa el <strong>mismo email</strong> que usaste o usarás en Technovation Global
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="understands-verification"
                    checked={understandsVerification}
                    onCheckedChange={(checked) => setUnderstandsVerification(checked === true)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="understands-verification"
                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    Entiendo que mi cuenta estará <strong>pendiente de verificación</strong> hasta 
                    que se valide mi registro en Technovation Global. Durante este tiempo, 
                    no podré acceder a todas las funcionalidades.
                  </label>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="terms"
                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    Acepto los{' '}
                    <Link to="/terms" className="text-primary hover:underline">
                      Términos de Servicio
                    </Link>{' '}
                    y la{' '}
                    <Link to="/privacy" className="text-primary hover:underline">
                      Política de Privacidad
                    </Link>
                  </label>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full gradient-primary hover:opacity-90 transition-opacity"
                disabled={isLoading || !canSubmit}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Enviando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Crear cuenta
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          ¿Eres mentora, jueza o voluntaria?{' '}
          <a href="mailto:registro@technovation.es" className="text-primary hover:underline">
            Contacta con nosotras
          </a>{' '}
          para que te demos de alta.
        </p>
      </div>
    </div>
  );
}
