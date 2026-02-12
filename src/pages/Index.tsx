import { useCallback } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOtpFlow } from "@/hooks/useOtpFlow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { OtpVerificationView } from "@/components/auth/OtpVerificationView";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Info, UserPlus } from "lucide-react";

// Logos from Supabase Storage
const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";

export default function Index() {
  const navigate = useNavigate();
  const { user, isLoading, role, needsOnboarding, isVerified } = useAuth();

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost ? window.location.origin : 'https://technovationspain.lovable.app';

  const beforeSend = useCallback(async (email: string): Promise<boolean> => {
    const { data: emailExists, error: checkError } = await supabase
      .rpc('check_email_exists', { check_email: email });

    if (checkError) {
      console.error('Error checking email:', checkError);
      return true; // Continue on error as fallback
    }

    if (!emailExists) {
      toast.info("Este email no está registrado. Por favor, crea una cuenta.");
      navigate('/register', { state: { email } });
      return false;
    }

    return true;
  }, [navigate]);

  const onVerified = useCallback(async (session: { user: { id: string } }) => {
    // Check profile to determine redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed, verification_status')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed) {
      navigate('/onboarding', { replace: true });
      return;
    }

    // Check role for redirect
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    type AppRole = 'admin' | 'mentor' | 'judge' | 'volunteer' | 'participant';
    const rolePriority: AppRole[] = ['admin', 'mentor', 'judge', 'volunteer', 'participant'];
    const userRoles = (rolesData?.map(r => r.role) || []) as AppRole[];
    const highestRole = rolePriority.find(r => userRoles.includes(r));

    if (highestRole === 'admin') {
      navigate('/admin', { replace: true });
    } else if (profile?.verification_status !== 'verified') {
      navigate('/pending-verification', { replace: true });
    } else if (highestRole === 'volunteer') {
      navigate('/voluntario/dashboard', { replace: true });
    } else if (highestRole === 'mentor') {
      navigate('/mentor/dashboard', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const otp = useOtpFlow({
    otpOptions: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
    beforeSend,
    onVerified,
  });

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingPage />;
  }

  // If logged in, redirect based on role and onboarding status
  if (user) {
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    // Check if user needs onboarding first
    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    // Check verification status
    if (!isVerified) {
      return <Navigate to="/pending-verification" replace />;
    }
    // Role-based redirect for verified users
    if (role === "volunteer") {
      return <Navigate to="/voluntario/dashboard" replace />;
    }
    if (role === "mentor") {
      return <Navigate to="/mentor/dashboard" replace />;
    }
    // Participants and judges go to generic dashboard
    return <Navigate to="/dashboard" replace />;
  }

  if (otp.emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted">
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
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted">
      <Card className="w-full max-w-md card-hover">
        <CardHeader className="text-center">
          {/* Logos */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <img
              src={LOGO_TECHNOVATION}
              alt="Technovation Girls Madrid"
              className="h-14 w-auto"
            />
            <div className="h-10 w-px bg-border" />
            <img
              src={LOGO_POWER_TO_CODE}
              alt="Power to Code"
              className="h-12 w-auto"
            />
          </div>
          <CardTitle className="text-xl font-display">Iniciar sesión</CardTitle>
          <CardDescription className="text-base">
            Introduce tu email para acceder a tu cuenta
          </CardDescription>
        </CardHeader>
        <form onSubmit={otp.sendOtp}>
          <CardContent className="space-y-4">
            <Alert className="border-muted bg-accent/5">
              <Info className="h-4 w-4 text-accent" />
              <AlertDescription className="text-sm">
                <strong>Importante:</strong> Usa el mismo email con el que te registraste
                en Technovation Global para verificar tu cuenta automáticamente.
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
                Usa tu email de Technovation Global
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={otp.loading}>
              {otp.loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Continuar con email"
              )}
            </Button>
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">o</span>
              </div>
            </div>
            <Link to="/register" className="w-full">
              <Button variant="outline" className="w-full" type="button">
                <UserPlus className="mr-2 h-4 w-4" />
                Crear cuenta nueva
              </Button>
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              Al continuar, aceptas los términos de uso y la política de privacidad.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
