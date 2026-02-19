import { useAuth } from '@/hooks/useAuth';
import { useVolunteerEvents } from '@/hooks/useVolunteerEvents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Heart, Calendar, MapPin, LogOut, QrCode, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";

export default function VolunteerDashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut, role, isVolunteer } = useAuth();
  const { mySignups, availableEvents, signedUpEventIds, isLoading, signUp, cancelSignup, isSigningUp, isCanceling } = useVolunteerEvents(user?.id);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`
    : profile?.email?.slice(0, 2).toUpperCase() || 'V';

  // Check if user has QR validator capabilities
  const canValidateQR = isVolunteer || role === 'admin';

  // Filter events that user hasn't signed up for yet
  const eventsToShow = availableEvents?.filter(e => !signedUpEventIds.includes(e.id)) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_TECHNOVATION} alt="Technovation" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <h1 className="font-display font-bold text-lg">Portal de Voluntarios</h1>
              <p className="text-xs text-muted-foreground">Technovation España</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-accent/20 text-accent font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">{profile?.first_name || 'Voluntario/a'}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome card */}
        <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                <Heart className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-display font-bold">
                  ¡Hola, {profile?.first_name || 'Voluntario/a'}!
                </h2>
                <p className="text-muted-foreground mt-1">
                  Gracias por formar parte del equipo de voluntarios de Technovation España.
                  Aquí puedes apuntarte a los eventos en los que quieras colaborar.
                </p>
                {canValidateQR && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/validate')}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Ir al escáner de entradas
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My signups */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" />
            Mis eventos ({mySignups?.length || 0})
          </h3>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : mySignups && mySignups.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {mySignups.map(signup => (
                <Card key={signup.id} className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{signup.event.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">Inscrito/a</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(signup.event.date), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                      </span>
                    </div>
                    {signup.event.location_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {signup.event.location_name}
                          {signup.event.location_city && `, ${signup.event.location_city}`}
                        </span>
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-2"
                      onClick={() => cancelSignup(signup.id)}
                      disabled={isCanceling}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Cancelar inscripción
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>Aún no te has apuntado a ningún evento.</p>
                <p className="text-sm">Mira los eventos disponibles abajo y apúntate.</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Available events */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Eventos disponibles ({eventsToShow.length})
          </h3>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : eventsToShow.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {eventsToShow.map(event => (
                <Card key={event.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{event.name}</CardTitle>
                    <CardDescription>
                      {format(new Date(event.date), "EEEE, d 'de' MMMM", { locale: es })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {event.location_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {event.location_name}
                          {event.location_city && `, ${event.location_city}`}
                        </span>
                      </div>
                    )}
                    {event.start_time && (
                      <p className="text-sm text-muted-foreground">
                        {event.start_time.slice(0, 5)}
                        {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                      </p>
                    )}
                    <Button 
                      className="w-full"
                      onClick={() => signUp({ eventId: event.id })}
                      disabled={isSigningUp}
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      Apuntarme como voluntario/a
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>No hay eventos disponibles en este momento.</p>
                <p className="text-sm">Vuelve pronto para ver nuevos eventos.</p>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
