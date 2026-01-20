import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EventLocationFormProps {
  date: string;
  startTime: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  locationCity: string;
  registrationOpenDate: string;
  registrationCloseDate: string;
  maxCapacity: number | null;
  onUpdate: (field: string, value: string | number | null) => void;
}

export function EventLocationForm({
  date,
  startTime,
  endTime,
  locationName,
  locationAddress,
  locationCity,
  registrationOpenDate,
  registrationCloseDate,
  maxCapacity,
  onUpdate,
}: EventLocationFormProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fecha y Hora</CardTitle>
          <CardDescription>
            Define cuándo tendrá lugar el evento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha del evento *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => onUpdate("date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Hora de inicio</Label>
              <Input
                id="start_time"
                type="time"
                value={startTime}
                onChange={(e) => onUpdate("start_time", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Hora de fin</Label>
              <Input
                id="end_time"
                type="time"
                value={endTime}
                onChange={(e) => onUpdate("end_time", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ubicación</CardTitle>
          <CardDescription>
            Indica dónde se celebrará el evento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location_name">Nombre del lugar</Label>
            <Input
              id="location_name"
              value={locationName}
              onChange={(e) => onUpdate("location_name", e.target.value)}
              placeholder="Ej: Campus Google Madrid"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location_address">Dirección</Label>
            <Input
              id="location_address"
              value={locationAddress}
              onChange={(e) => onUpdate("location_address", e.target.value)}
              placeholder="Ej: Paseo de la Castellana, 259D"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location_city">Ciudad</Label>
            <Input
              id="location_city"
              value={locationCity}
              onChange={(e) => onUpdate("location_city", e.target.value)}
              placeholder="Ej: Madrid"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registro</CardTitle>
          <CardDescription>
            Configura las fechas de apertura y cierre de inscripciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="registration_open_date">Apertura de registro</Label>
              <Input
                id="registration_open_date"
                type="date"
                value={registrationOpenDate}
                onChange={(e) => onUpdate("registration_open_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration_close_date">Cierre de registro</Label>
              <Input
                id="registration_close_date"
                type="date"
                value={registrationCloseDate}
                onChange={(e) => onUpdate("registration_close_date", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_capacity">Aforo máximo total</Label>
            <Input
              id="max_capacity"
              type="number"
              min="1"
              value={maxCapacity || ""}
              onChange={(e) => onUpdate("max_capacity", e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Capacidad máxima del evento"
            />
            <p className="text-sm text-muted-foreground">
              Este es el aforo general. Cada tipo de entrada puede tener su propia capacidad.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
