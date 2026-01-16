import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, Calendar, MapPin, Download, CalendarPlus, Ticket } from 'lucide-react';
import { useRegistration } from '@/hooks/useEventRegistration';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QRTicket } from '@/components/events/QRTicket';

export default function RegistrationConfirmationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const registrationId = searchParams.get('id');
  
  const { data: registration, isLoading, error } = useRegistration(registrationId || '');
  
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
  
  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Success Message */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">¡Inscripción completada!</h1>
          <p className="text-muted-foreground">
            Hemos enviado un email de confirmación a {registration.email}
          </p>
        </div>
        
        {/* Ticket Card */}
        <Card className="overflow-hidden">
          {/* Header with gradient */}
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
            <div className="text-center">
              <p className="text-sm opacity-90 font-medium tracking-wider">TECHNOVATION GIRLS ESPAÑA</p>
              <h2 className="text-xl font-bold mt-1">{event?.name}</h2>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* QR Code */}
            <div className="flex justify-center py-4">
              <QRTicket code={registration.qr_code} size={180} />
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Número de registro</p>
              <p className="font-mono font-bold text-lg">{registration.registration_number}</p>
            </div>
            
            {/* Details */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Asistente</p>
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
          
          {/* Actions */}
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
        </Card>
        
        {/* Info Alert */}
        <Alert>
          <AlertDescription>
            <strong>⚠️ Importante:</strong> Presenta este QR en la entrada del evento para acceder. 
            Puedes mostrarlo desde tu móvil o imprimirlo.
          </AlertDescription>
        </Alert>
        
        {/* Links */}
        <div className="text-center">
          <Button variant="link" asChild>
            <Link to="/my-tickets" className="gap-2">
              <Ticket className="h-4 w-4" />
              Ver todas mis entradas
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
