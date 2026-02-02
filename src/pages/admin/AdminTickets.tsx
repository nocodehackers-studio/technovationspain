import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  ChevronRight,
  Clock,
  PlayCircle,
  CheckCircle2,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
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

const statusConfig: Record<
  TicketStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "Pendiente",
    icon: <Clock className="h-4 w-4" />,
    color: "text-warning",
  },
  in_progress: {
    label: "En Desarrollo",
    icon: <PlayCircle className="h-4 w-4" />,
    color: "text-info",
  },
  completed: {
    label: "Completado",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-success",
  },
};

export default function AdminTickets() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<TicketStatus, boolean>
  >({
    pending: true,
    in_progress: true,
    completed: false,
  });
  const [draggedTicket, setDraggedTicket] = useState<DevelopmentTicket | null>(
    null
  );
  const [dragOverStatus, setDragOverStatus] = useState<TicketStatus | null>(
    null
  );
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

  const groupedTickets: Record<TicketStatus, DevelopmentTicket[]> = {
    pending: tickets?.filter((t) => t.status === "pending") || [],
    in_progress: tickets?.filter((t) => t.status === "in_progress") || [],
    completed: tickets?.filter((t) => t.status === "completed") || [],
  };

  const toggleSection = (status: TicketStatus) => {
    setExpandedSections((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  // Drag & Drop handlers
  const handleDragStart = (
    e: React.DragEvent,
    ticket: DevelopmentTicket
  ) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedTicket(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TicketStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TicketStatus) => {
    e.preventDefault();
    if (draggedTicket && draggedTicket.status !== targetStatus) {
      updateTicketStatus.mutate({
        id: draggedTicket.id,
        status: targetStatus,
      });
    }
    setDraggedTicket(null);
    setDragOverStatus(null);
  };

  const renderTicketRow = (ticket: DevelopmentTicket) => {
    const config = statusConfig[ticket.status];
    const isDragging = draggedTicket?.id === ticket.id;

    return (
      <div
        key={ticket.id}
        draggable
        onDragStart={(e) => handleDragStart(e, ticket)}
        onDragEnd={handleDragEnd}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-all",
          isDragging && "opacity-50 bg-muted"
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
        
        <div className={cn("flex-shrink-0", config.color)}>{config.icon}</div>
        
        {ticket.priority === "mandatory" && (
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
        )}
        
        <span className="text-sm flex-1 truncate">{ticket.title}</span>
        
        <Badge
          variant="outline"
          className={cn(
            "text-xs flex-shrink-0",
            ticket.priority === "mandatory"
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : "bg-muted text-muted-foreground"
          )}
        >
          {priorityLabels[ticket.priority]}
        </Badge>
      </div>
    );
  };

  const renderStatusSection = (status: TicketStatus) => {
    const config = statusConfig[status];
    const sectionTickets = groupedTickets[status];
    const isExpanded = expandedSections[status];
    const isDragOver = dragOverStatus === status;

    return (
      <Collapsible
        key={status}
        open={isExpanded}
        onOpenChange={() => toggleSection(status)}
        className="mb-2"
      >
        <div
          onDragOver={(e) => handleDragOver(e, status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status)}
          className={cn(
            "rounded-lg border transition-all",
            isDragOver && "ring-2 ring-primary ring-offset-2"
          )}
        >
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full px-4 py-3 hover:bg-muted/50 rounded-t-lg transition-colors">
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
              <div className={cn("flex-shrink-0", config.color)}>
                {config.icon}
              </div>
              <span className="font-medium text-sm">{config.label}</span>
              <Badge variant="secondary" className="ml-2">
                {sectionTickets.length}
              </Badge>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t">
              {sectionTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay tickets en este estado
                </p>
              ) : (
                sectionTickets.map(renderTicketRow)
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <AdminLayout title="Tickets de Desarrollo">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Tickets de Desarrollo
            </h1>
            <p className="text-muted-foreground">
              Arrastra los tickets entre secciones para cambiar su estado
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
          <div className="space-y-2">
            {(["pending", "in_progress", "completed"] as TicketStatus[]).map(
              renderStatusSection
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
