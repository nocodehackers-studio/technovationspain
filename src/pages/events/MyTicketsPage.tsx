import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ticket, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { useMyRegistrations } from '@/hooks/useEventRegistration';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegistrationStatusBadge } from '@/components/events/RegistrationStatusBadge';
import { useAuth } from '@/hooks/useAuth';

export default function MyTicketsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: registrations, isLoading, error } = useMyRegistrations();
  
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Inicia sesión para ver tus entradas</p>
          <Button asChild>
            <Link to="/">Iniciar sesión</Link>
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <Ticket className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold">Mis Entradas</h1>
          <p className="text-lg opacity-90 mt-2">
            Todas tus inscripciones a eventos de Technovation
          </p>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {registrations && registrations.length > 0 ? (
          <div className="space-y-4">
            {registrations.map((reg) => {
              const event = reg.event as any;
              const ticketType = reg.ticket_type as any;
              const eventDate = event ? new Date(event.date) : new Date();
              
              return (
                <Card key={reg.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{event?.name}</h3>
                          <RegistrationStatusBadge status={reg.registration_status || 'pending'} />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(eventDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
                          </span>
                          {event?.location_city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {event.location_city}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Entrada: <span className="font-medium text-foreground">{ticketType?.name || 'General'}</span>
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {reg.registration_number}
                          </span>
                        </div>
                      </div>
                      
                      <Button asChild variant="outline" className="shrink-0">
                        <Link to={`/my-tickets/${reg.id}`} className="gap-2">
                          Ver entrada
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No tienes entradas</h2>
              <p className="text-muted-foreground mb-4">
                Aún no te has inscrito a ningún evento
              </p>
              <Button asChild>
                <Link to="/events">Ver eventos disponibles</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
