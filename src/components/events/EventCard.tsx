import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MapPin, Users, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CapacityIndicator } from './CapacityIndicator';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type Event = Tables<'events'>;

interface EventCardProps {
  event: Event & { ticket_types?: Tables<'event_ticket_types'>[] };
}

export function EventCard({ event }: EventCardProps) {
  const { role, profile } = useAuth();
  const showCapacity = role === 'admin' || role === 'chapter_ambassador';
  const eventDate = new Date(event.date);
  const now = new Date();

  const isRegistrationOpen = event.registration_open_date && event.registration_close_date
    ? now >= new Date(event.registration_open_date) && now <= new Date(event.registration_close_date)
    : false;

  const totalCapacity = event.max_capacity || 0;
  const currentRegistrations = event.current_registrations || 0;

  const requiresImportedTeam =
    event.event_type === 'regional_final' &&
    (event.ticket_types || []).some((t: any) => t.requires_imported_team && t.is_active);

  const { data: hasImportedTeam } = useQuery({
    queryKey: ['user-imported-team', profile?.id, event.id],
    queryFn: async () => {
      if (!profile?.id) return false;
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', profile.id);
      if (!memberships || memberships.length === 0) return false;
      const teamIds = memberships.map((m) => m.team_id);
      const { data: match } = await supabase
        .from('event_teams')
        .select('id')
        .eq('event_id', event.id)
        .in('team_id', teamIds)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      return !!match;
    },
    enabled: !!profile?.id && requiresImportedTeam,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isTeamBlocked = requiresImportedTeam && hasImportedTeam === false;

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-shadow ${isTeamBlocked ? 'opacity-75' : ''}`}>
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

        {showCapacity && totalCapacity > 0 && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{currentRegistrations} / {totalCapacity} inscritos</span>
            </div>
            <CapacityIndicator
              current={currentRegistrations}
              max={totalCapacity}
              size="sm"
            />
          </>
        )}

        {isTeamBlocked && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Tu equipo no está inscrito en este evento.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter>
        <Button asChild={!isTeamBlocked} disabled={isTeamBlocked} className="w-full" variant={isTeamBlocked ? 'secondary' : 'default'}>
          {isTeamBlocked ? (
            <span>No disponible para tu equipo</span>
          ) : (
            <Link to={`/events/${event.id}`}>
              Ver evento
            </Link>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
