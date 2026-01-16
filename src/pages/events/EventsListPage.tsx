import { Calendar } from 'lucide-react';
import { useEventsList } from '@/hooks/useEventRegistration';
import { EventCard } from '@/components/events/EventCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function EventsListPage() {
  const { data: events, isLoading, error } = useEventsList();
  
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
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <Calendar className="h-12 w-12" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Eventos Technovation</h1>
          <p className="text-lg opacity-90 max-w-2xl mx-auto">
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
