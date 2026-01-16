import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { 
  User, 
  Calendar, 
  Ticket, 
  Users, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  LogOut,
  Bell
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function ParticipantDashboard() {
  const { user, profile, role, signOut, isVerified } = useAuth();

  // Fetch upcoming events
  const { data: upcomingEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date', today)
        .eq('status', 'published')
        .order('date', { ascending: true })
        .limit(3);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's registrations
  const { data: myRegistrations, isLoading: registrationsLoading } = useQuery({
    queryKey: ['my-registrations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          *,
          event:events(*),
          ticket_type:event_ticket_types(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's team
  const { data: myTeam, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: teamMember, error: memberError } = await supabase
        .from('team_members')
        .select(`
          *,
          team:teams(
            *,
            hub:hubs(name, location)
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (memberError) throw memberError;
      if (!teamMember?.team) return null;

      // Get team members count
      const { count } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamMember.team.id);

      return {
        ...teamMember.team,
        memberCount: count || 0,
        memberType: teamMember.member_type,
      };
    },
    enabled: !!user,
  });

  // Removed blocking loading state - now we show skeletons per section

  const initials = profile 
    ? `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const getRoleBadge = (role: string | null) => {
    const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      participant: { label: 'Participante', variant: 'default' },
      mentor: { label: 'Mentor/a', variant: 'secondary' },
      judge: { label: 'Juez/a', variant: 'secondary' },
      volunteer: { label: 'Voluntario/a', variant: 'outline' },
      admin: { label: 'Admin', variant: 'secondary' },
    };
    const config = roleConfig[role || 'participant'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary-foreground/20">
                <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">
                  ¡Hola, {profile?.first_name || 'Participante'}!
                </h1>
                <p className="text-primary-foreground/80 text-sm">
                  Bienvenido/a a Technovation Spain
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Bell className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10"
                onClick={signOut}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile & Team */}
          <div className="space-y-6">
            {/* Profile Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Mi Perfil
                  </CardTitle>
                  {getRoleBadge(role)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nombre</span>
                    <span className="font-medium">
                      {profile?.first_name} {profile?.last_name}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium truncate max-w-[180px]">
                      {profile?.email || user?.email}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estado</span>
                    {isVerified ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Verificado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="h-4 w-4" />
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Mi Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ) : myTeam ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg">{myTeam.name}</h3>
                      {myTeam.category && (
                        <Badge variant="outline" className="mt-1">
                          {myTeam.category}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {myTeam.memberCount} miembro{myTeam.memberCount !== 1 ? 's' : ''}
                      </div>
                      {myTeam.hub && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {myTeam.hub.name}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Rol:</span>
                        <span className="font-medium capitalize">{myTeam.memberType}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No estás en ningún equipo todavía
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Events & Tickets */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Tickets */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" />
                    Mis Entradas
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/events" className="gap-1">
                      Ver eventos
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Tus inscripciones a eventos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {registrationsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                      </div>
                    ))}
                  </div>
                ) : myRegistrations && myRegistrations.length > 0 ? (
                  <div className="space-y-3">
                    {myRegistrations.map((reg) => {
                      const event = reg.event as any;
                      const ticketType = reg.ticket_type as any;
                      
                      return (
                        <Link
                          key={reg.id}
                          to={`/tickets/${reg.id}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="space-y-1">
                            <p className="font-medium">{event?.name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {event?.date && format(new Date(event.date), "d MMM", { locale: es })}
                              </span>
                              <span>{ticketType?.name || 'General'}</span>
                            </div>
                          </div>
                          <Badge 
                            variant={reg.registration_status === 'confirmed' ? 'default' : 'secondary'}
                          >
                            {reg.registration_status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Ticket className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      No tienes entradas todavía
                    </p>
                    <Button asChild size="sm">
                      <Link to="/events">Ver eventos disponibles</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Events */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Próximos Eventos
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/events" className="gap-1">
                      Ver todos
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Eventos de Technovation España
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-5 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : upcomingEvents && upcomingEvents.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => (
                      <Link
                        key={event.id}
                        to={`/events/${event.id}`}
                        className="block p-4 rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="font-semibold">{event.name}</h3>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(event.date), "d 'de' MMMM", { locale: es })}
                              </span>
                              {event.location_city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {event.location_city}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            {event.event_type || 'Evento'}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No hay eventos próximos disponibles
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
