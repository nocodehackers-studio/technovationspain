import { Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  Calendar,
  Ticket,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Clock,
  LogOut,
  Building2,
  MessageCircle,
  Gavel
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function JudgeDashboard() {
  const { user, profile, role, signOut, isVerified, isJudge, activeJudgeEventIds } = useAuth();

  // Guard: only judges should see this dashboard
  if (!isJudge) {
    return <Navigate to="/dashboard" replace />;
  }

  // Fetch user's hub name for display
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

  // Fetch only events the judge is assigned to (with access enabled)
  const { data: assignedEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['judge-assigned-events', activeJudgeEventIds],
    queryFn: async () => {
      if (!activeJudgeEventIds.length) return [];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .in('id', activeJudgeEventIds)
        .order('date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: activeJudgeEventIds.length > 0,
  });

  // Fetch judge's registrations
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
        .eq('is_companion', false)
        .neq('registration_status', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const initials = profile
    ? `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`
    : user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header — amber tone for judges */}
      <header className="bg-gradient-to-r from-amber-600 to-amber-500 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-white/20">
                <AvatarFallback className="bg-white/10 text-white text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">
                  ¡Hola, {profile?.first_name || 'Juez'}!
                </h1>
                <p className="text-white/80 text-sm">
                  Panel de juez — Technovation Girls Madrid
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
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
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-amber-600" />
                    Mi Perfil
                  </CardTitle>
                  <Badge variant="secondary">
                    <Gavel className="h-3 w-3 mr-1" />
                    Juez/a
                  </Badge>
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
                  {userHub && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-4 w-4" />
                          Hub
                        </span>
                        <span className="font-medium">
                          {userHub.name}
                          {userHub.location && (
                            <span className="text-muted-foreground ml-1">({userHub.location})</span>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Events & Tickets */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Tickets */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-amber-600" />
                  Mis Entradas
                </CardTitle>
                <CardDescription>
                  Tus inscripciones como juez
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
                              <span>{ticketType?.name || 'Juez'}</span>
                            </div>
                          </div>
                          <Badge
                            variant={
                              reg.registration_status === 'confirmed' ? 'default' :
                              reg.registration_status === 'waitlisted' ? 'orange' :
                              'secondary'
                            }
                          >
                            {reg.registration_status === 'confirmed' ? 'Confirmada' :
                             reg.registration_status === 'waitlisted' ? 'Lista de espera' :
                             'Pendiente'}
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
                    {assignedEvents && assignedEvents.length > 0 && (
                      <Button asChild size="sm">
                        <Link to={`/events/${assignedEvents[0].id}`}>Obtener entrada</Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned Events */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  Mis Eventos Asignados
                </CardTitle>
                <CardDescription>
                  Eventos donde participas como juez
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="space-y-3">
                    {[1].map((i) => (
                      <div key={i} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-8 w-28" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : assignedEvents && assignedEvents.length > 0 ? (
                  <div className="space-y-3">
                    {assignedEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
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
                        <Button asChild size="sm">
                          <Link to={`/events/${event.id}`} className="gap-1">
                            Obtener entrada
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No tienes eventos asignados
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Fixed Support Button */}
      <a
        href="mailto:soporte@powertocode.org"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-700 transition-colors"
        title="Soporte"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
}
