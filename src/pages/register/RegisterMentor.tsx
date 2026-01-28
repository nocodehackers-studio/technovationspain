import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Users, Mail, ArrowLeft, Loader2, Info, KeyRound } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { LegalConsentCheckboxes } from '@/components/auth/LegalConsentCheckboxes';

const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";

export default function RegisterMentor() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Por favor, introduce tu email');
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      toast.error('Debes aceptar los términos y condiciones y la política de privacidad');
      return;
    }

    setLoading(true);
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost ? window.location.origin : 'https://technovationspain.lovable.app';
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${baseUrl}/auth/callback?role=mentor`,
        data: {
          intended_role: 'mentor'
        }
      },
    });

    setLoading(false);

    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      setEmailSent(true);
      toast.success('¡Enlace enviado! Revisa tu correo electrónico');
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 8) {
      toast.error('Introduce el código de 8 dígitos completo');
      return;
    }

    setVerifyingOtp(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });

      if (error) throw error;

      if (data.session) {
        toast.success('¡Verificación exitosa!');
        navigate('/onboarding?role=mentor');
      }
    } catch (error: any) {
      toast.error(error.message || 'Código inválido o expirado');
    } finally {
      setVerifyingOtp(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
        <Card className="w-full max-w-md card-hover">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-6 mb-6">
              <img src={LOGO_TECHNOVATION} alt="Technovation Girls" className="h-14 w-auto" />
              <div className="h-10 w-px bg-border" />
              <img src={LOGO_POWER_TO_CODE} alt="Power to Code" className="h-12 w-auto" />
            </div>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/20">
              <Mail className="h-7 w-7 text-secondary" />
            </div>
            <CardTitle className="text-xl font-display">Revisa tu correo</CardTitle>
            <CardDescription>
              Hemos enviado un enlace a <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-sm text-muted-foreground">
              Haz clic en el enlace del correo para completar tu registro como mentora. 
              El enlace expira en 1 hora.
            </p>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">o usa el código</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <Label htmlFor="otp" className="text-sm font-medium">
                  <KeyRound className="inline h-4 w-4 mr-1" />
                  Código de verificación
                </Label>
                <InputOTP
                  maxLength={8}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                    <InputOTPSlot index={6} />
                    <InputOTPSlot index={7} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-xs text-muted-foreground">
                  Introduce el código de 8 dígitos del correo
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otpCode.length !== 8}
              >
                {verifyingOtp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar código'
                )}
              </Button>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setEmailSent(false);
                setOtpCode('');
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver e intentar con otro email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
      <Card className="w-full max-w-md card-hover">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <img src={LOGO_TECHNOVATION} alt="Technovation Girls" className="h-14 w-auto" />
            <div className="h-10 w-px bg-border" />
            <img src={LOGO_POWER_TO_CODE} alt="Power to Code" className="h-12 w-auto" />
          </div>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/20">
            <Users className="h-6 w-6 text-secondary" />
          </div>
          <CardTitle className="text-xl font-display">Registro de Mentora</CardTitle>
          <CardDescription className="text-base">
            Para personas mayores de 18 años que guían equipos
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="space-y-4">
            <Alert className="border-muted bg-secondary/5">
              <Info className="h-4 w-4 text-secondary" />
              <AlertDescription className="text-sm">
                <strong>Requisito:</strong> Debes tener al menos 18 años y estar registrada 
                en Technovation Global como mentora.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Usa el email con el que te registraste en Technovation Global
              </p>
            </div>

            <LegalConsentCheckboxes
              termsAccepted={termsAccepted}
              privacyAccepted={privacyAccepted}
              onTermsChange={setTermsAccepted}
              onPrivacyChange={setPrivacyAccepted}
            />

            <Button type="submit" className="w-full" disabled={loading || !termsAccepted || !privacyAccepted}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Continuar con email'
              )}
            </Button>

            <div className="text-center space-y-2">
              <Link to="/register" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Volver a selección de rol
              </Link>
              <p className="text-xs text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <Link to="/" className="font-medium text-primary hover:underline">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
