import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2, Info } from "lucide-react";

export default function Index() {
  const { user, isLoading, role, needsOnboarding, isVerified } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingPage />;
  }

  // If logged in, redirect based on role and onboarding status
  if (user) {
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    // Check if user needs onboarding first
    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    // Check verification status
    if (!isVerified) {
      return <Navigate to="/pending-verification" replace />;
    }
    // Verified user - go to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Por favor, introduce tu email");
      return;
    }

    setLoading(true);
    
    // Always use production URL except for localhost development
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost ? window.location.origin : 'https://technovationspain.lovable.app';
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${baseUrl}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      setEmailSent(true);
      toast.success("¡Enlace enviado! Revisa tu correo electrónico");
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Mail className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl">Revisa tu correo</CardTitle>
            <CardDescription>
              Hemos enviado un enlace a <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>
              Haz clic en el enlace del correo para completar tu registro. 
              El enlace expira en 1 hora.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setEmailSent(false)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver e intentar con otro email
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            T
          </div>
          <CardTitle className="text-xl">Technovation España</CardTitle>
          <CardDescription>
            Regístrate o inicia sesión para continuar
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="space-y-4">
            <Alert className="border-muted">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Importante:</strong> Usa el mismo email con el que te registraste 
                en Technovation Global para verificar tu cuenta automáticamente.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Usa tu email de Technovation Global
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Continuar con email"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Al continuar, aceptas los términos de uso y la política de privacidad.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}