import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { hasMissingFields } from "@/lib/profile-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2, Info, KeyRound } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// Logos from Supabase Storage
const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";

export default function Index() {
  const navigate = useNavigate();
  const { user, isLoading, role, isVerified, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingPage />;
  }

  // If logged in, redirect based on priority: admin → !verified → !consent → missing fields → role dashboard
  if (user) {
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (!isVerified) return <Navigate to="/pending-verification" replace />;
    if (!profile?.terms_accepted_at) return <Navigate to="/onboarding" replace />;
    if (profile && hasMissingFields(profile)) return <Navigate to="/onboarding" replace />;
    if (role === "chapter_ambassador") return <Navigate to="/admin" replace />;
    if (role === "mentor") return <Navigate to="/mentor/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Por favor, introduce tu email"); return; }
    setLoading(true);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost ? window.location.origin : 'https://app.powertocode.org';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${baseUrl}/auth/callback` },
    });

    setLoading(false);
    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      setEmailSent(true);
      toast.success("¡Código enviado! Revisa tu correo electrónico");
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 8) {
      toast.error("Introduce el código de 8 dígitos completo");
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
        toast.success("¡Verificación exitosa!");

        // Check profile to determine redirect
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .maybeSingle();

        // Check role for redirect
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.session.user.id);

        type AppRole = 'admin' | 'chapter_ambassador' | 'mentor' | 'judge' | 'participant';
        const rolePriority: AppRole[] = ['admin', 'chapter_ambassador', 'mentor', 'judge', 'participant'];
        const userRoles = (rolesData?.map(r => r.role) || []) as AppRole[];
        const highestRole = rolePriority.find(r => userRoles.includes(r));

        // Priority: admin → !verified → !consent → missing fields → role dashboard
        if (highestRole === 'admin') {
          navigate('/admin', { replace: true });
        } else if (profileData?.verification_status !== 'verified') {
          navigate('/pending-verification', { replace: true });
        } else if (!profileData?.terms_accepted_at) {
          navigate('/onboarding', { replace: true });
        } else if (profileData && hasMissingFields(profileData as Record<string, unknown>)) {
          navigate('/onboarding', { replace: true });
        } else if (highestRole === 'chapter_ambassador') {
          navigate('/admin', { replace: true });
        } else if (highestRole === 'mentor') {
          navigate('/mentor/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Código inválido o expirado");
    } finally {
      setVerifyingOtp(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted">
        <Card className="w-full max-w-md card-hover">
          <CardHeader className="text-center">
            {/* Logos */}
            <div className="flex items-center justify-center gap-6 mb-6">
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
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/20">
              <Mail className="h-7 w-7 text-secondary" />
            </div>
            <CardTitle className="text-xl font-display text-primary">Revisa tu correo</CardTitle>
            <CardDescription>
              Hemos enviado un enlace a <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-sm text-muted-foreground">
              Haz clic en el enlace del correo para completar tu registro.
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
                  "Verificar código"
                )}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setEmailSent(false);
                setOtpCode("");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver e intentar con otro email
            </Button>
          </CardFooter>
        </Card>
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
          <CardTitle className="text-xl font-display">Acceder a la plataforma</CardTitle>
          <CardDescription className="text-base">
            Introduce tu email de Technovation Global
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="space-y-4">
            <Alert className="border-muted bg-accent/5">
              <Info className="h-4 w-4 text-accent" />
              <AlertDescription className="text-sm">
                Debes usar el mismo email que usas en Technovation Global
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="email">Email de Technovation Global</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Continuar con email"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
