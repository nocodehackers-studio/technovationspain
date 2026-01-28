import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface LegalConsentCheckboxesProps {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  onTermsChange: (checked: boolean) => void;
  onPrivacyChange: (checked: boolean) => void;
}

export function LegalConsentCheckboxes({
  termsAccepted,
  privacyAccepted,
  onTermsChange,
  onPrivacyChange,
}: LegalConsentCheckboxesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start space-x-3">
        <Checkbox
          id="terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => onTermsChange(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="terms" className="text-sm font-normal leading-relaxed cursor-pointer">
          Acepto los{' '}
          <a
            href="https://powertocode.org/terminos-condiciones/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Términos y Condiciones
          </a>
        </Label>
      </div>
      
      <div className="flex items-start space-x-3">
        <Checkbox
          id="privacy"
          checked={privacyAccepted}
          onCheckedChange={(checked) => onPrivacyChange(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="privacy" className="text-sm font-normal leading-relaxed cursor-pointer">
          Acepto la{' '}
          <a
            href="https://powertocode.org/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Política de Privacidad
          </a>
        </Label>
      </div>
    </div>
  );
}
