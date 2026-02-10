import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ConsentLegalText } from '@/components/events/ConsentLegalText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { validateSpanishDNI } from '@/lib/validation-utils';
import { useSubmitPublicConsent, getConsentErrorMessage } from '@/hooks/useEventConsent';

const consentSchema = z.object({
  signer_relationship: z.enum(['self', 'madre', 'padre', 'tutor'], {
    required_error: 'Selecciona tu relación',
  }),
  signer_full_name: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .refine(val => val.trim().includes(' '), 'Introduce nombre y apellidos'),
  signer_dni: z.string()
    .min(1, 'El DNI/NIE es obligatorio')
    .refine(val => validateSpanishDNI(val, true), 'Formato de DNI/NIE inválido'),
  minor_name: z.string().optional(),
  minor_age: z.coerce.number().min(0).max(17).optional(),
  signature: z.string()
    .min(3, 'Escribe tu nombre completo para firmar')
    .refine(val => val.trim().includes(' '), 'Introduce nombre y apellidos completos'),
}).superRefine((data, ctx) => {
  const isParent = ['madre', 'padre', 'tutor'].includes(data.signer_relationship);
  if (isParent) {
    if (!data.minor_name || data.minor_name.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El nombre del menor es obligatorio', path: ['minor_name'] });
    }
    if (data.minor_age === undefined || data.minor_age === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La edad del menor es obligatoria', path: ['minor_age'] });
    }
  }
});

type ConsentFormValues = z.infer<typeof consentSchema>;

export default function ConsentPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const [manualToken, setManualToken] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [eventInfo, setEventInfo] = useState<{
    participant_name: string;
    event_name: string;
    event_date: string;
    event_location_name: string;
    event_location_address: string;
    event_location_city: string;
  } | null>(null);
  const [eventInfoLoading, setEventInfoLoading] = useState(false);

  const consentToken = tokenFromUrl || manualToken;

  // Fetch event info when token is available
  useEffect(() => {
    if (!consentToken) return;
    setEventInfoLoading(true);
    supabase.functions.invoke('get-consent-info', {
      body: { consent_token: consentToken },
    }).then(({ data, error }) => {
      if (!error && data && !data.error) {
        setEventInfo(data);
      }
    }).finally(() => setEventInfoLoading(false));
  }, [consentToken]);

  const { mutateAsync: submitConsent, isPending } = useSubmitPublicConsent();

  const form = useForm<ConsentFormValues>({
    resolver: zodResolver(consentSchema),
    defaultValues: {
      signer_relationship: undefined,
      signer_full_name: '',
      signer_dni: '',
      minor_name: '',
      minor_age: undefined,
      signature: '',
    },
  });

  const relationship = form.watch('signer_relationship');
  const signerName = form.watch('signer_full_name');
  const signerDni = form.watch('signer_dni');
  const isParentOrTutor = relationship === 'madre' || relationship === 'padre' || relationship === 'tutor';

  const getRelationshipLabel = (rel: string): string => {
    const labels: Record<string, string> = {
      self: 'el/la participante',
      madre: 'madre',
      padre: 'padre',
      tutor: 'tutor/a legal',
    };
    return labels[rel] || rel;
  };

  const onSubmit = async (values: ConsentFormValues) => {
    if (!consentToken) {
      setSubmitError('No se ha proporcionado un token de consentimiento.');
      return;
    }

    setSubmitError(null);

    try {
      await submitConsent({
        consent_token: consentToken,
        signer_full_name: values.signer_full_name.trim(),
        signer_dni: values.signer_dni.trim().toUpperCase(),
        signer_relationship: values.signer_relationship,
        signature: values.signature.trim(),
        minor_name: isParentOrTutor ? values.minor_name?.trim() : undefined,
        minor_age: isParentOrTutor ? values.minor_age : undefined,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError(err.code ? getConsentErrorMessage(err.code) : err.message);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-green-700 mb-4">Consentimiento firmado</h1>
        <p className="text-green-600 text-center max-w-sm">
          El consentimiento ha sido registrado correctamente. Ya puedes cerrar esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Technovation España</span>
          </div>
          <h1 className="text-2xl font-bold">Consentimiento de participación</h1>
          <p className="text-muted-foreground text-sm">
            Completa y firma el formulario de consentimiento.
          </p>
        </div>

        {/* Token input if not in URL */}
        {!tokenFromUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Token de consentimiento</CardTitle>
              <CardDescription>
                Introduce el token que recibiste por email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value.trim())}
              />
            </CardContent>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Relationship selector */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Relación con el/la participante</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="signer_relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">Yo mismo/a</SelectItem>
                            <SelectItem value="madre">Madre</SelectItem>
                            <SelectItem value="padre">Padre</SelectItem>
                            <SelectItem value="tutor">Tutor/a legal</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Signer data */}
            {relationship && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Datos del firmante</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="signer_full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre y apellidos completos *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre Apellido1 Apellido2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="signer_dni"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DNI/NIE *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="12345678A"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Minor fields */}
                  {isParentOrTutor && (
                    <>
                      <Separator />
                      <p className="text-sm font-medium text-muted-foreground">Datos del/la menor</p>
                      <FormField
                        control={form.control}
                        name="minor_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre completo del/la menor *</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre del/la menor" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="minor_age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Edad del/la menor *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                max={17}
                                placeholder="13"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Consent text + signature */}
            {relationship && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Texto de consentimiento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {eventInfoLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="p-4 bg-muted rounded-lg">
                      <ConsentLegalText
                        participantName={eventInfo?.participant_name || signerName || '[nombre]'}
                        eventName={eventInfo?.event_name || '[evento]'}
                        eventDate={eventInfo?.event_date ? new Date(eventInfo.event_date).toLocaleDateString('es-ES', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        }) : '[fecha]'}
                        eventLocation={[eventInfo?.event_location_name, eventInfo?.event_location_address, eventInfo?.event_location_city].filter(Boolean).join(', ') || undefined}
                        signerName={signerName || undefined}
                      />
                    </div>
                  )}

                  <Separator />

                  <FormField
                    control={form.control}
                    name="signature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escribe tu nombre completo para firmar *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Escribe tu nombre completo"
                            {...field}
                            className="text-lg font-medium"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {submitError && (
                    <Alert variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isPending || !consentToken}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Firmar consentimiento'
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
