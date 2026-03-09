// In-memory account lockout tracker
// For production at scale, replace with Redis

interface LockoutEntry {
  attempts: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

const lockouts = new Map<string, LockoutEntry>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // Clean stale entries every 30 min

// Periodically clean up stale entries
setInterval(() => {
  const now = Date.now();
  lockouts.forEach((entry, key) => {
    if (now - entry.lastAttempt > LOCKOUT_DURATION_MS * 2) {
      lockouts.delete(key);
    }
  });
}, CLEANUP_INTERVAL_MS);

export function isAccountLocked(email: string): { locked: boolean; remainingMs?: number } {
  const entry = lockouts.get(email.toLowerCase());
  if (!entry || !entry.lockedUntil) return { locked: false };

  const now = Date.now();
  if (now >= entry.lockedUntil) {
    // Lockout expired, reset
    lockouts.delete(email.toLowerCase());
    return { locked: false };
  }

  return { locked: true, remainingMs: entry.lockedUntil - now };
}

export function recordFailedLogin(email: string): { locked: boolean; attemptsRemaining: number } {
  const key = email.toLowerCase();
  const now = Date.now();
  const entry = lockouts.get(key) || { attempts: 0, lockedUntil: null, lastAttempt: now };

  entry.attempts += 1;
  entry.lastAttempt = now;

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    lockouts.set(key, entry);
    return { locked: true, attemptsRemaining: 0 };
  }

  lockouts.set(key, entry);
  return { locked: false, attemptsRemaining: MAX_ATTEMPTS - entry.attempts };
}

export function clearFailedLogins(email: string): void {
  lockouts.delete(email.toLowerCase());
}
