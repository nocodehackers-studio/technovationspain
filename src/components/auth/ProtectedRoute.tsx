import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingPage } from '@/components/ui/loading-spinner';
import { AppRole } from '@/types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
  requireVerified?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requiredRoles,
  requireVerified = false 
}: ProtectedRouteProps) {
  const { user, role, isLoading, isVerified, needsOnboarding } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingPage message="Verificando sesión..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if onboarding is needed
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Check verification status if required
  if (requireVerified && !isVerified) {
    return <Navigate to="/pending-verification" replace />;
  }

  // Check role requirements
  if (requiredRoles && requiredRoles.length > 0) {
    if (!role || !requiredRoles.includes(role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}