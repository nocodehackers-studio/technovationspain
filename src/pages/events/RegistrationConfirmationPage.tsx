import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, Calendar, MapPin, Download, CalendarPlus, Ticket, Users, Clock } from 'lucide-react';
import { useRegistration, useRegistrationCompanions } from '@/hooks/useEventRegistration';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QRTicket } from '@/components/events/QRTicket';
import { Separator } from '@/components/ui/separator';

const RELATIONSHIP_LABELS: Record<string, string> = {
  mother: 'Madre',
  father: 'Padre',
  guardian: 'Tutor/a legal',
  grandparent: 'Abuelo/a',
  sibling: 'Hermano/a mayor',
  other: 'Otro familiar',
};

export default function RegistrationConfirmationPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
  
  const { data: registration, isLoading, error } = useRegistration(registrationId || '');
  const { data: companions } = useRegistrationCompanions(registrationId || '');
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (error || !registration) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Inscripción no encontrada</p>
          <Button onClick={() => navigate('/events')}>Volver a eventos</Button>
        </div>
      </div>
    );
  }
  
  const event = registration.event as any;
  const ticketType = registration.ticket_type as any;
  const eventDate = event ? new Date(event.date) : new Date();
  
  // Generate calendar event URL (Google Calendar)
  const generateCalendarUrl = () => {
    if (!event) return '#';
    
    const startDate = new Date(event.date);
    if (event.start_time) {
      const [hours, minutes] = event.start_time.split(':');
      startDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    const endDate = new Date(event.date);
    if (event.end_time) {
      const [hours, minutes] = event.end_time.split(':');
      endDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.name,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: event.description || '',
      location: `${event.location_name}, ${event.location_address}, ${event.location_city}`,
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };
  
  const isWaitlisted = registration.registration_status === 'waitlisted';
  
  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Success Message - Different for waitlist */}
        <div className="text-center space-y-4">
          {isWaitlisted ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/20">
                <Clock className="h-8 w-8 text-warning" />
              </div>
              <h1 className="text-2xl font-bold">Te has apuntado a la lista de espera</h1>
              <p className="text-muted-foreground">
                Te notificaremos a {registration.email} si se libera una plaza
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold">¡Inscripción completada!</h1>
              <p className="text-muted-foreground">
                Hemos enviado un email de confirmación a {registration.email}
              </p>
            </>
          )}
        </div>
        
        {/* Main Ticket Card */}
        <Card className="overflow-hidden">
          {/* Header with gradient */}
          <CardHeader className={`${isWaitlisted ? 'bg-gradient-to-r from-warning to-warning/80' : 'bg-gradient-to-r from-primary to-primary/80'} text-primary-foreground p-6`}>
            <div className="text-center">
              <p className="text-sm opacity-90 font-medium tracking-wider">
                {isWaitlisted ? 'LISTA DE ESPERA' : 'TECHNOVATION GIRLS ESPAÑA'}
              </p>
              <h2 className="text-xl font-bold mt-1">{event?.name}</h2>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* QR Code - Only for confirmed */}
            {!isWaitlisted && (
              <div className="flex justify-center py-4">
                <QRTicket code={registration.qr_code} size={180} />
              </div>
            )}
            
            {/* Waitlist notice */}
            {isWaitlisted && (
              <Alert className="border-warning/50 bg-warning/10">
                <Clock className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">
                  <strong>No tienes entrada confirmada todavía.</strong> Estás en lista de espera. 
                  Si se libera una plaza, te avisaremos por email.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Número de registro</p>
              <p className="font-mono font-bold text-lg">{registration.registration_number}</p>
            </div>
            
            {/* Details */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Asistente principal</p>
                <p className="font-medium">{registration.first_name} {registration.last_name}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Tipo de entrada</p>
                <p className="font-medium">{ticketType?.name || 'General'}</p>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">
                    {format(eventDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                  {event?.start_time && event?.end_time && (
                    <p className="text-sm text-muted-foreground">
                      {event.start_time} - {event.end_time}
                    </p>
                  )}
                </div>
              </div>
              
              {event?.location_name && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{event.location_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.location_address}, {event.location_city}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          
          {/* Actions - Only for confirmed */}
          {!isWaitlisted && (
            <div className="border-t p-4 flex gap-3">
              <Button variant="outline" className="flex-1 gap-2" disabled>
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>
              <Button variant="outline" className="flex-1 gap-2" asChild>
                <a href={generateCalendarUrl()} target="_blank" rel="noopener noreferrer">
                  <CalendarPlus className="h-4 w-4" />
                  Añadir al calendario
                </a>
              </Button>
            </div>
          )}
        </Card>
        
        {/* Companion Tickets - Only for confirmed */}
        {!isWaitlisted && companions && companions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5" />
              <span>Entradas de acompañantes ({companions.length})</span>
            </div>
            
            {companions.map((companion) => (
              <Card key={companion.id} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground p-4">
                  <div className="text-center">
                    <p className="text-xs opacity-90 font-medium tracking-wider">ACOMPAÑANTE</p>
                    <h3 className="font-bold">{companion.first_name} {companion.last_name}</h3>
                    <p className="text-xs opacity-75">
                      {RELATIONSHIP_LABELS[companion.relationship || ''] || companion.relationship}
                    </p>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 space-y-4">
                  {/* Companion QR Code */}
                  <div className="flex justify-center py-2">
                    <QRTicket code={companion.qr_code} size={140} />
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    <p>Acompañante de: {registration.first_name} {registration.last_name}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Info Alert */}
        {isWaitlisted ? (
          <Alert>
            <AlertDescription>
              <strong>📋 Información:</strong> Guarda tu número de registro. Te contactaremos si se libera una plaza.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertDescription>
              <strong>⚠️ Importante:</strong> Cada persona debe presentar su propio QR en la entrada del evento para acceder. 
              {companions && companions.length > 0 && ' Los acompañantes también necesitan mostrar sus entradas individuales.'}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Links */}
        <div className="text-center">
          <Button variant="link" asChild>
            <Link to="/dashboard" className="gap-2">
              <Ticket className="h-4 w-4" />
              Ir al dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
