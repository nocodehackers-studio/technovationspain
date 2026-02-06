import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { validateSpanishDNI } from '@/lib/validation-utils';
import { Loader2 } from 'lucide-react';

interface ConsentModalProps {
  open: boolean;
  onConfirm: (data: { signerFullName: string; signerDni: string }) => void;
  onCancel: () => void;
  participantName: string;
  participantDni?: string;
  eventName: string;
  eventDate: string;
  isSubmitting?: boolean;
}

export function ConsentModal({
  open,
  onConfirm,
  onCancel,
  participantName,
  participantDni,
  eventName,
  eventDate,
  isSubmitting = false,
}: ConsentModalProps) {
  const [signerDni, setSignerDni] = useState(participantDni || '');
  const [signature, setSignature] = useState('');
  const [dniError, setDniError] = useState('');

  const isDniValid = validateSpanishDNI(signerDni, true);
  const isSignatureValid = signature.trim().length >= 3 && signature.trim().includes(' ');
  const canSubmit = isDniValid && isSignatureValid && !isSubmitting;

  const handleDniChange = (value: string) => {
    const upper = value.toUpperCase();
    setSignerDni(upper);
    if (upper && !validateSpanishDNI(upper, true)) {
      setDniError('Formato inválido. Usa 8 números + letra (DNI) o X/Y/Z + 7 números + letra (NIE)');
    } else {
      setDniError('');
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm({
      signerFullName: signature.trim(),
      signerDni: signerDni.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Consentimiento para {eventName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* DNI field */}
          <div className="space-y-2">
            <Label htmlFor="consent-dni">DNI/NIE *</Label>
            <Input
              id="consent-dni"
              placeholder="12345678A"
              value={signerDni}
              onChange={(e) => handleDniChange(e.target.value)}
              className="uppercase"
              maxLength={9}
            />
            {dniError && <p className="text-sm text-destructive">{dniError}</p>}
          </div>

          {/* Consent text */}
          <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>
              Yo, <strong>{participantName}</strong>, con DNI <strong>{signerDni || '[DNI]'}</strong>,
              autorizo mi participación en el evento <strong>{eventName}</strong> el día <strong>{eventDate}</strong>,
              incluyendo la captación de imágenes (fotografía y vídeo) durante el transcurso del evento,
              que podrán ser utilizadas con fines promocionales y de difusión por parte de la organización.
            </p>
            <p>
              Los datos proporcionados serán tratados conforme al Reglamento General de Protección de Datos (RGPD)
              y la Ley Orgánica de Protección de Datos y Garantía de los Derechos Digitales (LOPDGDD).
            </p>
          </div>

          <Separator />

          {/* Signature */}
          <div className="space-y-2">
            <Label htmlFor="consent-signature">Escribe tu nombre completo para firmar *</Label>
            <Input
              id="consent-signature"
              placeholder="Nombre Apellido1 Apellido2"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="text-lg font-medium"
            />
            {signature && !isSignatureValid && (
              <p className="text-sm text-muted-foreground">
                Escribe tu nombre y apellidos completos
              </p>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              'Firmar y confirmar inscripción'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
