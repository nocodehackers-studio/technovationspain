import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { EventEmailSend, useEventEmailSends } from "@/hooks/useEventEmails";

interface EmailHistoryTableProps {
  sends: EventEmailSend[];
  isLoading: boolean;
}

function getStatusBadge(status: EventEmailSend["status"]) {
  switch (status) {
    case "scheduled":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Programado
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Enviando
        </Badge>
      );
    case "sent":
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Enviado
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Fallido
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <X className="h-3 w-3" />
          Cancelado
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return "-";
  return format(new Date(dateString), "d MMM yyyy, HH:mm", { locale: es });
}

export function EmailHistoryTable({ sends, isLoading }: EmailHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Cargando historial...
      </div>
    );
  }

  if (sends.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
        <p>No hay envíos registrados todavía</p>
        <p className="text-sm mt-1">
          Los envíos de recordatorios aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asunto</TableHead>
            <TableHead className="text-center">Destinatarios</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sends.map((send) => (
            <TableRow key={send.id}>
              <TableCell className="font-medium max-w-[200px] truncate">
                {send.subject}
              </TableCell>
              <TableCell className="text-center">{send.recipients_count}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {send.status === "scheduled"
                  ? formatDate(send.scheduled_for)
                  : formatDate(send.sent_at || send.created_at)}
              </TableCell>
              <TableCell>{getStatusBadge(send.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
