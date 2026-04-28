import { useRef } from 'react';
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
  const { user, role, isLoading, isVerified, needsOnboarding, judgeHasNoEvent, isExcludedJudge } = useAuth();
  const location = useLocation();

  // Once auth has initialized, never show loading spinner again
  // to avoid unmounting children (e.g. forms) on transient loading states.
  const hasInitialized = useRef(false);
  if (!isLoading) {
    hasInitialized.current = true;
  }

  if (isLoading && !hasInitialized.current) {
    return <LoadingPage message="Verificando sesión..." />;
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check verification status if required (BEFORE onboarding — unverified users must not reach onboarding)
  if (requireVerified && !isVerified) {
    return <Navigate to="/pending-verification" replace />;
  }

  // Check if onboarding is needed
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Block judges with no accessible event (judge_access_enabled) after onboarding (skip for admins)
  if (judgeHasNoEvent && role !== 'admin' && location.pathname !== '/judge-pending-event') {
    return <Navigate to="/judge-pending-event" replace />;
  }

  // Block excluded judges who have no fallback dashboard (collaborators) — keep them on the waiting page
  if (isExcludedJudge && role !== 'admin' && role !== 'chapter_ambassador' && role !== 'mentor' && location.pathname !== '/judge-pending-event') {
    return <Navigate to="/judge-pending-event" replace />;
  }

  // Check role requirements
  if (requiredRoles && requiredRoles.length > 0) {
    if (!role || !requiredRoles.includes(role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}