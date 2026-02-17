import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Calendar, MapPin, Download, CalendarPlus, XCircle, Users, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useRegistration, useCancelRegistration, useRegistrationCompanions } from '@/hooks/useEventRegistration';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPath } from '@/lib/dashboard-routes';
import { isMinor } from '@/lib/age-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { QRTicket } from '@/components/events/QRTicket';
import { RegistrationStatusBadge } from '@/components/events/RegistrationStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function TicketDetailPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
  const { role, profile } = useAuth();
  const dashboardPath = getDashboardPath(role);
  const { data: registration, isLoading, error } = useRegistration(registrationId || '');
  const { data: companions, isLoading: companionsLoading } = useRegistrationCompanions(registrationId || '');
  const cancelMutation = useCancelRegistration();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [companionsExpanded, setCompanionsExpanded] = useState(true);
  
  const handleCancel = async () => {
    if (!registrationId) return;
    
    try {
      await cancelMutation.mutateAsync(registrationId);
      setShowCancelDialog(false);
    } catch (err) {
      console.error('Error cancelling registration:', err);
    }
  };
  
  const isCancelled = registration?.registration_status === 'cancelled';
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (error || !registration) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Entrada no encontrada</p>
          <Button onClick={() => navigate(dashboardPath)}>Volver al dashboard</Button>
        </div>
      </div>
    );
  }
  
  const event = registration.event as any;
  const ticketType = registration.ticket_type as any;
  const eventDate = event ? new Date(event.date) : new Date();
  
  // Generate calendar event URL (Google Calendar)
  const generateCalendarUrl = () => {
    if (!event) return '#';
    
    const startDate = new Date(event.date);
    if (event.start_time) {
      const [hours, minutes] = event.start_time.split(':');
      startDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    const endDate = new Date(event.date);
    if (event.end_time) {
      const [hours, minutes] = event.end_time.split(':');
      endDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.name,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: event.description || '',
      location: `${event.location_name}, ${event.location_address}, ${event.location_city}`,
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };
  
  // Helper to translate relationship values
  const getRelationshipLabel = (value: string): string => {
    const labels: Record<string, string> = {
      mother: 'Madre',
      father: 'Padre',
      guardian: 'Tutor/a legal',
      grandparent: 'Abuelo/a',
      sibling: 'Hermano/a mayor',
      other: 'Otro familiar',
    };
    return labels[value] || value;
  };

  const hasCompanions = companions && companions.length > 0;
  
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(dashboardPath)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al dashboard
          </Button>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Ticket Card */}
        <Card className="overflow-hidden">
          {/* Header with gradient */}
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm opacity-90 font-medium tracking-wider">TECHNOVATION GIRLS ESPAÑA</p>
                <h2 className="text-xl font-bold mt-1">{event?.name}</h2>
              </div>
              <RegistrationStatusBadge status={registration.registration_status || 'pending'} />
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Consent pending banner — only for minors (≤13) */}
            {registration.registration_status === 'confirmed' &&
             isMinor(profile?.date_of_birth) &&
             (!(registration as any).consent ||
              (Array.isArray((registration as any).consent) && (registration as any).consent.length === 0)) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-800">Pendiente de consentimiento</p>
                  <p className="text-xs text-orange-600">
                    El padre/madre/tutor debe firmar el consentimiento para poder asistir al evento.
                  </p>
                </div>
              </div>
            )}

            {/* QR Code */}
            <div className="flex justify-center py-4">
              <QRTicket code={registration.qr_code} size={200} />
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Número de registro</p>
              <p className="font-mono font-bold text-lg">{registration.registration_number}</p>
            </div>
            
            {/* Details */}
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Asistente</p>
                  <p className="font-medium">{registration.first_name} {registration.last_name}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de entrada</p>
                  <p className="font-medium">{ticketType?.name || 'General'}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{registration.email}</p>
              </div>
              
              {registration.team_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Equipo</p>
                  <p className="font-medium">{registration.team_name}</p>
                </div>
              )}
              
              <div className="flex items-start gap-3 pt-4 border-t">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">
                    {format(eventDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                  {event?.start_time && event?.end_time && (
                    <p className="text-sm text-muted-foreground">
                      {event.start_time} - {event.end_time}
                    </p>
                  )}
                </div>
              </div>
              
              {event?.location_name && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{event.location_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.location_address}, {event.location_city}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          
          {/* Actions */}
          <div className="border-t p-4 space-y-3">
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-2" disabled>
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>
              <Button variant="outline" className="flex-1 gap-2" asChild>
                <a href={generateCalendarUrl()} target="_blank" rel="noopener noreferrer">
                  <CalendarPlus className="h-4 w-4" />
                  Añadir al calendario
                </a>
              </Button>
            </div>
            
            {!isCancelled && (
              <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full gap-2">
                    <XCircle className="h-4 w-4" />
                    Cancelar entrada
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Cancelar tu entrada?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción cancelará tu inscripción al evento "{event?.name}". 
                      Se liberará tu plaza y podrás volver a inscribirte si hay disponibilidad.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No, mantener entrada</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar entrada'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            
            {cancelMutation.isError && (
              <p className="text-sm text-destructive text-center">
                {(cancelMutation.error as Error)?.message || 'Error al cancelar la entrada'}
              </p>
            )}
          </div>
        </Card>
        
        {/* Companion Tickets */}
        {hasCompanions && (
          <Card>
            <Collapsible open={companionsExpanded} onOpenChange={setCompanionsExpanded}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Entradas de acompañantes</span>
                    <Badge variant="outline">{companions.length}</Badge>
                  </div>
                  {companionsExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4 pt-0 space-y-4">
                  {companions.map((companion, index) => (
                    <div key={companion.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {companion.first_name && companion.last_name 
                              ? `${companion.first_name} ${companion.last_name}`
                              : `Acompañante ${index + 1}`}
                          </p>
                          {companion.relationship && (
                            <p className="text-sm text-muted-foreground">
                              {getRelationshipLabel(companion.relationship)}
                            </p>
                          )}
                        </div>
                        {companion.checked_in_at ? (
                          <Badge className="bg-success text-success-foreground">Check-in realizado</Badge>
                        ) : (
                          <Badge variant="default">Confirmada</Badge>
                        )}
                      </div>
                      
                      {/* Companion QR */}
                      <div className="flex justify-center py-2">
                        <QRTicket code={companion.qr_code} size={140} />
                      </div>
                      
                      <p className="text-center text-xs text-muted-foreground">
                        Cada acompañante debe presentar su propio código QR
                      </p>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>
    </div>
  );
}
