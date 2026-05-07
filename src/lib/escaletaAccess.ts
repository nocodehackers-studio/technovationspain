// Client-side gate for the public escaleta page.
// The password is shared internally and not a real security boundary —
// the unguessable token in the URL is. Rate limit + sessionStorage just
// reduce casual abuse and avoid re-prompting on refresh.

export const ESCALETA_PASSWORD = 'Technovation.2026';
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const attemptsKey = (token: string) => `escaleta:attempts:${token}`;
const authKey = (token: string) => `escaleta:auth:${token}`;

const safeLocalStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

const safeSessionStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function getRecentAttempts(token: string, now: number = Date.now()): number[] {
  const ls = safeLocalStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(attemptsKey(token));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((ts): ts is number => typeof ts === 'number' && Number.isFinite(ts))
      .filter(ts => now - ts < LOCKOUT_MS);
  } catch {
    return [];
  }
}

export function recordAttempt(token: string, now: number = Date.now()): number[] {
  const ls = safeLocalStorage();
  const recent = getRecentAttempts(token, now);
  const next = [...recent, now];
  if (ls) {
    try {
      ls.setItem(attemptsKey(token), JSON.stringify(next));
    } catch {
      // ignore — degrade to no-op
    }
  }
  return next;
}

export interface LockoutStatus {
  locked: boolean;
  secondsRemaining: number;
  attemptsLeft: number;
}

export function getLockoutStatus(token: string, now: number = Date.now()): LockoutStatus {
  const recent = getRecentAttempts(token, now);
  if (recent.length < MAX_ATTEMPTS) {
    return {
      locked: false,
      secondsRemaining: 0,
      attemptsLeft: MAX_ATTEMPTS - recent.length,
    };
  }
  const oldest = Math.min(...recent);
  const remainingMs = Math.max(0, LOCKOUT_MS - (now - oldest));
  return {
    locked: remainingMs > 0,
    secondsRemaining: Math.ceil(remainingMs / 1000),
    attemptsLeft: 0,
  };
}

export function clearAttempts(token: string): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(attemptsKey(token));
  } catch {
    // ignore
  }
}

export function markAuthenticated(token: string): void {
  const ss = safeSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(authKey(token), '1');
  } catch {
    // ignore
  }
}

export function isAuthenticated(token: string): boolean {
  const ss = safeSessionStorage();
  if (!ss) return false;
  try {
    return ss.getItem(authKey(token)) === '1';
  } catch {
    return false;
  }
}

export function clearAuth(token: string): void {
  const ss = safeSessionStorage();
  if (!ss) return;
  try {
    ss.removeItem(authKey(token));
  } catch {
    // ignore
  }
}

export function formatLockoutCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
