import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check, Loader2, Ticket } from 'lucide-react';
import { useEvent, useEventRegistration, useExistingRegistration } from '@/hooks/useEventRegistration';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const registrationSchema = z.object({
  ticket_type_id: z.string().min(1, 'Selecciona un tipo de entrada'),
  first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  last_name: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  email: z.string().email('Introduce un email válido'),
  dni: z.string().optional(),
  phone: z.string().optional(),
  team_name: z.string().optional(),
  tg_email: z.string().email('Introduce un email válido').optional().or(z.literal('')),
  image_consent: z.boolean().default(false),
  data_consent: z.boolean().refine(val => val === true, 'Debes aceptar la política de privacidad'),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

export default function EventRegistrationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  const { data: event, isLoading } = useEvent(eventId || '');
  const { register, isRegistering, error } = useEventRegistration(eventId || '');
  const { data: existingRegistration, isLoading: isCheckingRegistration } = useExistingRegistration(eventId || '');
  
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      ticket_type_id: '',
      first_name: '',
      last_name: '',
      email: '',
      dni: '',
      phone: '',
      team_name: '',
      tg_email: '',
      image_consent: false,
      data_consent: false,
    },
  });
  
  const selectedTicketId = form.watch('ticket_type_id');
  const selectedTicket = event?.ticket_types?.find(t => t.id === selectedTicketId);
  const requiresTeam = selectedTicket?.requires_team;
  
  if (isLoading || isCheckingRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  // Show message if user is already registered
  if (existingRegistration) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-background border-b">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate(`/events/${eventId}`)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al evento
            </Button>
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto px-4 py-16">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Ticket className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Ya estás inscrito en este evento</CardTitle>
              <CardDescription className="text-base mt-2">
                Tu número de registro es: <span className="font-mono font-medium">{existingRegistration.registration_number}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Puedes ver los detalles de tu inscripción y descargar tu entrada desde la página de confirmación.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild>
                  <Link to={`/events/${eventId}/confirmation/${existingRegistration.id}`}>
                    Ver mi entrada
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard">
                    Ir al dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Evento no encontrado</p>
          <Button onClick={() => navigate('/events')}>Volver a eventos</Button>
        </div>
      </div>
    );
  }
  
  const ticketTypes = event.ticket_types?.filter(t => t.is_active) || [];
  
  const handleNext = async () => {
    if (step === 1) {
      const valid = await form.trigger('ticket_type_id');
      if (valid) setStep(2);
    } else if (step === 2) {
      const fieldsToValidate: (keyof RegistrationFormValues)[] = ['first_name', 'last_name', 'email'];
      if (requiresTeam) {
        fieldsToValidate.push('team_name', 'tg_email');
      }
      const valid = await form.trigger(fieldsToValidate);
      if (valid) setStep(3);
    }
  };
  
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };
  
  const onSubmit = async (values: RegistrationFormValues) => {
    try {
      const registration = await register({
        ticket_type_id: values.ticket_type_id,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        dni: values.dni,
        phone: values.phone,
        team_name: values.team_name || undefined,
        tg_email: values.tg_email || undefined,
        image_consent: values.image_consent,
        data_consent: values.data_consent,
      });
      
      toast.success('¡Inscripción completada!');
      navigate(`/events/${eventId}/confirmation/${registration.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la inscripción');
    }
  };
  
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(`/events/${eventId}`)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al evento
          </Button>
        </div>
      </div>
      
      {/* Progress */}
      <div className="bg-background border-b">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                `}>
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-16 h-0.5 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 mt-2 text-xs text-muted-foreground">
            <span className={step >= 1 ? 'text-primary font-medium' : ''}>Entrada</span>
            <span className={step >= 2 ? 'text-primary font-medium' : ''}>Datos</span>
            <span className={step >= 3 ? 'text-primary font-medium' : ''}>Confirmar</span>
          </div>
        </div>
      </div>
      
      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Select Ticket */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Selecciona tu tipo de entrada</CardTitle>
                  <CardDescription>
                    Elige el tipo de entrada que corresponde con tu perfil
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="ticket_type_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="space-y-3"
                          >
                            {ticketTypes.map((ticket) => {
                              const available = (ticket.max_capacity || 0) - (ticket.current_count || 0);
                              const isSoldOut = available <= 0;
                              
                              return (
                                <div
                                  key={ticket.id}
                                  className={`
                                    flex items-center justify-between p-4 border rounded-lg cursor-pointer
                                    transition-colors
                                    ${field.value === ticket.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}
                                    ${isSoldOut ? 'opacity-50 cursor-not-allowed' : ''}
                                  `}
                                  onClick={() => !isSoldOut && field.onChange(ticket.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <RadioGroupItem 
                                      value={ticket.id} 
                                      id={ticket.id}
                                      disabled={isSoldOut}
                                    />
                                    <div>
                                      <Label htmlFor={ticket.id} className="font-medium cursor-pointer">
                                        {ticket.name}
                                      </Label>
                                      {ticket.description && (
                                        <p className="text-sm text-muted-foreground">{ticket.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant={isSoldOut ? 'destructive' : 'outline'}>
                                      {isSoldOut ? 'Agotado' : 'Gratis'}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {available} disponibles
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}
            
            {/* Step 2: Personal Data */}
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Datos personales</CardTitle>
                  <CardDescription>
                    Completa tus datos para la inscripción
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre *</FormLabel>
                          <FormControl>
                            <Input placeholder="Tu nombre" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellidos *</FormLabel>
                          <FormControl>
                            <Input placeholder="Tus apellidos" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="tu@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="dni"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>DNI / NIE</FormLabel>
                          <FormControl>
                            <Input placeholder="12345678A" {...field} />
                          </FormControl>
                          <FormDescription>Necesario para el acceso al evento</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="+34 600 000 000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Technovation fields for participants/mentors */}
                  {requiresTeam && (
                    <>
                      <Separator className="my-6" />
                      <div className="space-y-4">
                        <h3 className="font-medium">Datos de Technovation</h3>
                        
                        <FormField
                          control={form.control}
                          name="team_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre del equipo *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Nombre registrado en technovationchallenge.org" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="tg_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email registrado en Technovation *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email"
                                  placeholder="tu@email.com" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Usaremos este email para validar tu acceso al evento
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Step 3: Confirmation */}
            {step === 3 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen de tu inscripción</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Evento</p>
                        <p className="font-medium">{event.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tipo de entrada</p>
                        <p className="font-medium">{selectedTicket?.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Asistente</p>
                        <p className="font-medium">
                          {form.getValues('first_name')} {form.getValues('last_name')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{form.getValues('email')}</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total</span>
                      <span className="text-lg font-bold text-primary">Gratis</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Consentimientos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="image_consent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-normal text-sm">
                              Autorizo la captación de imágenes durante el evento
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="data_consent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-normal text-sm">
                              He leído y acepto la política de privacidad y el tratamiento de mis datos personales *
                            </FormLabel>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Collapsible>
                      <CollapsibleTrigger className="text-primary text-sm hover:underline">
                        Ver política de privacidad completa
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                        Este evento puede ser retransmitido, grabado y/o publicado en nuestro canal de Youtube. 
                        Cuando te registras, estás autorizando a Asociación Power to Code a la captación de imágenes 
                        de tu persona y/o de la menor participante, en fotografía o vídeo, durante el transcurso del evento.
                        Los datos proporcionados serán tratados conforme al RGPD y la LOPDGDD.
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex justify-between">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
              ) : (
                <div />
              )}
              
              {step < 3 ? (
                <Button type="button" onClick={handleNext}>
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={isRegistering}>
                  {isRegistering ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Confirmar inscripción'
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
