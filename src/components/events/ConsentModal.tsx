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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Consentimiento para {eventName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Legal content */}
          <div className="space-y-4 text-sm">
            {/* Main title */}
            <h3 className="text-center font-bold uppercase text-base">
              Aviso Legal para la Recogida de Datos de Carácter Personal
            </h3>

            {/* Participant name */}
            <p>
              <strong>Nombre y apellidos del Titular:</strong> {participantName}
            </p>

            {/* Introductory paragraph */}
            <p className="text-muted-foreground leading-relaxed">
              Asociación Power to Code con NIF G-88095351 (en adelante "Power to Code") y domicilio a efectos de notificaciones en Plaza de Segovia 5, 28600, Navalcarnero, Madrid, respeta la legislación vigente en materia de protección de datos personales, la privacidad de los usuarios y el secreto y seguridad de los datos personales, en concreto el Reglamento 2016/679 del Parlamento Europeo y del Consejo de 27 de abril de 2016, adoptando para ello las medidas técnicas y organizativas necesarias para evitar la pérdida, mal uso, alteración, acceso no autorizado y robo de los datos personales facilitados, habida cuenta del estado de la tecnología, la naturaleza de los datos y los riesgos a los que están expuestos.
            </p>

            <p className="text-muted-foreground leading-relaxed">
              De acuerdo con la actual legislación, el Titular, con el consentimiento de su padre, madre o tutor legal, queda informado y acepta expresamente el tratamiento de los datos con la finalidad descrita a continuación:
            </p>

            {/* Table 1: Data Protection Information */}
            <h4 className="text-center font-semibold bg-muted py-2 rounded">
              Información sobre protección de datos
            </h4>
            <table className="w-full border border-border text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Responsable del tratamiento
                  </th>
                  <td className="p-3">Asociación Power to Code</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Finalidad del Tratamiento
                  </th>
                  <td className="p-3">
                    Gestionar su participación en el evento y/o taller organizado por Power to Code, así como el envío de invitaciones y convocatorias a los mismos. Power to Code, como entidad sin ánimo de lucro y dentro del desarrollo de sus fines fundacionales, le mantendrá informado de su actividad relativa al evento. Participar en este evento conlleva la cesión de derechos de imagen (*).
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Legitimación
                  </th>
                  <td className="p-3">Consentimiento del Titular</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Cesiones
                  </th>
                  <td className="p-3">
                    No se realizan cesiones a terceros, excepto para la publicación de imágenes conforme se detalla a continuación.
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Derechos
                  </th>
                  <td className="p-3">
                    A retirar su consentimiento en cualquier momento, a oponerse al tratamiento, a acceder, rectificar y suprimir los datos, así como otros derechos, tal y como se explica en la información adicional.
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Transferencias Internacionales
                  </th>
                  <td className="p-3">No se realizarán transferencias internacionales de datos</td>
                </tr>
                <tr>
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Información adicional
                  </th>
                  <td className="p-3">
                    <a 
                      href="https://powertocode.org/privacy-policy/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      https://powertocode.org/privacy-policy/
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Table 2: Image Treatment Information */}
            <h4 className="text-center font-semibold bg-muted py-2 rounded mt-6">
              (*) Información específica sobre el tratamiento de imágenes
            </h4>
            <table className="w-full border border-border text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Responsable
                  </th>
                  <td className="p-3">
                    Universidad Carlos III de Madrid (UC3M) con domicilios en Calle Madrid, 126, 28903 Getafe, Madrid
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Soportes
                  </th>
                  <td className="p-3">
                    Fotografías, vídeos, vídeos con voz, material gráfico, etc., o parte de las mismas en las que interviene o ha intervenido el Titular en el marco de los proyectos de Power to Code y la UC3M
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Ámbito de Utilización
                  </th>
                  <td className="p-3">
                    No se circunscribe a un ámbito temporal o territorial determinados, por lo que UC3M y Power to Code podrá utilizar estas Imágenes, o parte de las mismas, en todos los países del mundo sin limitación geográfica de ninguna clase y con la máxima extensión temporal permitida en la legislación vigente.
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Cesiones
                  </th>
                  <td className="p-3">
                    Exclusivamente con carácter social y nunca comercial, UC3M y Power to Code podrá ceder a terceros, tales como entidades colaboradores o patrocinadores, las imágenes, o parte de las mismas, en las que el Titular aparece como modelo, entrevistado, narrador o participante principal o secundario en el ámbito (sea cual fuere el medio de comunicación interno o externo) y finalidades de los proyectos de Power to Code.
                    <br /><br />
                    El objeto de la cesión será la promoción de las actividades de Power to Code, en medios de comunicación internos o externos a la misma, para que puedan ser difundidas en todos los medios de comunicación conocidos en la actualidad incluidos los online (Youtube, Linkedin, Instagram, Tik Tok Facebook, etc), streaming y los que pudieran desarrollarse en el futuro. Todo ello con la única salvedad y limitación de aquellas utilizaciones o aplicaciones que pudieran atentar al derecho al honor, a la moral y/o al orden público, en los términos previstos en la legislación vigente en cada país.
                  </td>
                </tr>
                <tr>
                  <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
                    Términos de la cesión
                  </th>
                  <td className="p-3">
                    El Titular acepta que la cesión del uso de su imagen que se desprenda de la toma de fotografías y filmación de videos durante las actividades de Power to Code, la realiza a favor de ésta con carácter gratuito. Power to Code se exime de responsabilidad sobre cualquier uso que pueda hacer un tercero de las Imágenes fuera del ámbito territorial, temporal y material objeto del presente acuerdo.
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Final paragraphs */}
            <p className="text-muted-foreground leading-relaxed mt-4">
              El padre/madre o tutor legal del Titular cuyo nombre y apellidos figuran a continuación, será el único responsable de la veracidad y exactitud de los datos facilitados a Power to Code.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              El padre, madre o tutor legal del Titular declara que ha leído, entiende y autoriza expresamente el tratamiento de sus datos de carácter personal al apretar sobre el botón "ACEPTAR" que figura a continuación.
            </p>
          </div>

          <Separator />

          {/* DNI field */}
          <div className="space-y-2">
            <Label htmlFor="consent-dni">DNI/NIE del Padre/Madre o Tutor legal *</Label>
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
            <Label htmlFor="consent-signature">Nombre y apellidos del Padre/Madre o Tutor legal *</Label>
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
