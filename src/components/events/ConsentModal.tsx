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
import { ConsentLegalText } from '@/components/events/ConsentLegalText';

interface ConsentModalProps {
  open: boolean;
  onConfirm: (data: { signerFullName: string; signerDni: string }) => void;
  onCancel: () => void;
  participantName: string;
  participantDni?: string;
  participantAge?: number;
  eventName: string;
  eventDate: string;
  eventLocation?: string;
  isSubmitting?: boolean;
}

export function ConsentModal({
  open,
  onConfirm,
  onCancel,
  participantName,
  participantDni,
  participantAge,
  eventName,
  eventDate,
  eventLocation,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Consentimiento para {eventName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <ConsentLegalText
            participantName={participantName}
            participantAge={participantAge}
            eventName={eventName}
            eventDate={eventDate}
            eventLocation={eventLocation}
          />

          <Separator />

          {/* DNI field */}
          <div className="space-y-2">
            <Label htmlFor="consent-dni">DNI/NIE del Padre/Madre o Tutor legal (o del Titular para mayores de 14 años) *</Label>
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

          {/* Signature */}
          <div className="space-y-2">
            <Label htmlFor="consent-signature">Nombre y apellidos del Padre/Madre o Tutor legal (o del Titular para mayores de 14 años) *</Label>
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
