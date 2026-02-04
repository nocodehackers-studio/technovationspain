import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'orange' }> = {
  pending: { label: 'Pendiente', variant: 'secondary' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  checked_in: { label: 'Check-in realizado', variant: 'outline' },
  waitlisted: { label: 'Lista de espera', variant: 'orange' },
};

interface RegistrationStatusBadgeProps {
  status: string;
}

export function RegistrationStatusBadge({ status }: RegistrationStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
