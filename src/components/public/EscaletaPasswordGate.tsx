import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import {
  ESCALETA_PASSWORD,
  clearAttempts,
  formatLockoutCountdown,
  getLockoutStatus,
  markAuthenticated,
  recordAttempt,
} from '@/lib/escaletaAccess';

interface Props {
  token: string;
  onAuth: () => void;
}

export function EscaletaPasswordGate({ token, onAuth }: Props) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(() => getLockoutStatus(token));
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep status fresh while locked: tick once a second to refresh the countdown.
  useEffect(() => {
    if (!status.locked) return;
    const id = window.setInterval(() => {
      setStatus(getLockoutStatus(token));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status.locked, token]);

  const buttonLabel = useMemo(() => {
    if (status.locked) return `Bloqueado · ${formatLockoutCountdown(status.secondsRemaining)}`;
    return 'Entrar';
  }, [status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fresh = getLockoutStatus(token);
    if (fresh.locked) {
      setStatus(fresh);
      return;
    }
    if (password === ESCALETA_PASSWORD) {
      clearAttempts(token);
      markAuthenticated(token);
      onAuth();
      return;
    }
    recordAttempt(token);
    const next = getLockoutStatus(token);
    setStatus(next);
    setPassword('');
    if (next.locked) {
      toast.error(`Demasiados intentos. Espera ${formatLockoutCountdown(next.secondsRemaining)} para volver a intentarlo.`);
    } else {
      toast.error(`Contraseña incorrecta. Te quedan ${next.attemptsLeft} intento${next.attemptsLeft === 1 ? '' : 's'}.`);
    }
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Escaleta — Acceso Protegido</CardTitle>
          <CardDescription>
            Introduce la contraseña para ver la escaleta de jurados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="escaleta-password">Contraseña</Label>
              <Input
                ref={inputRef}
                id="escaleta-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={status.locked}
                autoComplete="current-password"
              />
            </div>

            {status.locked ? (
              <p className="text-sm text-destructive text-center">
                Demasiados intentos. Vuelve a intentarlo en {formatLockoutCountdown(status.secondsRemaining)}.
              </p>
            ) : status.attemptsLeft < 5 ? (
              <p className="text-xs text-muted-foreground text-center">
                Te quedan {status.attemptsLeft} intento{status.attemptsLeft === 1 ? '' : 's'}.
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={status.locked || !password}>
              {buttonLabel}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default EscaletaPasswordGate;
