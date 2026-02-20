import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, CheckCircle2, AlertCircle, Users } from 'lucide-react';

interface EligibleTeam {
  teamId: string;
  teamName: string;
  eventId: string;
  eventName: string;
  hasSubmittedPreferences: boolean;
  hasWorkshopAssignments: boolean;
  submittedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

interface WorkshopPreferencesPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibleTeams: EligibleTeam[];
  currentUserId?: string;
}

export function WorkshopPreferencesPopup({
  open,
  onOpenChange,
  eligibleTeams,
  currentUserId,
}: WorkshopPreferencesPopupProps) {
  const navigate = useNavigate();

  // Filter to only show teams that haven't submitted yet OR were submitted by current user
  const pendingTeams = eligibleTeams.filter(
    t => !t.hasSubmittedPreferences
  );
  
  const submittedByOthers = eligibleTeams.filter(
    t => t.hasSubmittedPreferences && t.submittedBy?.id !== currentUserId
  );

  const submittedByMe = eligibleTeams.filter(
    t => t.hasSubmittedPreferences && t.submittedBy?.id === currentUserId
  );

  const handleGoToPreferences = (eventId: string) => {
    onOpenChange(false);
    navigate(`/events/${eventId}/workshop-preferences`);
  };

  if (eligibleTeams.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-secondary" />
            Preferencias de Talleres Abiertas
          </DialogTitle>
          <DialogDescription>
            Hay eventos con asignación de preferencias de talleres abierta para tus equipos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-80 overflow-y-auto">
          {/* Pending - need action */}
          {pendingTeams.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                Pendientes de asignar
              </h4>
              {pendingTeams.map((team) => (
                <div
                  key={`${team.teamId}-${team.eventId}`}
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{team.teamName}</p>
                      <p className="text-xs text-muted-foreground">{team.eventName}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleGoToPreferences(team.eventId)}>
                    Asignar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Submitted by others - informational */}
          {submittedByOthers.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2 text-blue-600">
                <CheckCircle2 className="h-4 w-4" />
                Ya asignados por otro mentor
              </h4>
              {submittedByOthers.map((team) => (
                <div
                  key={`${team.teamId}-${team.eventId}`}
                  className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-700" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{team.teamName}</p>
                      <p className="text-xs text-muted-foreground">{team.eventName}</p>
                      {team.submittedBy && (
                        <p className="text-xs text-blue-600">
                          Por: {team.submittedBy.firstName} {team.submittedBy.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">Completado</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Submitted by me - done */}
          {submittedByMe.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Asignados por ti
              </h4>
              {submittedByMe.map((team) => (
                <div
                  key={`${team.teamId}-${team.eventId}`}
                  className="flex items-center justify-between p-3 bg-green-50/50 border border-green-100 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{team.teamName}</p>
                      <p className="text-xs text-muted-foreground">{team.eventName}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-green-300 text-green-700">
                    ✓ Enviado
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
