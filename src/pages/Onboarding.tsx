import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, Calendar, Mail, Building2, LogOut, X } from 'lucide-react';
import { validateSpanishDNI } from '@/lib/validation-utils';
import { isMinor } from '@/lib/age-utils';
import { getMissingFields, getMissingJudgeFields, hasMissingFields, REQUIRED_PROFILE_FIELDS } from '@/lib/profile-fields';
import { getDashboardPath } from '@/lib/dashboard-routes';

type OnboardingField = string;

function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 2000);
}

interface FormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  dni: string;
  hub_id: string;
  postal_code: string;
  phone: string;
  city: string;
  state: string;
  parent_name: string;
  parent_email: string;
}

interface JudgeFormData {
  judge_how_discovered_program: string;
  judge_previous_participation: string;
  schedule_preference: '' | 'morning' | 'afternoon' | 'no_preference';
  conflict_team_ids: string[];
  conflict_other_text: string;
  comments: string;
  has_conflict: boolean;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, role, refreshProfile, signOut, isJudge, needsJudgeOnboarding, activeJudgeEventId } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showGoToEvent, setShowGoToEvent] = useState(false);
  const [judgeFormData, setJudgeFormData] = useState<JudgeFormData>({
    judge_how_discovered_program: (profile as any)?.judge_how_discovered_program || '',
    judge_previous_participation: (profile as any)?.judge_previous_participation || '',
    schedule_preference: '',
    conflict_team_ids: [],
    conflict_other_text: '',
    comments: '',
    has_conflict: false,
  });
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  // Determine which fields are missing (dynamic)
  const missingFieldSet = useMemo(() => {
    if (!profile) return new Set<string>();
    return new Set(getMissingFields(profile as unknown as Record<string, unknown>));
  }, [profile]);

  // Whether this is a first-time onboarding (need consent)
  const needsConsent = !profile?.terms_accepted_at;

  // If no required fields missing, consent done, and no judge onboarding, skip
  if (profile && !needsConsent && !hasMissingFields(profile as unknown as Record<string, unknown>) && !needsJudgeOnboarding) {
    navigate(getDashboardPath(role), { replace: true });
    return null;
  }

  // Initialize form with profile data
  const [formData, setFormData] = useState<FormData>({
    first_name: (profile as any)?.first_name || '',
    last_name: (profile as any)?.last_name || '',
    date_of_birth: (profile as any)?.date_of_birth || '',
    dni: (profile as any)?.dni || '',
    hub_id: (profile as any)?.hub_id || 'none',
    postal_code: (profile as any)?.postal_code || '',
    phone: (profile as any)?.phone || '',
    city: (profile as any)?.city || '',
    state: (profile as any)?.state || '',
    parent_name: (profile as any)?.parent_name || '',
    parent_email: (profile as any)?.parent_email || '',
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

  // Compute missing judge profile fields
  const missingJudgeFields = useMemo(() => {
    if (!profile || !needsJudgeOnboarding) return [];
    return getMissingJudgeFields(profile as unknown as Record<string, unknown>);
  }, [profile, needsJudgeOnboarding]);

  // Fetch judge assignment data (only if needsJudgeOnboarding)
  const { data: judgeAssignment } = useQuery({
    queryKey: ['judge-assignment', user?.id, activeJudgeEventId],
    queryFn: async () => {
      const { data } = await supabase
        .from('judge_assignments')
        .select('*, events(*)')
        .eq('user_id', user!.id)
        .eq('event_id', activeJudgeEventId!)
        .eq('is_active', true)
        .single();
      return data;
    },
    enabled: !!user && !!activeJudgeEventId && needsJudgeOnboarding,
  });

  // Fetch event teams for conflict of interest dropdown
  const { data: eventTeams } = useQuery({
    queryKey: ['event-teams-for-judges', activeJudgeEventId],
    queryFn: async () => {
      const { data } = await supabase
        .from('event_registrations')
        .select('team_id, teams!inner(id, name)')
        .eq('event_id', activeJudgeEventId!)
        .not('team_id', 'is', null);
      const seen = new Set<string>();
      return (data ?? [])
        .filter(r => {
          const teamId = (r as any).teams?.id;
          if (!teamId || seen.has(teamId)) return false;
          seen.add(teamId);
          return true;
        })
        .map(r => ({ id: (r as any).teams.id as string, name: (r as any).teams.name as string }));
    },
    enabled: !!activeJudgeEventId && needsJudgeOnboarding,
  });

  // Determine if user is a minor based on DOB (form value or existing profile)
  // Only evaluate when a DOB actually exists — no DOB means hide parent fields
  const effectiveDob = formData.date_of_birth || (profile as any)?.date_of_birth;
  const userIsMinor = effectiveDob ? isMinor(effectiveDob) : false;

  // Show parent fields only for minors with missing parent data
  const showParentName = userIsMinor && !(profile as any)?.parent_name;
  const showParentEmail = userIsMinor && !(profile as any)?.parent_email;

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // Field labels for display
  const fieldLabels: Record<string, string> = {
    first_name: 'Nombre',
    last_name: 'Apellidos',
    date_of_birth: 'Fecha de nacimiento',
    dni: 'DNI/NIE',
    hub_id: 'Hub Regional',
    postal_code: 'Código postal',
    phone: 'Teléfono',
    city: 'Ciudad',
    state: 'Comunidad Autónoma',
    parent_name: 'Nombre padre/madre/tutor',
    parent_email: 'Email padre/madre/tutor',
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Only validate missing fields
    if (missingFieldSet.has('first_name') && !formData.first_name.trim()) {
      newErrors.first_name = 'El nombre es obligatorio';
    }
    if (missingFieldSet.has('last_name') && !formData.last_name.trim()) {
      newErrors.last_name = 'Los apellidos son obligatorios';
    }
    if (missingFieldSet.has('date_of_birth') && !formData.date_of_birth) {
      newErrors.date_of_birth = 'La fecha de nacimiento es obligatoria';
    }
    if (missingFieldSet.has('dni')) {
      if (!formData.dni.trim()) {
        newErrors.dni = 'El DNI/NIE es obligatorio';
      } else if (!validateSpanishDNI(formData.dni, true)) {
        newErrors.dni = 'Formato inválido. Usa 8 números + letra (DNI) o X/Y/Z + 7 números + letra (NIE)';
      }
    }
    if (missingFieldSet.has('postal_code') && !formData.postal_code.trim()) {
      newErrors.postal_code = 'El código postal es obligatorio';
    }
    // hub_id is optional — user can select "Sin hub asignado"

    // Parent fields validation (minors only)
    if (showParentName && !formData.parent_name.trim()) {
      newErrors.parent_name = 'El nombre del padre/madre/tutor es obligatorio';
    }
    if (showParentEmail && !formData.parent_email.trim()) {
      newErrors.parent_email = 'El email del padre/madre/tutor es obligatorio';
    }

    // Consent validation (first-time only)
    if (needsConsent && (!termsAccepted || !privacyAccepted)) {
      newErrors.consent = 'Debes aceptar los términos y la política de privacidad';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real-time check: enable button only when all required fields are filled
  const isFormComplete = useMemo(() => {
    // Check required profile fields that are missing
    for (const field of REQUIRED_PROFILE_FIELDS) {
      if (missingFieldSet.has(field)) {
        if (!(formData as any)[field]?.trim()) return false;
      }
    }
    // Parent fields required for minors
    if (showParentName && !formData.parent_name.trim()) return false;
    if (showParentEmail && !formData.parent_email.trim()) return false;
    // Consent required for first-time
    if (needsConsent && (!termsAccepted || !privacyAccepted)) return false;
    // Judge fields
    if (needsJudgeOnboarding) {
      if (!judgeFormData.schedule_preference) return false;
      if (judgeFormData.has_conflict && judgeFormData.conflict_team_ids.length === 0 && !judgeFormData.conflict_other_text.trim()) return false;
    }
    return true;
  }, [missingFieldSet, formData, showParentName, showParentEmail, needsConsent, termsAccepted, privacyAccepted, needsJudgeOnboarding, judgeFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({ title: 'Error', description: 'No hay sesión activa.', variant: 'destructive' });
      navigate('/');
      return;
    }

    if (!validate()) return;

    setIsLoading(true);

    try {
      // Build profile update with only missing fields
      const profileUpdate: Record<string, unknown> = {
        onboarding_completed: true,
      };

      // Add consent timestamps if first time
      if (needsConsent) {
        profileUpdate.terms_accepted_at = new Date().toISOString();
        profileUpdate.privacy_accepted_at = new Date().toISOString();
      }

      // Add each missing field value
      missingFieldSet.forEach(field => {
        const value = (formData as any)[field];
        if (field === 'dni') {
          profileUpdate[field] = value?.toUpperCase().trim() || null;
        } else {
          profileUpdate[field] = value?.trim() || null;
        }
      });

      // Hub is optional — save selection if shown during first-time onboarding
      if (needsConsent) {
        const hubValue = formData.hub_id;
        profileUpdate.hub_id = hubValue === 'none' || !hubValue ? null : hubValue;
      }

      // Add parent fields for minors
      if (showParentName) {
        profileUpdate.parent_name = formData.parent_name.trim() || null;
      }
      if (showParentEmail) {
        profileUpdate.parent_email = formData.parent_email.trim() || null;
      }

      // Add judge profile fields if needed
      if (needsJudgeOnboarding) {
        if (missingJudgeFields.includes('judge_how_discovered_program')) {
          profileUpdate.judge_how_discovered_program = sanitizeText(judgeFormData.judge_how_discovered_program) || null;
        }
        if (missingJudgeFields.includes('judge_previous_participation')) {
          profileUpdate.judge_previous_participation = sanitizeText(judgeFormData.judge_previous_participation) || null;
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Save event-specific judge answers
      if (needsJudgeOnboarding && activeJudgeEventId) {
        const { error: judgeError } = await supabase
          .from('judge_assignments')
          .update({
            schedule_preference: judgeFormData.schedule_preference || null,
            conflict_team_ids: judgeFormData.conflict_team_ids.length > 0
              ? judgeFormData.conflict_team_ids
              : null,
            conflict_other_text: sanitizeText(judgeFormData.conflict_other_text) || null,
            comments: sanitizeText(judgeFormData.comments),
            onboarding_completed: true,
          })
          .eq('user_id', user.id)
          .eq('event_id', activeJudgeEventId)
          .eq('is_active', true);
        if (judgeError) throw judgeError;
      }

      // If user has no role yet (manual registrant), assign 'participant' as default
      const { data: existingRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!existingRoles || existingRoles.length === 0) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'participant' });
        if (roleError && !roleError.message.includes('duplicate')) {
          console.warn('Role assignment warning:', roleError.message);
        }
      }

      // Refresh profile in auth context
      await refreshProfile();
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check verification status for routing
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('verification_status')
        .eq('id', user.id)
        .single();

      const wasVerified = updatedProfile?.verification_status === 'verified';

      if (wasVerified) {
        // Send welcome email only on first-time onboarding (consent just given)
        if (needsConsent) {
          supabase.functions.invoke("send-welcome-email", {
            body: { email: user.email, firstName: formData.first_name || (profile as any)?.first_name },
          }).catch((err) => console.error("Welcome email error:", err));
        }

        // If judge onboarding was included, show "Go to event" button
        if (needsJudgeOnboarding && activeJudgeEventId) {
          toast({ title: '¡Registro completado!', description: 'Tu registro como juez está listo.' });
          setShowGoToEvent(true);
          return;
        }

        toast({ title: '¡Bienvenida!', description: 'Tu cuenta está lista.' });
        navigate(getDashboardPath(role), { replace: true });
      } else {
        toast({ title: 'Registro completado', description: 'Tu perfil está pendiente de verificación.' });
        navigate('/pending-verification', { replace: true });
      }
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo completar el registro.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there are any fields to show
  const hasFieldsToShow = missingFieldSet.size > 0 || needsConsent || showParentName || showParentEmail || needsJudgeOnboarding;

  // Render a field only if it's in the missing set
  const shouldShowField = (field: string) => missingFieldSet.has(field);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
      <div className="w-full max-w-lg space-y-6">
        <Card className="border-none shadow-2xl">
          <CardHeader>
            <CardTitle className="font-display">
              {needsConsent ? 'Completa tu perfil' : 'Actualiza tu perfil'}
            </CardTitle>
            <CardDescription>
              {needsConsent
                ? 'Rellena los campos para poder acceder a la plataforma'
                : 'Necesitamos algunos datos adicionales'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name fields */}
              {(shouldShowField('first_name') || shouldShowField('last_name')) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {shouldShowField('first_name') && (
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
                      {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
                    </div>
                  )}
                  {shouldShowField('last_name') && (
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Apellidos *</Label>
                      <Input
                        id="last_name"
                        placeholder="Tus apellidos"
                        value={formData.last_name}
                        onChange={(e) => updateField('last_name', e.target.value)}
                        maxLength={100}
                      />
                      {errors.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Date of birth */}
              {shouldShowField('date_of_birth') && (
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
                  {errors.date_of_birth && <p className="text-sm text-destructive">{errors.date_of_birth}</p>}
                </div>
              )}

              {/* DNI */}
              {shouldShowField('dni') && (
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI/NIE *</Label>
                  <Input
                    id="dni"
                    placeholder="12345678A"
                    value={formData.dni}
                    onChange={(e) => updateField('dni', e.target.value.toUpperCase())}
                    maxLength={9}
                    className="uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    8 números + letra (DNI) o X/Y/Z + 7 números + letra (NIE)
                  </p>
                  {errors.dni && <p className="text-sm text-destructive">{errors.dni}</p>}
                </div>
              )}

              {/* Hub selector — optional, shown during first-time onboarding */}
              {needsConsent && hubs && hubs.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="hub_id">Hub Regional (opcional)</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <Select
                      value={formData.hub_id}
                      onValueChange={(value) => updateField('hub_id', value)}
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
                  {errors.hub_id && <p className="text-sm text-destructive">{errors.hub_id}</p>}
                </div>
              )}

              {/* Postal code and phone */}
              {(shouldShowField('postal_code') || shouldShowField('phone')) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {shouldShowField('postal_code') && (
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Código postal *</Label>
                      <Input
                        id="postal_code"
                        placeholder="28001"
                        value={formData.postal_code}
                        onChange={(e) => updateField('postal_code', e.target.value)}
                        maxLength={10}
                      />
                      {errors.postal_code && <p className="text-sm text-destructive">{errors.postal_code}</p>}
                    </div>
                  )}
                  {shouldShowField('phone') && (
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
                  )}
                </div>
              )}

              {/* Parent name & email — only for minors (age ≤13) */}
              {(showParentName || showParentEmail) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {showParentName && (
                    <div className="space-y-2">
                      <Label htmlFor="parent_name">Nombre padre/madre/tutor *</Label>
                      <Input
                        id="parent_name"
                        placeholder="Nombre completo"
                        value={formData.parent_name}
                        onChange={(e) => updateField('parent_name', e.target.value)}
                        maxLength={200}
                      />
                      {errors.parent_name && <p className="text-sm text-destructive">{errors.parent_name}</p>}
                    </div>
                  )}
                  {showParentEmail && (
                    <div className="space-y-2">
                      <Label htmlFor="parent_email">Email padre/madre/tutor *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="parent_email"
                          type="email"
                          placeholder="email@ejemplo.com"
                          value={formData.parent_email}
                          onChange={(e) => updateField('parent_email', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {errors.parent_email && <p className="text-sm text-destructive">{errors.parent_email}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Optional CSV fields */}
              {(shouldShowField('city') || shouldShowField('state')) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {shouldShowField('city') && (
                    <div className="space-y-2">
                      <Label htmlFor="city">Ciudad</Label>
                      <Input
                        id="city"
                        placeholder="Madrid"
                        value={formData.city}
                        onChange={(e) => updateField('city', e.target.value)}
                      />
                    </div>
                  )}
                  {shouldShowField('state') && (
                    <div className="space-y-2">
                      <Label htmlFor="state">Comunidad Autónoma</Label>
                      <Input
                        id="state"
                        placeholder="Comunidad de Madrid"
                        value={formData.state}
                        onChange={(e) => updateField('state', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Judge Profile Fields ── */}
              {needsJudgeOnboarding && missingJudgeFields.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <p className="text-sm font-medium">Información de Juez</p>
                  {missingJudgeFields.includes('judge_how_discovered_program') && (
                    <div className="space-y-2">
                      <Label htmlFor="judge_how_discovered_program">¿Cómo conociste el programa?</Label>
                      <Input
                        id="judge_how_discovered_program"
                        placeholder="Ej: A través de una amiga, LinkedIn..."
                        value={judgeFormData.judge_how_discovered_program}
                        onChange={(e) => setJudgeFormData(prev => ({ ...prev, judge_how_discovered_program: e.target.value }))}
                        maxLength={500}
                      />
                    </div>
                  )}
                  {missingJudgeFields.includes('judge_previous_participation') && (
                    <div className="space-y-2">
                      <Label htmlFor="judge_previous_participation">¿Has participado en Technovation Girls algún otro año? Si es así, ¿cuándo y en qué rol?</Label>
                      <Input
                        id="judge_previous_participation"
                        placeholder="Ej: Sí, en 2024 como mentora"
                        value={judgeFormData.judge_previous_participation}
                        onChange={(e) => setJudgeFormData(prev => ({ ...prev, judge_previous_participation: e.target.value }))}
                        maxLength={500}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Judge Event-Specific Fields ── */}
              {needsJudgeOnboarding && judgeAssignment && (
                <div className="space-y-4 border-t pt-4">
                  <p className="text-sm font-medium">Información del Evento — {(judgeAssignment as any).events?.name}</p>

                  {/* Schedule preference */}
                  <div className="space-y-2">
                    <Label htmlFor="schedule_preference">
                      Indícanos el horario para participar como juez presencial en {(judgeAssignment as any).events?.name} el {new Date((judgeAssignment as any).events?.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} en {(judgeAssignment as any).events?.location_name}{(judgeAssignment as any).events?.location_city ? `, ${(judgeAssignment as any).events.location_city}` : ''} *
                    </Label>
                    <Select
                      value={judgeFormData.schedule_preference}
                      onValueChange={(value) => setJudgeFormData(prev => ({ ...prev, schedule_preference: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tu preferencia horaria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Mañana</SelectItem>
                        <SelectItem value="afternoon">Tarde</SelectItem>
                        <SelectItem value="no_preference">Sin preferencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conflict of interest */}
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="has_conflict"
                        checked={judgeFormData.has_conflict}
                        onCheckedChange={(checked) => setJudgeFormData(prev => ({
                          ...prev,
                          has_conflict: !!checked,
                          conflict_team_ids: !checked ? [] : prev.conflict_team_ids,
                          conflict_other_text: !checked ? '' : prev.conflict_other_text,
                        }))}
                      />
                      <Label htmlFor="has_conflict" className="text-sm font-normal leading-snug">
                        ¿Eres padre, madre o mentor de alguna chica participante en Technovation?
                      </Label>
                    </div>

                    {judgeFormData.has_conflict && (
                      <div className="space-y-3 pl-6">
                        {/* Selected teams as badges */}
                        {judgeFormData.conflict_team_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {judgeFormData.conflict_team_ids.map(teamId => {
                              const team = eventTeams?.find(t => t.id === teamId);
                              return (
                                <Badge key={teamId} variant="secondary" className="gap-1">
                                  {team?.name || teamId}
                                  <button
                                    type="button"
                                    onClick={() => setJudgeFormData(prev => ({
                                      ...prev,
                                      conflict_team_ids: prev.conflict_team_ids.filter(id => id !== teamId),
                                    }))}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        {/* Team selector */}
                        <div className="space-y-2">
                          <Label className="text-sm">Selecciona el equipo o equipos</Label>
                          <Input
                            placeholder="Buscar equipo..."
                            value={teamSearchQuery}
                            onChange={(e) => setTeamSearchQuery(e.target.value)}
                          />
                          {eventTeams && eventTeams.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border rounded-md">
                              {eventTeams
                                .filter(t => !judgeFormData.conflict_team_ids.includes(t.id))
                                .filter(t => !teamSearchQuery || t.name.toLowerCase().includes(teamSearchQuery.toLowerCase()))
                                .map(team => (
                                  <button
                                    key={team.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                                    onClick={() => {
                                      setJudgeFormData(prev => ({
                                        ...prev,
                                        conflict_team_ids: [...prev.conflict_team_ids, team.id],
                                      }));
                                      setTeamSearchQuery('');
                                    }}
                                  >
                                    {team.name}
                                  </button>
                                ))}
                              {/* "Other" option */}
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground italic"
                                onClick={() => setJudgeFormData(prev => ({ ...prev, conflict_other_text: prev.conflict_other_text || ' ' }))}
                              >
                                Otro equipo no listado
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Other team text */}
                        {judgeFormData.conflict_other_text && (
                          <div className="space-y-2">
                            <Label htmlFor="conflict_other">Nombre del equipo no listado</Label>
                            <Input
                              id="conflict_other"
                              placeholder="Nombre del equipo"
                              value={judgeFormData.conflict_other_text.trim() ? judgeFormData.conflict_other_text : ''}
                              onChange={(e) => setJudgeFormData(prev => ({ ...prev, conflict_other_text: e.target.value }))}
                              maxLength={200}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Comments */}
                  <div className="space-y-2">
                    <Label htmlFor="judge_comments">Comentarios adicionales</Label>
                    <Textarea
                      id="judge_comments"
                      placeholder="Si tienes algún comentario o consulta, escríbelo aquí"
                      value={judgeFormData.comments}
                      onChange={(e) => setJudgeFormData(prev => ({ ...prev, comments: e.target.value }))}
                      maxLength={2000}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground text-right">{judgeFormData.comments.length}/2000</p>
                  </div>
                </div>
              )}

              {/* Legal consent (first-time only) */}
              {needsConsent && (
                <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm font-medium">Consentimiento legal</p>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => {
                        setTermsAccepted(!!checked);
                        setErrors(prev => ({ ...prev, consent: '' }));
                      }}
                    />
                    <Label htmlFor="terms" className="text-sm font-normal leading-snug">
                      Acepto los{' '}
                      <a href="https://powertocode.org/terms/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        términos de uso
                      </a>
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="privacy"
                      checked={privacyAccepted}
                      onCheckedChange={(checked) => {
                        setPrivacyAccepted(!!checked);
                        setErrors(prev => ({ ...prev, consent: '' }));
                      }}
                    />
                    <Label htmlFor="privacy" className="text-sm font-normal leading-snug">
                      Acepto la{' '}
                      <a href="https://powertocode.org/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        política de privacidad
                      </a>
                    </Label>
                  </div>
                  {errors.consent && <p className="text-sm text-destructive">{errors.consent}</p>}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isFormComplete || showGoToEvent}
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

              {showGoToEvent && activeJudgeEventId && (
                <div className="text-center space-y-3 pt-4">
                  <p className="text-sm text-muted-foreground">¡Tu registro como juez está completo!</p>
                  <Button onClick={() => navigate(`/events/${activeJudgeEventId}`)}>
                    Ir al evento →
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
