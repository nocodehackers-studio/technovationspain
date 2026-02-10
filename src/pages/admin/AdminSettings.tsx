import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Settings, Mail, Bell, Shield, Database, UserCheck } from "lucide-react";
import { usePlatformSetting, useUpdatePlatformSetting } from "@/hooks/usePlatformSettings";

export default function AdminSettings() {
  const { data: judgeRegEnabled, isLoading: judgeLoading } = usePlatformSetting('judge_registration_enabled');
  const updateSetting = useUpdatePlatformSetting();
  return (
    <AdminLayout title="Configuración">
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">
            Ajustes generales de la plataforma
          </p>
        </div>

        {/* Registration Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Registro
            </CardTitle>
            <CardDescription>
              Controla qué tipos de registro están activos en la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Registro de jueces</Label>
                <p className="text-sm text-muted-foreground">
                  Permitir que nuevos jueces se registren en la plataforma
                </p>
              </div>
              <Switch
                checked={!!judgeRegEnabled}
                disabled={judgeLoading || updateSetting.isPending}
                onCheckedChange={(checked) => {
                  updateSetting.mutate(
                    { key: 'judge_registration_enabled', value: checked },
                    {
                      onSuccess: () => toast.success(checked ? 'Registro de jueces habilitado' : 'Registro de jueces deshabilitado'),
                      onError: () => toast.error('Error al actualizar la configuración'),
                    }
                  );
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configuración de Email
            </CardTitle>
            <CardDescription>
              Configura las plantillas y opciones de email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Emails de verificación</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar email cuando un usuario es verificado
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Emails de eventos</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar recordatorios de eventos próximos
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Confirmación de talleres</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar asignación de talleres a mentores
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones del Sistema
            </CardTitle>
            <CardDescription>
              Configura las alertas para administradores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Nuevos registros</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar cuando hay nuevos usuarios pendientes de verificación
                </p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Aforo completo</Label>
                <p className="text-sm text-muted-foreground">
                  Alertar cuando un evento alcanza el 90% de aforo
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
            </CardTitle>
            <CardDescription>
              Opciones de seguridad y privacidad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Verificación obligatoria</Label>
                <p className="text-sm text-muted-foreground">
                  Requerir verificación para acceder a eventos
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Logs de auditoría</Label>
                <p className="text-sm text-muted-foreground">
                  Registrar todas las acciones de administración
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Base de Datos
            </CardTitle>
            <CardDescription>
              Mantenimiento y exportación de datos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Exportar todos los datos</Label>
                <p className="text-sm text-muted-foreground">
                  Descarga un backup completo de la base de datos
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => toast.info("Funcionalidad en desarrollo")}
              >
                Exportar
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Limpiar datos de prueba</Label>
                <p className="text-sm text-muted-foreground">
                  Elimina usuarios y datos de prueba (irreversible)
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => toast.info("Funcionalidad deshabilitada por seguridad")}
              >
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => toast.success("Configuración guardada")}>
            Guardar Cambios
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
