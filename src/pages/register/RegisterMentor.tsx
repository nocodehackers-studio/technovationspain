import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Users, ArrowLeft, Loader2, Info } from 'lucide-react';
import { LegalConsentCheckboxes } from '@/components/auth/LegalConsentCheckboxes';
import { OtpVerificationView } from '@/components/auth/OtpVerificationView';
import { useOtpFlow } from '@/hooks/useOtpFlow';

const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";

export default function RegisterMentor() {
  const navigate = useNavigate();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost ? window.location.origin : 'https://technovationspain.lovable.app';

  const otp = useOtpFlow({
    otpOptions: {
      emailRedirectTo: `${baseUrl}/auth/callback?role=mentor`,
      data: { intended_role: 'mentor' },
    },
    onVerified: () => {
      navigate('/onboarding?role=mentor');
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted || !privacyAccepted) {
      toast.error('Debes aceptar los términos y condiciones y la política de privacidad');
      return;
    }
    otp.sendOtp();
  };

  if (otp.emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
        <OtpVerificationView
          email={otp.email}
          otpCode={otp.otpCode}
          setOtpCode={otp.setOtpCode}
          verifyingOtp={otp.verifyingOtp}
          cooldownRemaining={otp.cooldownRemaining}
          onVerify={otp.verifyOtp}
          onResend={otp.resendOtp}
          onBack={otp.resetFlow}
          loading={otp.loading}
        />
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
          <CardTitle className="text-xl font-display">Registro de Mentor</CardTitle>
          <CardDescription className="text-base">
            Para personas mayores de 18 años que guían equipos
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSend}>
          <CardContent className="space-y-4">
            <Alert className="border-muted bg-secondary/5">
              <Info className="h-4 w-4 text-secondary" />
              <AlertDescription className="text-sm">
                <strong>Requisito:</strong> Debes tener al menos 18 años y estar registrado/a
                en Technovation Global como mentor.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={otp.email}
                onChange={(e) => otp.setEmail(e.target.value)}
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

            <Button type="submit" className="w-full" disabled={otp.loading || !termsAccepted || !privacyAccepted}>
              {otp.loading ? (
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
