import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CapacityIndicator } from './CapacityIndicator';
import { Tables } from '@/integrations/supabase/types';

type Event = Tables<'events'>;

interface EventCardProps {
  event: Event & { ticket_types?: Tables<'event_ticket_types'>[] };
}

export function EventCard({ event }: EventCardProps) {
  const eventDate = new Date(event.date);
  const now = new Date();
  
  const isRegistrationOpen = event.registration_open_date && event.registration_close_date
    ? now >= new Date(event.registration_open_date) && now <= new Date(event.registration_close_date)
    : false;
  
  const totalCapacity = event.max_capacity || 0;
  const currentRegistrations = event.current_registrations || 0;
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {event.image_url && (
        <div className="aspect-video relative overflow-hidden">
          <img 
            src={event.image_url} 
            alt={event.name}
            className="object-cover w-full h-full"
          />
          <div className="absolute top-4 left-4">
            <Badge variant={isRegistrationOpen ? 'default' : 'secondary'}>
              {isRegistrationOpen ? 'Inscripciones abiertas' : 'Próximamente'}
            </Badge>
          </div>
        </div>
      )}
      
      <CardHeader>
        <h3 className="text-xl font-bold line-clamp-2">{event.name}</h3>
        {event.description && (
          <p className="text-muted-foreground text-sm line-clamp-2">
            {event.description}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            {format(eventDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </span>
        </div>
        
        {event.location_name && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{event.location_name}, {event.location_city}</span>
          </div>
        )}
        
        {totalCapacity > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{currentRegistrations} / {totalCapacity} inscritos</span>
          </div>
        )}
        
        {totalCapacity > 0 && (
          <CapacityIndicator 
            current={currentRegistrations} 
            max={totalCapacity}
            size="sm"
          />
        )}
      </CardContent>
      
      <CardFooter>
        <Button asChild className="w-full">
          <Link to={`/events/${event.id}`}>
            Ver evento
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
