import { useState, useEffect } from 'react';
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
  Building2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMentorTeams } from '@/hooks/useMentorTeams';
import { useWorkshopPreferencesEligibility } from '@/hooks/useWorkshopPreferencesEligibility';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { WorkshopPreferencesPopup } from '@/components/mentor/WorkshopPreferencesPopup';

export default function MentorDashboard() {
  const { user, profile, role, signOut, isVerified } = useAuth();
  const { data: myTeams, isLoading: teamsLoading } = useMentorTeams(user?.id);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [preferencesPopupOpen, setPreferencesPopupOpen] = useState(false);

  // Hook for workshop preferences eligibility
  const { eligibleTeams, isLoading: eligibilityLoading } = useWorkshopPreferencesEligibility(user?.id);

  // Auto-show popup when there are pending teams
  useEffect(() => {
    if (!eligibilityLoading && eligibleTeams.length > 0) {
      // Check if there are pending teams (not submitted yet)
      const hasPending = eligibleTeams.some(t => !t.hasSubmittedPreferences);
      if (hasPending) {
        setPreferencesPopupOpen(true);
      }
    }
  }, [eligibleTeams, eligibilityLoading]);

  // Fetch user's hub name for display (read-only)
  const { data: userHub } = useQuery({
    queryKey: ['user-hub', profile?.hub_id],
    queryFn: async () => {
      if (!profile?.hub_id) return null;
      const { data, error } = await supabase
        .from('hubs')
        .select('id, name, location')
        .eq('id', profile.hub_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.hub_id,
  });

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
      
      const { data: mainRegistrations, error: mainError } = await supabase
        .from('event_registrations')
        .select(`
          *,
          event:events(*),
          ticket_type:event_ticket_types(*)
        `)
        .eq('user_id', user.id)
        .eq('is_companion', false)
        .neq('registration_status', 'cancelled')
        .order('created_at', { ascending: false });
      
      if (mainError) throw mainError;
      return mainRegistrations || [];
    },
    enabled: !!user,
  });

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const initials = profile 
    ? `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const getRoleBadge = (role: string | null) => {
    const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      participant: { label: 'Participante', variant: 'default' },
      mentor: { label: 'Mentor', variant: 'secondary' },
      judge: { label: 'Juez/a', variant: 'secondary' },
      volunteer: { label: 'Voluntario/a', variant: 'outline' },
      admin: { label: 'Admin', variant: 'secondary' },
    };
    const config = roleConfig[role || 'participant'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header - using secondary color for mentors */}
      <header className="bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-secondary-foreground/20">
                <AvatarFallback className="bg-secondary-foreground/10 text-secondary-foreground text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">
                  ¡Hola, {profile?.first_name || 'Mentor'}!
                </h1>
                <p className="text-secondary-foreground/80 text-sm">
                  Panel de Mentor - Technovation Spain
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-secondary-foreground hover:bg-secondary-foreground/10"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile */}
          <div className="space-y-6">
            {/* Profile Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-secondary" />
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
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      Hub
                    </span>
                    <span className="font-medium">
                      {userHub ? (
                        <>
                          {userHub.name}
                          {userHub.location && (
                            <span className="text-muted-foreground ml-1">({userHub.location})</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sin hub asignado</span>
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Teams, Tickets & Events */}
          <div className="lg:col-span-2 space-y-6">
            {/* Teams Card - Expandable */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-secondary" />
                    Mis Equipos
                    {myTeams && myTeams.length > 0 && (
                      <Badge variant="outline" className="ml-2">{myTeams.length}</Badge>
                    )}
                  </CardTitle>
                </div>
                <CardDescription>
                  Equipos que mentoreas y sus participantes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {teamsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="p-4 rounded-lg bg-muted/50">
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : myTeams && myTeams.length > 0 ? (
                  <div className="space-y-3">
                    {myTeams.map((team) => {
                      const isExpanded = expandedTeams.has(team.id);
                      const participants = team.members.filter(m => m.member_type === 'participant');
                      const otherMentors = team.members.filter(m => m.member_type === 'mentor' && m.user?.id !== user?.id);
                      
                      return (
                        <Collapsible key={team.id} open={isExpanded} onOpenChange={() => toggleTeam(team.id)}>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-secondary" />
                                </div>
                                <div className="text-left">
                                  <p className="font-medium">{team.name}</p>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{participants.length} participante{participants.length !== 1 ? 's' : ''}</span>
                                    {team.category && (
                                      <>
                                        <span>•</span>
                                        <span>{team.category}</span>
                                      </>
                                    )}
                                    {team.hub && (
                                      <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {team.hub.name}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-4 border-l-2 border-secondary/30 ml-6 mt-2 space-y-3">
                              {/* Participants */}
                              {participants.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Participantes
                                  </p>
                                  {participants.map((member, idx) => (
                                    <div key={member.user?.id || idx} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                                      <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs bg-secondary/10 text-secondary-foreground">
                                          {member.user?.first_name?.charAt(0) || '?'}
                                          {member.user?.last_name?.charAt(0) || ''}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">
                                          {member.user?.first_name} {member.user?.last_name}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {member.user?.email}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  No hay participantes en este equipo
                                </p>
                              )}
                              
                              {/* Other mentors */}
                              {otherMentors.length > 0 && (
                                <div className="space-y-2 pt-2 border-t">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Co-mentores
                                  </p>
                                  {otherMentors.map((member, idx) => (
                                    <div key={member.user?.id || idx} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                                      <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs bg-secondary/10 text-secondary">
                                          {member.user?.first_name?.charAt(0) || '?'}
                                          {member.user?.last_name?.charAt(0) || ''}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">
                                          {member.user?.first_name} {member.user?.last_name}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {member.user?.email}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No tienes equipos asignados todavía
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contacta con un administrador para ser asignado/a a un equipo
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My Tickets */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-secondary" />
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
                    {myRegistrations.map((reg: any) => {
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
                    <Calendar className="h-5 w-5 text-secondary" />
                    Próximos Eventos
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/events" className="gap-1">
                      Ver todos
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="p-4 rounded-lg border bg-card">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2 mb-3" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ))}
                  </div>
                ) : upcomingEvents && upcomingEvents.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {upcomingEvents.map((event) => (
                      <div key={event.id} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-medium line-clamp-1">{event.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(event.date), "EEEE d 'de' MMMM", { locale: es })}
                            </div>
                            {event.location_city && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                {event.location_city}
                              </div>
                            )}
                          </div>
                          <Button asChild size="sm" className="w-full">
                            <Link to={`/events/${event.id}`}>Ver detalles</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No hay eventos próximos
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Workshop Preferences Popup */}
      <WorkshopPreferencesPopup
        open={preferencesPopupOpen}
        onOpenChange={setPreferencesPopupOpen}
        eligibleTeams={eligibleTeams}
        currentUserId={user?.id}
      />
    </div>
  );
}
