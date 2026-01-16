import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Users, Calendar, QrCode, ArrowRight, LogOut } from 'lucide-react';
import { LoadingPage } from '@/components/ui/loading-spinner';

export default function Index() {
  const { user, profile, role, isLoading, signOut } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  // If logged in, show dashboard redirect
  if (user && profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-muted">
        <header className="border-b bg-background/80 backdrop-blur-sm">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="font-display font-bold text-xl">Technovation España</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {profile.first_name} {profile.last_name}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </header>

        <main className="container py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold mb-2">
              ¡Hola, {profile.first_name}! 👋
            </h1>
            <p className="text-muted-foreground">
              {profile.verification_status === 'verified' 
                ? 'Tu cuenta está verificada. ¡Explora los eventos disponibles!'
                : 'Tu cuenta está pendiente de verificación. Te notificaremos cuando esté lista.'}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Calendar className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Eventos</CardTitle>
                <CardDescription>Inscríbete a los próximos eventos</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" disabled={profile.verification_status !== 'verified'}>
                  Ver eventos
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <QrCode className="h-8 w-8 text-accent mb-2" />
                <CardTitle>Mis Entradas</CardTitle>
                <CardDescription>Descarga tus códigos QR</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled={profile.verification_status !== 'verified'}>
                  Ver entradas
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Users className="h-8 w-8 text-success mb-2" />
                <CardTitle>Mi Equipo</CardTitle>
                <CardDescription>Gestiona tu equipo</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled={profile.verification_status !== 'verified'}>
                  Ver equipo
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Landing page for non-authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-muted">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-xl">Technovation España</span>
          </div>
          <Link to="/login">
            <Button>Acceder</Button>
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 text-gradient-primary">
            Empoderar a las niñas para cambiar el mundo
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Technovation Girls es el programa de emprendimiento tecnológico más grande del mundo para niñas de 8 a 18 años.
          </p>
          <Link to="/login">
            <Button size="lg" className="gradient-primary text-lg px-8">
              Únete ahora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>

        {/* Features */}
        <section className="container py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="text-center border-none shadow-lg">
              <CardHeader>
                <div className="mx-auto w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>~1000 Participantes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Niñas de toda España trabajando en proyectos tecnológicos innovadores.</p>
              </CardContent>
            </Card>

            <Card className="text-center border-none shadow-lg">
              <CardHeader>
                <div className="mx-auto w-16 h-16 rounded-full gradient-accent flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-accent-foreground" />
                </div>
                <CardTitle>~700 Mentoras</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Profesionales que guían y apoyan a los equipos durante todo el programa.</p>
              </CardContent>
            </Card>

            <Card className="text-center border-none shadow-lg">
              <CardHeader>
                <div className="mx-auto w-16 h-16 rounded-full gradient-warm flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-warning-foreground" />
                </div>
                <CardTitle>Eventos Regionales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Talleres, presentaciones y eventos en toda España.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2025 Technovation España. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}