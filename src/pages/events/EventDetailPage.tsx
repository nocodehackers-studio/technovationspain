import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, ArrowLeft, ExternalLink } from 'lucide-react';
import { useEvent } from '@/hooks/useEventRegistration';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: event, isLoading, error } = useEvent(eventId || '');
  
  // Only show capacity to admins and chapter ambassadors
  const showCapacity = role === 'admin' || role === 'chapter_ambassador';
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Evento no encontrado</p>
          <Button onClick={() => navigate('/events')}>Volver a eventos</Button>
        </div>
      </div>
    );
  }
  
  const eventDate = new Date(event.date);
  const now = new Date();
  
  const isRegistrationOpen = event.registration_open_date && event.registration_close_date
    ? now >= new Date(event.registration_open_date) && now <= new Date(event.registration_close_date)
    : false;
  
  const totalCapacity = event.max_capacity || 0;
  const currentRegistrations = event.current_registrations || 0;
  const capacityPercentage = totalCapacity > 0 ? (currentRegistrations / totalCapacity) * 100 : 0;
  
  const ticketTypes = event.ticket_types?.filter(t => t.is_active) || [];
  const agenda = event.agenda?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) || [];
  
  return (
    <div className="min-h-screen bg-background">
      {/* Back Button */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <Button variant="ghost" onClick={() => navigate('/events')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver a eventos
        </Button>
      </div>
      
      {/* Hero Image */}
      {event.image_url && (
        <div className="relative h-64 md:h-96 overflow-hidden">
          <img 
            src={event.image_url} 
            alt={event.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-6">
            <Badge variant={isRegistrationOpen ? 'default' : 'secondary'} className="text-sm">
              {isRegistrationOpen ? 'Inscripciones abiertas' : 'Inscripciones cerradas'}
            </Badge>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{event.name}</h1>
              {event.description && (
                <p className="text-lg text-muted-foreground">{event.description}</p>
              )}
            </div>
            
            {/* Date & Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Fecha y hora
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">
                    {format(eventDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                  {event.start_time && event.end_time && (
                    <p className="text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-4 w-4" />
                      {event.start_time} - {event.end_time}
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Ubicación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{event.location_name}</p>
                  <p className="text-muted-foreground text-sm">
                    {event.location_address}, {event.location_city}
                  </p>
                  {event.location_address && (
                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${event.location_address}, ${event.location_city}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm flex items-center gap-1 mt-2 hover:underline"
                    >
                      Ver mapa <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Agenda */}
            {agenda.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Agenda</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {agenda.map((item) => (
                      <div 
                        key={item.id}
                        className="flex gap-4 p-3 rounded-lg"
                        style={{ backgroundColor: item.color || '#f3f4f6' }}
                      >
                        <div className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                          {item.start_time} - {item.end_time}
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Sidebar - Registration Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inscripción</CardTitle>
                  {showCapacity && totalCapacity > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{currentRegistrations} / {totalCapacity} plazas</span>
                      </div>
                      <Progress value={capacityPercentage} className="h-2" />
                    </div>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Ticket Types */}
                  {ticketTypes.length > 0 && (
                    <div className="space-y-3">
                      {ticketTypes.map((ticket) => {
                        const available = (ticket.max_capacity || 0) - (ticket.current_count || 0);
                        const isSoldOut = available <= 0;
                        
                        return (
                          <div 
                            key={ticket.id}
                            className="flex justify-between items-center py-2 border-b last:border-0"
                          >
                            <div>
                              <p className="font-medium">{ticket.name}</p>
                              {showCapacity && (
                                <p className="text-xs text-muted-foreground">
                                  {available} / {ticket.max_capacity} disponibles
                                </p>
                              )}
                            </div>
                            <Badge variant={isSoldOut ? 'destructive' : 'secondary'}>
                              {isSoldOut ? 'Agotado' : 'Gratis'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <Separator />
                  
                  <Button 
                    className="w-full" 
                    size="lg"
                    disabled={!isRegistrationOpen}
                    asChild={isRegistrationOpen}
                  >
                    {isRegistrationOpen ? (
                      <Link to={`/events/${eventId}/register`}>
                        Inscribirse
                      </Link>
                    ) : (
                      <span>Inscripciones cerradas</span>
                    )}
                  </Button>
                  
                  {event.registration_close_date && (
                    <p className="text-xs text-center text-muted-foreground">
                      Inscripciones hasta el {format(new Date(event.registration_close_date), "d 'de' MMMM", { locale: es })}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
