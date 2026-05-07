import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Copy, RefreshCcw } from 'lucide-react';
import { ESCALETA_PASSWORD } from '@/lib/escaletaAccess';

const TOKEN_LENGTH = 12;

interface Props {
  eventId: string;
  event: { event_type: string | null; public_schedule_token: string | null };
}

export function EventPublicScheduleSection({ eventId, event }: Props) {
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const url = useMemo(() => {
    if (!event.public_schedule_token) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/escaleta/${event.public_schedule_token}`;
  }, [event.public_schedule_token]);

  if (event.event_type !== 'regional_final') {
    return null;
  }

  const isActive = !!event.public_schedule_token;

  const persistToken = async (value: string | null) => {
    const { error } = await supabase
      .from('events')
      .update({ public_schedule_token: value })
      .eq('id', eventId);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ['admin-event', eventId] });
  };

  const handleToggle = async (checked: boolean) => {
    setBusy(true);
    try {
      if (checked) {
        if (!event.public_schedule_token) {
          await persistToken(nanoid(TOKEN_LENGTH));
          toast.success('Acceso público activado');
        }
      } else {
        await persistToken(null);
        toast.success('Acceso público desactivado');
      }
    } catch (err: any) {
      toast.error(`Error: ${err?.message ?? 'no se pudo actualizar el acceso'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      await persistToken(nanoid(TOKEN_LENGTH));
      toast.success('Token regenerado. El enlace anterior ya no funciona.');
    } catch (err: any) {
      toast.error(`Error: ${err?.message ?? 'no se pudo regenerar'}`);
    } finally {
      setBusy(false);
      setConfirmRegen(false);
    }
  };

  const handleCopy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acceso público a la escaleta de jurados</CardTitle>
        <CardDescription>
          Genera un enlace protegido por contraseña para compartir la escaleta con
          personas externas (organizadores, voluntarios, jueces invitados) sin
          darles acceso al panel de administración.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor={`public-schedule-toggle-${eventId}`} className="font-medium">
            Acceso público activo
          </Label>
          <Switch
            id={`public-schedule-toggle-${eventId}`}
            checked={isActive}
            onCheckedChange={handleToggle}
            disabled={busy}
          />
        </div>

        {isActive ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Enlace</Label>
              <div className="flex gap-2">
                <Input value={url} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(url, 'Enlace copiado al portapapeles')}
                  aria-label="Copiar enlace"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contraseña</Label>
              <div className="flex gap-2">
                <Input value={ESCALETA_PASSWORD} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(ESCALETA_PASSWORD, 'Contraseña copiada al portapapeles')}
                  aria-label="Copiar contraseña"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                La contraseña es la misma para todos los enlaces públicos.
              </p>
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmRegen(true)}
                disabled={busy}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Regenerar token
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            El acceso público está desactivado. Activa el switch para generar un enlace.
          </p>
        )}
      </CardContent>

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar el token?</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace anterior dejará de funcionar de inmediato. Cualquiera que
              ya lo tuviera necesitará el nuevo enlace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={busy}>
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default EventPublicScheduleSection;
