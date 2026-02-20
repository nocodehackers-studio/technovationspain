import { useEventVolunteers } from '@/hooks/useVolunteerEvents';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Heart, Trash2, QrCode, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useState } from 'react';

interface EventVolunteersViewProps {
  eventId: string;
}

export function EventVolunteersView({ eventId }: EventVolunteersViewProps) {
  const { volunteers, isLoading, removeVolunteer, isRemoving } = useEventVolunteers(eventId);
  const queryClient = useQueryClient();
  const [volunteerToRemove, setVolunteerToRemove] = useState<string | null>(null);

  // Check if volunteer already has is_volunteer flag
  const checkHasVolunteerFlag = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('profiles')
      .select('is_volunteer')
      .eq('id', userId)
      .single();

    return (data as any)?.is_volunteer ?? false;
  };

  // Assign volunteer/QR validator flag mutation
  const assignQRRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      const hasFlag = await checkHasVolunteerFlag(userId);
      if (hasFlag) {
        throw new Error('Este voluntario ya tiene el rol de validador QR');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ is_volunteer: true } as any)
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-volunteers', eventId] });
      toast.success('Rol de validador QR asignado');
    },
    onError: (error: any) => {
      toast.info(error.message);
    },
  });

  const handleConfirmRemove = () => {
    if (volunteerToRemove) {
      removeVolunteer(volunteerToRemove);
      setVolunteerToRemove(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-accent" />
            <CardTitle>Voluntarios del Evento</CardTitle>
          </div>
          <CardDescription>
            {volunteers?.length || 0} voluntarios inscritos para ayudar en este evento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {volunteers && volunteers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Inscripción</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteers.map(volunteer => (
                  <TableRow key={volunteer.id}>
                    <TableCell className="font-medium">
                      {volunteer.profile.first_name && volunteer.profile.last_name
                        ? `${volunteer.profile.first_name} ${volunteer.profile.last_name}`
                        : <span className="text-muted-foreground italic">Sin nombre</span>
                      }
                    </TableCell>
                    <TableCell>{volunteer.profile.email}</TableCell>
                    <TableCell>
                      {volunteer.profile.phone || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(volunteer.created_at), "d MMM yyyy", { locale: es })}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => assignQRRoleMutation.mutate(volunteer.user_id)}
                          disabled={assignQRRoleMutation.isPending}
                          title="Asignar como validador QR"
                        >
                          <QrCode className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Validador QR</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setVolunteerToRemove(volunteer.id)}
                          disabled={isRemoving}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Eliminar del evento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay voluntarios inscritos en este evento.</p>
              <p className="text-sm mt-1">
                Los voluntarios pueden apuntarse desde su portal en /voluntario
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!volunteerToRemove}
        onOpenChange={(open) => !open && setVolunteerToRemove(null)}
        title="Eliminar voluntario"
        description="¿Estás seguro de que quieres eliminar a este voluntario del evento? Podrá volver a apuntarse si lo desea."
        confirmText="Eliminar"
        onConfirm={handleConfirmRemove}
        variant="danger"
      />
    </>
  );
}
