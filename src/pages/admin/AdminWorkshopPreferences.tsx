import { useParams, Link } from 'react-router-dom';
import { useAllTeamsPreferences } from '@/hooks/useWorkshopPreferences';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, ClipboardList, Check, Clock, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';

export default function AdminWorkshopPreferences() {
  const { eventId } = useParams();
  const { data: teamsData, isLoading } = useAllTeamsPreferences(eventId || '');
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Fetch event
  const { data: event } = useQuery({
    queryKey: ['admin-event', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data } = await supabase
        .from('events')
        .select('id, name, date')
        .eq('id', eventId)
        .single();
      return data;
    },
    enabled: !!eventId,
  });

  const teamsWithPrefs = teamsData?.filter(t => t.hasPreferences).length || 0;
  const totalTeams = teamsData?.length || 0;
  const progressPercentage = totalTeams > 0 ? (teamsWithPrefs / totalTeams) * 100 : 0;

  const handleExportCSV = () => {
    if (!teamsData) return;

    const headers = ['Equipo', 'Categoría', 'Estado', 'Enviado por', 'Fecha envío', 'Pref 1', 'Pref 2', 'Pref 3', 'Pref 4', 'Pref 5', 'Pref 6', 'Pref 7'];
    const rows = teamsData.map(team => {
      const prefs = team.preferencesData?.preferences || [];
      const prefNames: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const pref = prefs.find(p => p.order === i);
        prefNames.push(pref?.workshopName || '');
      }
      
      return [
        team.name,
        team.category || '',
        team.hasPreferences ? 'Enviado' : 'Pendiente',
        team.preferencesData?.submittedBy || '',
        team.preferencesData?.submittedAt 
          ? format(new Date(team.preferencesData.submittedAt), 'dd/MM/yyyy HH:mm')
          : '',
        ...prefNames,
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `preferencias-talleres-${event?.name || 'evento'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Estado de Preferencias">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/admin/events/${eventId}/edit`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardList className="h-6 w-6" />
                Estado de Preferencias
              </h1>
              <p className="text-muted-foreground">{event?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExportCSV} disabled={!teamsData?.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Progress Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resumen</CardTitle>
            <CardDescription>
              {teamsWithPrefs} de {totalTeams} equipos han enviado preferencias ({Math.round(progressPercentage)}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>{teamsWithPrefs} enviadas</span>
              <span>{totalTeams - teamsWithPrefs} pendientes</span>
            </div>
          </CardContent>
        </Card>

        {/* Teams Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Equipos</CardTitle>
            <CardDescription>
              Click en un equipo para ver sus preferencias detalladas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : teamsData && teamsData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Participantes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Enviado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamsData.map((team) => (
                    <TableRow 
                      key={team.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedTeam(team);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>
                        {team.category ? (
                          <Badge variant="outline">{team.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{team.participantCount}</TableCell>
                      <TableCell>
                        {team.hasPreferences ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Check className="mr-1 h-3 w-3" />
                            Enviado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="mr-1 h-3 w-3" />
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {team.preferencesData?.submittedAt ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(team.preferencesData.submittedAt), "d MMM HH:mm", { locale: es })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay equipos registrados para este evento.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Preferencias: {selectedTeam?.name}</DialogTitle>
              <DialogDescription>
                {selectedTeam?.hasPreferences ? (
                  <>
                    Enviado por: {selectedTeam.preferencesData?.submittedBy}
                    <br />
                    Fecha: {selectedTeam.preferencesData?.submittedAt && 
                      format(new Date(selectedTeam.preferencesData.submittedAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                  </>
                ) : (
                  'Este equipo aún no ha enviado sus preferencias'
                )}
              </DialogDescription>
            </DialogHeader>
            
            {selectedTeam?.hasPreferences && selectedTeam.preferencesData?.preferences && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Orden de preferencia:</p>
                <div className="space-y-2">
                  {selectedTeam.preferencesData.preferences
                    .sort((a: any, b: any) => a.order - b.order)
                    .map((pref: any) => (
                      <div 
                        key={pref.order}
                        className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                      >
                        <Badge variant="secondary" className="shrink-0">
                          {pref.order}
                        </Badge>
                        <span className="text-sm">{pref.workshopName}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
