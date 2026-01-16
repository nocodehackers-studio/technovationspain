import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Calendar, MapPin, Download, CalendarPlus } from 'lucide-react';
import { useRegistration } from '@/hooks/useEventRegistration';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { QRTicket } from '@/components/events/QRTicket';
import { RegistrationStatusBadge } from '@/components/events/RegistrationStatusBadge';

export default function TicketDetailPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
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
          <p className="text-destructive mb-4">Entrada no encontrada</p>
          <Button onClick={() => navigate('/dashboard')}>Volver al dashboard</Button>
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
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al dashboard
          </Button>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Ticket Card */}
        <Card className="overflow-hidden">
          {/* Header with gradient */}
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm opacity-90 font-medium tracking-wider">TECHNOVATION GIRLS ESPAÑA</p>
                <h2 className="text-xl font-bold mt-1">{event?.name}</h2>
              </div>
              <RegistrationStatusBadge status={registration.registration_status || 'pending'} />
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* QR Code */}
            <div className="flex justify-center py-4">
              <QRTicket code={registration.qr_code} size={200} />
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Número de registro</p>
              <p className="font-mono font-bold text-lg">{registration.registration_number}</p>
            </div>
            
            {/* Details */}
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Asistente</p>
                  <p className="font-medium">{registration.first_name} {registration.last_name}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de entrada</p>
                  <p className="font-medium">{ticketType?.name || 'General'}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{registration.email}</p>
              </div>
              
              {registration.team_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Equipo</p>
                  <p className="font-medium">{registration.team_name}</p>
                </div>
              )}
              
              <div className="flex items-start gap-3 pt-4 border-t">
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
      </div>
    </div>
  );
}
