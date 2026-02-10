import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Users, Scale, Sparkles } from 'lucide-react';
import { usePlatformSetting } from '@/hooks/usePlatformSettings';

const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";

const roles = [
  {
    id: 'student',
    title: 'Estudiante',
    description: 'Participante de 7 a 18 años en Technovation Girls',
    icon: GraduationCap,
    ageRange: '7-18 años',
    href: '/register/student',
    color: 'bg-primary/10 text-primary',
  },
  {
    id: 'mentor',
    title: 'Mentor',
    description: 'Adulto que guía y apoya a un equipo de estudiantes',
    icon: Users,
    ageRange: '18+ años',
    href: '/register/mentor',
    color: 'bg-secondary/10 text-secondary',
  },
  {
    id: 'judge',
    title: 'Juez',
    description: 'Profesional que evalúa los proyectos en eventos',
    icon: Scale,
    ageRange: '18+ años',
    href: '/register/judge',
    color: 'bg-accent/10 text-accent',
  },
];

export default function RegisterSelect() {
  const location = useLocation();
  const prefilledEmail = (location.state as { email?: string })?.email;
  const { data: judgeRegEnabled } = usePlatformSetting('judge_registration_enabled');

  const visibleRoles = roles.filter(r => r.id !== 'judge' || judgeRegEnabled);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header with logos */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-6">
            <img 
              src={LOGO_TECHNOVATION} 
              alt="Technovation Girls" 
              className="h-14 w-auto mix-blend-multiply"
            />
            <div className="h-10 w-px bg-border" />
            <img 
              src={LOGO_POWER_TO_CODE} 
              alt="Power to Code" 
              className="h-12 w-auto mix-blend-multiply"
            />
          </div>
          <div className="inline-flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xl font-display font-bold">Crear cuenta</span>
          </div>
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">¿Quién eres?</CardTitle>
            <CardDescription className="text-base">
              Selecciona tu rol para comenzar el registro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid gap-4 ${visibleRoles.length === 2 ? 'sm:grid-cols-2 max-w-lg mx-auto' : 'sm:grid-cols-3'}`}>
              {visibleRoles.map((role) => {
                const Icon = role.icon;
                return (
                  <Link key={role.id} to={role.href} state={{ email: prefilledEmail }} className="block">
                    <div className="group relative rounded-xl border-2 border-muted p-6 text-center transition-all hover:border-primary hover:shadow-lg h-full flex flex-col">
                      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${role.color} transition-transform group-hover:scale-110`}>
                        <Icon className="h-8 w-8" />
                      </div>
                      <h3 className="text-lg font-semibold">{role.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground flex-1">
                        {role.description}
                      </p>
                      <div className="mt-3 inline-flex items-center justify-center rounded-full bg-muted px-3 py-1 text-xs font-medium">
                        {role.ageRange}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="pt-4 text-center">
              <p className="text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <Link to="/" className="font-medium text-primary hover:underline">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
