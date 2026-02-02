import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Ticket, Clock, PlayCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TicketPriority = "nice_to_have" | "mandatory";
type TicketStatus = "pending" | "in_progress" | "completed";

interface DevelopmentTicket {
  id: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

const priorityLabels: Record<TicketPriority, string> = {
  nice_to_have: "Nice to Have",
  mandatory: "Obligatorio",
};

const statusLabels: Record<TicketStatus, string> = {
  pending: "Pendiente",
  in_progress: "En Desarrollo",
  completed: "Completado",
};

const statusIcons: Record<TicketStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  in_progress: <PlayCircle className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
};

const statusColors: Record<TicketStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-info/10 text-info border-info/20",
  completed: "bg-success/10 text-success border-success/20",
};

const priorityColors: Record<TicketPriority, string> = {
  nice_to_have: "bg-muted text-muted-foreground",
  mandatory: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function AdminTickets() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    priority: "nice_to_have" as TicketPriority,
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["development-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DevelopmentTicket[];
    },
  });

  const createTicket = useMutation({
    mutationFn: async (ticket: typeof newTicket) => {
      const { error } = await supabase.from("development_tickets").insert({
        title: ticket.title,
        description: ticket.description || null,
        priority: ticket.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development-tickets"] });
      toast.success("Ticket creado correctamente");
      setIsDialogOpen(false);
      setNewTicket({ title: "", description: "", priority: "nice_to_have" });
    },
    onError: () => {
      toast.error("Error al crear el ticket");
    },
  });

  const updateTicketStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: TicketStatus;
    }) => {
      const { error } = await supabase
        .from("development_tickets")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development-tickets"] });
      toast.success("Estado actualizado");
    },
    onError: () => {
      toast.error("Error al actualizar el estado");
    },
  });

  const groupedTickets = {
    pending: tickets?.filter((t) => t.status === "pending") || [],
    in_progress: tickets?.filter((t) => t.status === "in_progress") || [],
    completed: tickets?.filter((t) => t.status === "completed") || [],
  };

  const renderTicketCard = (ticket: DevelopmentTicket) => (
    <Card key={ticket.id} className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{ticket.title}</h4>
            {ticket.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {ticket.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={cn("text-xs", priorityColors[ticket.priority])}
              >
                {priorityLabels[ticket.priority]}
              </Badge>
            </div>
          </div>
          <Select
            value={ticket.status}
            onValueChange={(value: TicketStatus) =>
              updateTicketStatus.mutate({ id: ticket.id, status: value })
            }
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En Desarrollo</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout title="Tickets de Desarrollo">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Tickets de Desarrollo
            </h1>
            <p className="text-muted-foreground">
              Gestiona las solicitudes de nuevas funcionalidades
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={newTicket.title}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, title: e.target.value })
                    }
                    placeholder="Título del ticket"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newTicket.description}
                    onChange={(e) =>
                      setNewTicket({
                        ...newTicket,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe la funcionalidad..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(value: TicketPriority) =>
                      setNewTicket({ ...newTicket, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nice_to_have">Nice to Have</SelectItem>
                      <SelectItem value="mandatory">Obligatorio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createTicket.mutate(newTicket)}
                  disabled={!newTicket.title || createTicket.isPending}
                >
                  {createTicket.isPending ? "Creando..." : "Crear Ticket"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando tickets...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pendiente */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={cn("p-1.5 rounded", statusColors.pending)}>
                    {statusIcons.pending}
                  </div>
                  Pendiente
                  <Badge variant="secondary" className="ml-auto">
                    {groupedTickets.pending.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {groupedTickets.pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay tickets pendientes
                  </p>
                ) : (
                  groupedTickets.pending.map(renderTicketCard)
                )}
              </CardContent>
            </Card>

            {/* En Desarrollo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={cn("p-1.5 rounded", statusColors.in_progress)}>
                    {statusIcons.in_progress}
                  </div>
                  En Desarrollo
                  <Badge variant="secondary" className="ml-auto">
                    {groupedTickets.in_progress.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {groupedTickets.in_progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay tickets en desarrollo
                  </p>
                ) : (
                  groupedTickets.in_progress.map(renderTicketCard)
                )}
              </CardContent>
            </Card>

            {/* Completado */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={cn("p-1.5 rounded", statusColors.completed)}>
                    {statusIcons.completed}
                  </div>
                  Completado
                  <Badge variant="secondary" className="ml-auto">
                    {groupedTickets.completed.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {groupedTickets.completed.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay tickets completados
                  </p>
                ) : (
                  groupedTickets.completed.map(renderTicketCard)
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
