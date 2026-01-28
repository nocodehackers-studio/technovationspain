import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, User, Calendar, Mail, ArrowRight, ArrowLeft, GraduationCap, Users, Scale, Building2, Heart } from 'lucide-react';
import { z } from 'zod';
import { AppRole } from '@/types/database';

type AllowedRole = 'participant' | 'mentor' | 'judge' | 'volunteer';

const roleConfig: Record<AllowedRole, { 
  label: string; 
  icon: typeof GraduationCap; 
  ageMin: number; 
  ageMax: number | null;
  ageLabel: string;
  color: string;
  requiresTGEmail: boolean;
}> = {
  participant: { 
    label: 'Estudiante', 
    icon: GraduationCap, 
    ageMin: 7, 
    ageMax: 18,
    ageLabel: '7-18 años',
    color: 'text-primary',
    requiresTGEmail: true,
  },
  mentor: { 
    label: 'Mentora', 
    icon: Users, 
    ageMin: 18, 
    ageMax: null,
    ageLabel: '18+ años',
    color: 'text-secondary',
    requiresTGEmail: true,
  },
  judge: { 
    label: 'Juez', 
    icon: Scale, 
    ageMin: 18, 
    ageMax: null,
    ageLabel: '18+ años',
    color: 'text-accent',
    requiresTGEmail: true,
  },
  volunteer: { 
    label: 'Voluntario/a', 
    icon: Heart, 
    ageMin: 18, 
    ageMax: null,
    ageLabel: '18+ años',
    color: 'text-accent',
    requiresTGEmail: false,
  },
};

const createOnboardingSchema = (role: AllowedRole) => z.object({
  first_name: z.string().min(1, 'El nombre es obligatorio').max(100),
  last_name: z.string().min(1, 'Los apellidos son obligatorios').max(100),
  date_of_birth: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
  role: z.enum(['participant', 'mentor', 'judge', 'volunteer']),
  tg_email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  postal_code: z.string().max(10).optional(),
});

type OnboardingData = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  role: AllowedRole;
  tg_email: string;
  hub_id: string;
  phone: string;
  postal_code: string;
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  // Get role from URL params or default to participant
  const urlRole = searchParams.get('role') as AllowedRole | null;
  const initialRole: AllowedRole = urlRole && ['participant', 'mentor', 'judge', 'volunteer'].includes(urlRole) 
    ? urlRole 
    : 'participant';
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<OnboardingData>({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    role: initialRole,
    tg_email: user?.email || '',
    hub_id: '',
    phone: '',
    postal_code: '',
  });

  // Fetch available hubs
  const { data: hubs } = useQuery({
    queryKey: ["available-hubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hubs")
        .select("id, name, location")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Update role if URL changes
  useEffect(() => {
    if (urlRole && ['participant', 'mentor', 'judge', 'volunteer'].includes(urlRole)) {
      setFormData(prev => ({ ...prev, role: urlRole }));
    }
  }, [urlRole]);

  const currentRoleConfig = roleConfig[formData.role];
  const RoleIcon = currentRoleConfig.icon;

  const updateField = (field: keyof OnboardingData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const calculateAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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
      } else {
        // Validate age for role
        const age = calculateAge(formData.date_of_birth);
        const { ageMin, ageMax, ageLabel } = currentRoleConfig;
        
        if (age < ageMin) {
          newErrors.date_of_birth = `Debes tener al menos ${ageMin} años para registrarte como ${currentRoleConfig.label.toLowerCase()}`;
        }
        if (ageMax !== null && age > ageMax) {
          newErrors.date_of_birth = `Para registrarte como ${currentRoleConfig.label.toLowerCase()} debes tener entre ${ageMin} y ${ageMax} años`;
        }
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
    const schema = createOnboardingSchema(formData.role);
    const result = schema.safeParse(formData);
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

    // Final age validation
    const age = calculateAge(formData.date_of_birth);
    const { ageMin, ageMax } = currentRoleConfig;
    if (age < ageMin || (ageMax !== null && age > ageMax)) {
      toast({
        title: 'Error de edad',
        description: `Tu edad no corresponde con el rol de ${currentRoleConfig.label.toLowerCase()} (${currentRoleConfig.ageLabel})`,
        variant: 'destructive',
      });
      setStep(1);
      return;
    }

    setIsLoading(true);

    try {
      // Volunteers are auto-verified (no Technovation Global check needed)
      const isVolunteer = formData.role === 'volunteer';
      
      // Check if tg_email is in authorized_students (whitelist) - only for participants
      let isInWhitelist = false;
      let authorizedData: any = null;
      
      if (formData.role === 'participant' && formData.tg_email?.trim()) {
        const { data: authorized } = await supabase
          .from('authorized_students')
          .select('*')
          .ilike('email', formData.tg_email.trim())
          .maybeSingle();
        
        if (authorized && (!authorized.matched_profile_id || authorized.matched_profile_id === user.id)) {
          isInWhitelist = true;
          authorizedData = authorized;
        }
      }

      // Update profile with verification status based on whitelist or volunteer role
      const profileUpdate: any = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth,
        tg_email: formData.tg_email?.trim() || null,
        hub_id: formData.hub_id || null,
        phone: formData.phone?.trim() || null,
        postal_code: formData.postal_code?.trim() || null,
        onboarding_completed: true,
      };

      // Volunteers are auto-verified
      if (isVolunteer) {
        profileUpdate.verification_status = 'verified';
      }

      // If in whitelist (participant), auto-verify and copy TG data
      if (isInWhitelist && authorizedData) {
        profileUpdate.verification_status = 'verified';
        profileUpdate.tg_id = authorizedData.tg_id;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      // Assign role
      const roleToAssign = formData.role as AppRole;
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: roleToAssign });
      
      // Ignore duplicate errors
      if (roleError && !roleError.message.includes('duplicate')) {
        console.warn('Role assignment warning:', roleError.message);
      }

      // If in whitelist (participant), update authorized_students
      if (isInWhitelist && authorizedData) {
        if (!authorizedData.matched_profile_id) {
          await supabase
            .from('authorized_students')
            .update({ matched_profile_id: user.id })
            .eq('id', authorizedData.id);
        }
      }

      // Verify actual profile status from database after update
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('verification_status')
        .eq('id', user.id)
        .single();

      const wasVerified = updatedProfile?.verification_status === 'verified';

      // Wait for profile refresh to complete before navigation
      await refreshProfile();
      
      // Small delay to ensure React processes the new auth state
      await new Promise(resolve => setTimeout(resolve, 150));

      if (wasVerified || isInWhitelist || isVolunteer) {
        toast({
          title: '¡Bienvenida!',
          description: 'Tu cuenta ha sido verificada correctamente.',
        });
        // Volunteers go to their specific dashboard
        const redirectPath = isVolunteer ? '/voluntario/dashboard' : '/dashboard';
        navigate(redirectPath, { replace: true });
      } else {
        toast({
          title: 'Registro completado',
          description: 'Tu perfil está pendiente de verificación.',
        });
        navigate('/pending-verification', { replace: true });
      }
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
    const age = calculateAge(formData.date_of_birth);
    return age < 14;
  };

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
                    {formData.role === 'participant' && isMinor() && (
                      <p className="text-sm text-warning">
                        ⚠️ Al ser menor de 14 años, necesitarás el consentimiento de tu padre/madre/tutor.
                      </p>
                    )}
                  </div>

                  {/* Role display - shows selected role from registration */}
                  <div className="rounded-lg bg-muted p-4">
                    <Label className="text-sm font-medium">Tu rol</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <RoleIcon className={`h-5 w-5 ${currentRoleConfig.color}`} />
                      <span className="text-base font-semibold text-foreground">
                        {currentRoleConfig.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({currentRoleConfig.ageLabel})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formData.role === 'participant' && 
                        'Si ya estás registrada en Technovation Global, podrás verificar tu cuenta automáticamente.'
                      }
                      {formData.role === 'mentor' && 
                        'Las mentoras guían y apoyan a los equipos de estudiantes durante la temporada.'
                      }
                      {formData.role === 'judge' && 
                        'Los jueces evalúan los proyectos de las estudiantes en eventos regionales y nacionales.'
                      }
                      {formData.role === 'volunteer' && 
                        'Los voluntarios apoyan en la logística y organización de eventos.'
                      }
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
                  {/* TG Email - Only show for roles that require it */}
                  {currentRoleConfig.requiresTGEmail && (
                    <div className="space-y-2">
                      <Label htmlFor="tg_email">
                        {formData.role === 'participant' 
                          ? 'Email en Technovation Global'
                          : 'Email de contacto'
                        }
                      </Label>
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
                        {formData.role === 'participant'
                          ? 'Si ya estás registrada en Technovation Global, introduce el email que usaste allí.'
                          : 'Email donde podemos contactarte para coordinación de eventos.'}
                      </p>
                      {errors.tg_email && (
                        <p className="text-sm text-destructive">{errors.tg_email}</p>
                      )}
                    </div>
                  )}

                  {/* Volunteer info message */}
                  {formData.role === 'volunteer' && (
                    <div className="rounded-lg bg-accent/10 border border-accent/20 p-4">
                      <p className="text-sm text-muted-foreground">
                        <Heart className="inline h-4 w-4 mr-1 text-accent" />
                        ¡Gracias por querer ser voluntario/a! Tu cuenta será verificada automáticamente 
                        y podrás apuntarte a eventos desde tu dashboard.
                      </p>
                    </div>
                  )}

                  {/* Hub selector - optional */}
                  {hubs && hubs.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="hub_id">Hub Regional (opcional)</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                        <Select
                          value={formData.hub_id}
                          onValueChange={(value) => updateField('hub_id', value === 'none' ? '' : value)}
                        >
                          <SelectTrigger className="pl-10">
                            <SelectValue placeholder="Selecciona tu hub..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin hub asignado</SelectItem>
                            {hubs.map((hub) => (
                              <SelectItem key={hub.id} value={hub.id}>
                                {hub.name}{hub.location ? ` (${hub.location})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Si no conoces tu hub, puedes dejarlo en blanco. Tu mentor o el admin puede asignártelo después.
                      </p>
                    </div>
                  )}

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
