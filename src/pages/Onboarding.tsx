import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, User, Calendar, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { AppRole } from '@/types/database';

const onboardingSchema = z.object({
  first_name: z.string().min(1, 'El nombre es obligatorio').max(100),
  last_name: z.string().min(1, 'Los apellidos son obligatorios').max(100),
  date_of_birth: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
  // Only participant role is allowed for public signup - other roles are assigned by admin
  role: z.literal('participant'),
  tg_email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  postal_code: z.string().max(10).optional(),
});

type OnboardingData = z.infer<typeof onboardingSchema>;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<OnboardingData>({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    role: 'participant',
    tg_email: '',
    phone: '',
    postal_code: '',
  });

  const updateField = (field: keyof OnboardingData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'El nombre es obligatorio';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Los apellidos son obligatorios';
    }
    if (!formData.date_of_birth) {
      newErrors.date_of_birth = 'La fecha de nacimiento es obligatoria';
    } else {
      const birthDate = new Date(formData.date_of_birth);
      const today = new Date();
      if (birthDate >= today) {
        newErrors.date_of_birth = 'La fecha debe ser anterior a hoy';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'No hay sesión activa. Por favor, inicia sesión de nuevo.',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    // Validate all fields
    const result = onboardingSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          date_of_birth: formData.date_of_birth,
          tg_email: formData.tg_email?.trim() || null,
          phone: formData.phone?.trim() || null,
          postal_code: formData.postal_code?.trim() || null,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      // Create user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: formData.role,
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      await refreshProfile();

      toast({
        title: '¡Bienvenida!',
        description: 'Tu perfil ha sido creado correctamente.',
      });

      // Redirect based on role
      const roleRoutes: Record<AppRole, string> = {
        admin: '/admin',
        mentor: '/dashboard',
        participant: '/dashboard',
        volunteer: '/dashboard',
        judge: '/dashboard',
      };

      navigate(roleRoutes[formData.role] || '/dashboard', { replace: true });
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo completar el registro.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is under 14 for parental consent
  const isMinor = () => {
    if (!formData.date_of_birth) return false;
    const birthDate = new Date(formData.date_of_birth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    return age < 14;
  };

  // Role is fixed to participant for public signup
  const roleLabel = 'Participante (8-18 años)';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-2xl font-display font-bold">Technovation España</span>
          </div>
          <p className="text-muted-foreground">Completa tu perfil para continuar</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader>
            <CardTitle className="font-display">
              {step === 1 ? 'Datos personales' : 'Información adicional'}
            </CardTitle>
            <CardDescription>
              {step === 1 
                ? 'Cuéntanos un poco sobre ti'
                : 'Información para conectar con Technovation Global'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">Nombre *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="first_name"
                          placeholder="Tu nombre"
                          value={formData.first_name}
                          onChange={(e) => updateField('first_name', e.target.value)}
                          className="pl-10"
                          maxLength={100}
                        />
                      </div>
                      {errors.first_name && (
                        <p className="text-sm text-destructive">{errors.first_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Apellidos *</Label>
                      <Input
                        id="last_name"
                        placeholder="Tus apellidos"
                        value={formData.last_name}
                        onChange={(e) => updateField('last_name', e.target.value)}
                        maxLength={100}
                      />
                      {errors.last_name && (
                        <p className="text-sm text-destructive">{errors.last_name}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Fecha de nacimiento *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => updateField('date_of_birth', e.target.value)}
                        className="pl-10"
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    {errors.date_of_birth && (
                      <p className="text-sm text-destructive">{errors.date_of_birth}</p>
                    )}
                    {isMinor() && (
                      <p className="text-sm text-warning">
                        Al ser menor de 14 años, necesitarás el consentimiento de tu padre/madre/tutor.
                      </p>
                    )}
                  </div>

                  {/* Role is fixed to participant for public signup */}
                  <div className="rounded-lg bg-muted p-4">
                    <Label className="text-sm font-medium">Tu rol</Label>
                    <p className="text-base font-semibold text-foreground mt-1">{roleLabel}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      El registro público es solo para participantes. Si eres mentora, jueza o 
                      voluntaria, contacta con tu coordinadora regional.
                    </p>
                  </div>

                  <Button
                    type="button"
                    className="w-full gradient-primary"
                    onClick={handleNext}
                  >
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tg_email">Email en Technovation Global</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="tg_email"
                        type="email"
                        placeholder="email@technovation.org"
                        value={formData.tg_email}
                        onChange={(e) => updateField('tg_email', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Si ya estás registrada en Technovation Global, introduce el email que usaste allí.
                    </p>
                    {errors.tg_email && (
                      <p className="text-sm text-destructive">{errors.tg_email}</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+34 600 000 000"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        maxLength={20}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Código postal</Label>
                      <Input
                        id="postal_code"
                        placeholder="28001"
                        value={formData.postal_code}
                        onChange={(e) => updateField('postal_code', e.target.value)}
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Atrás
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 gradient-primary"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Guardando...
                        </span>
                      ) : (
                        'Completar registro'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}