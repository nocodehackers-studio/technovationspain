import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccreditationStats } from "@/hooks/useAccreditationStats";
import { useScannedParticipants, ScannedParticipant } from "@/hooks/useScannedParticipants";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AirtableDataTable } from "@/components/admin/AirtableDataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowLeft, RefreshCw, CheckCircle, Loader2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = ["#22c55e", "#e5e7eb"];
const DONUT_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function formatEventDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMM yyyy", { locale: es });
  } catch {
    return dateStr;
  }
}

export default function AdminEventAccreditations() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const prevDataUpdatedAtRef = useRef<number | undefined>();

  const { data: event } = useQuery({
    queryKey: ["event-detail-accreditations", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("name, date")
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: stats, isLoading, error, refetch, isFetching, dataUpdatedAt } =
    useAccreditationStats(eventId);

  const { data: scannedParticipants, isLoading: isScannedLoading } =
    useScannedParticipants(eventId);

  const scannedColumns = useMemo<ColumnDef<ScannedParticipant, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Nombre",
        accessorFn: (row) =>
          [row.first_name, row.last_name].filter(Boolean).join(" ") || "—",
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "team_name",
        header: "Equipo",
        cell: ({ getValue }) => (getValue() as string) || "—",
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        id: "companions",
        header: "Acompañantes",
        accessorFn: (row) =>
          row.companions
            .map((c) => [c.first_name, c.last_name].filter(Boolean).join(" "))
            .filter(Boolean)
            .join(", ") || "",
        cell: ({ getValue }) => (getValue() as string) || "—",
      },
      {
        id: "checked_in_time",
        header: "Hora check-in",
        accessorFn: (row) => row.checked_in_at,
        cell: ({ getValue }) => {
          try {
            return format(new Date(getValue() as string), "HH:mm");
          } catch {
            return "—";
          }
        },
      },
    ],
    []
  );

  // Only update lastUpdate when data actually changes (new successful fetch)
  useEffect(() => {
    if (dataUpdatedAt && dataUpdatedAt !== prevDataUpdatedAtRef.current) {
      prevDataUpdatedAtRef.current = dataUpdatedAt;
      setLastUpdate(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  const handleRefresh = () => {
    refetch();
  };

  const handleBack = () => {
    navigate(`/admin/events/${eventId}/edit`);
  };

  const hasError = !!error;

  if (!eventId) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">ID de evento no encontrado</p>
          <Button onClick={() => navigate("/admin/events")}>Volver a eventos</Button>
        </div>
      </AdminLayout>
    );
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error && !stats) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">Error al cargar las acreditaciones</p>
          <Button onClick={() => refetch()}>Reintentar</Button>
        </div>
      </AdminLayout>
    );
  }

  if (!stats || (stats.totalRegistered === 0 && stats.companionsRegistered === 0)) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Header
            eventName={event?.name}
            eventDate={event?.date}
            lastUpdate={lastUpdate}
            isFetching={isFetching}
            hasError={hasError}
            onBack={handleBack}
            onRefresh={handleRefresh}
          />
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-2 text-muted-foreground">
            <CheckCircle className="h-12 w-12 opacity-30" />
            <p className="text-lg">No hay registros para este evento</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const totalAllRegistered = stats.totalRegistered + stats.companionsRegistered;
  const totalAllCheckedIn = stats.totalCheckedIn + stats.companionsCheckedIn;
  const totalPercentage =
    totalAllRegistered > 0
      ? Math.round((totalAllCheckedIn / totalAllRegistered) * 100)
      : 0;

  const mainDonutData = [
    { name: "Acreditados", value: totalAllCheckedIn },
    { name: "Pendientes", value: Math.max(0, totalAllRegistered - totalAllCheckedIn) },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Header
          eventName={event?.name}
          eventDate={event?.date}
          lastUpdate={lastUpdate}
          isFetching={isFetching}
          hasError={hasError}
          onBack={handleBack}
          onRefresh={handleRefresh}
        />

        {/* Main metric */}
        <Card>
          <CardContent className="flex flex-col items-center py-8 gap-4">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mainDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    {mainDonutData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{totalPercentage}%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold tracking-tight">
                {totalAllCheckedIn} / {totalAllRegistered}
              </p>
              <p className="text-muted-foreground mt-1">Total acreditados</p>
            </div>
          </CardContent>
        </Card>

        {/* By ticket type */}
        {stats.byTicketType.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Por tipo de entrada</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.byTicketType.map((tt, i) => (
                <DonutCard
                  key={tt.name}
                  label={tt.name}
                  checkedIn={tt.checkedIn}
                  registered={tt.registered}
                  percentage={tt.percentage}
                  color={DONUT_COLORS[i % DONUT_COLORS.length]}
                />
              ))}
            </div>
          </div>
        )}

        {/* By role */}
        {stats.byRole.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Por rol</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.byRole.map((r, i) => (
                <DonutCard
                  key={r.role}
                  label={r.role}
                  checkedIn={r.checkedIn}
                  registered={r.registered}
                  percentage={r.percentage}
                  color={DONUT_COLORS[(i + 3) % DONUT_COLORS.length]}
                />
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {stats.timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acreditaciones a lo largo del tiempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      name="Acreditaciones"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scanned participants table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Participantes acreditados</CardTitle>
          </CardHeader>
          <CardContent>
            <AirtableDataTable
              columns={scannedColumns}
              data={scannedParticipants || []}
              loading={isScannedLoading}
              searchPlaceholder="Buscar por nombre, equipo o email..."
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Header({
  eventName,
  eventDate,
  lastUpdate,
  isFetching,
  hasError,
  onBack,
  onRefresh,
}: {
  eventName?: string;
  eventDate?: string;
  lastUpdate: Date;
  isFetching: boolean;
  hasError: boolean;
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Acreditaciones en Vivo</h1>
          {eventName && (
            <p className="text-sm text-muted-foreground">
              {eventName}
              {eventDate && ` — ${formatEventDate(eventDate)}`}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={`flex items-center gap-1.5 ml-2 ${hasError ? "border-destructive text-destructive" : ""}`}
        >
          <span className="relative flex h-2 w-2">
            {hasError ? (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </>
            )}
          </span>
          {hasError ? "Sin conexión" : "En vivo"}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Última actualización:{" "}
          {format(lastUpdate, "HH:mm")}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>
    </div>
  );
}

function DonutCard({
  label,
  checkedIn,
  registered,
  percentage,
  color,
}: {
  label: string;
  checkedIn: number;
  registered: number;
  percentage: number;
  color: string;
}) {
  const data = [
    { name: "Acreditados", value: checkedIn },
    { name: "Pendientes", value: Math.max(0, registered - checkedIn) },
  ];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="relative w-16 h-16 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={30}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold">{percentage}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{label}</p>
          <p className="text-sm text-muted-foreground">
            {checkedIn} / {registered}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
