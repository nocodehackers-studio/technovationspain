import { AppRole } from '@/types/database';

/**
 * Returns the correct dashboard path based on user role.
 */
export function getDashboardPath(role: AppRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'chapter_ambassador':
      return '/admin';
    case 'mentor':
      return '/mentor/dashboard';
    default:
      return '/dashboard';
  }
}
