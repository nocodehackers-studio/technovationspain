import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Mail, ArrowLeft, Loader2, KeyRound, RefreshCw } from 'lucide-react';

const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";

interface OtpVerificationViewProps {
  email: string;
  otpCode: string;
  setOtpCode: (code: string) => void;
  verifyingOtp: boolean;
  cooldownRemaining: number;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
  loading: boolean;
}

export function OtpVerificationView({
  email,
  otpCode,
  setOtpCode,
  verifyingOtp,
  cooldownRemaining,
  onVerify,
  onResend,
  onBack,
  loading,
}: OtpVerificationViewProps) {
  return (
    <Card className="w-full max-w-md card-hover">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-6 mb-6">
          <img src={LOGO_TECHNOVATION} alt="Technovation Girls" className="h-14 w-auto" />
          <div className="h-10 w-px bg-border" />
          <img src={LOGO_POWER_TO_CODE} alt="Power to Code" className="h-12 w-auto" />
        </div>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-xl font-display">Revisa tu correo</CardTitle>
        <CardDescription>
          Enviamos un código de verificación a <strong>{email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-center text-sm text-muted-foreground">
          Haz clic en el enlace del correo o introduce el código de verificación.
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
            onClick={onVerify}
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

          <Button
            variant="ghost"
            className="w-full"
            onClick={onResend}
            disabled={cooldownRemaining > 0 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reenviando...
              </>
            ) : cooldownRemaining > 0 ? (
              `Reenviar código (${cooldownRemaining}s)`
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reenviar código
              </>
            )}
          </Button>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver e intentar con otro email
        </Button>
      </CardContent>
    </Card>
  );
}
