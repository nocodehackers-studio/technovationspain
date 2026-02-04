import { Link } from 'react-router-dom';
import { Calendar, ArrowLeft, LogOut } from 'lucide-react';
import { useEventsList } from '@/hooks/useEventRegistration';
import { EventCard } from '@/components/events/EventCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPath } from '@/lib/dashboard-routes';

export default function EventsListPage() {
  const { data: events, isLoading, error } = useEventsList();
  const { signOut, role } = useAuth();
  const dashboardPath = getDashboardPath(role);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">Error al cargar los eventos</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={dashboardPath} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al dashboard</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => signOut()}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="gradient-hero text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <Calendar className="h-12 w-12" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display mb-4">Eventos Technovation</h1>
          <p className="text-lg opacity-95 max-w-2xl mx-auto">
            Descubre los próximos eventos de Technovation Girls España. 
            Talleres, encuentros intermedios y finales regionales.
          </p>
        </div>
      </div>
      
      {/* Events Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {events && events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No hay eventos disponibles</h2>
            <p className="text-muted-foreground">
              Vuelve pronto para ver los próximos eventos de Technovation España.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
