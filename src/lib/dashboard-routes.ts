import { AppRole } from '@/types/database';

/**
 * Returns the correct dashboard path based on user role.
 * Judges are detected via the is_judge profile flag, not via AppRole.
 */
export function getDashboardPath(role: AppRole | null, isJudge?: boolean): string {
  // Admin/ambassador roles take priority even if the user is also a judge
  if (role === 'admin' || role === 'chapter_ambassador') return '/admin';
  if (isJudge) return '/judge/dashboard';

  switch (role) {
    case 'mentor':
      return '/mentor/dashboard';
    case 'collaborator':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}
