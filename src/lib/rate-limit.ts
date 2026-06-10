// Simple in-memory rate limiter
// For production, use Redis or similar

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil: number | null;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    // Remove entries older than 30 minutes
    if (now - entry.firstAttempt > 30 * 60 * 1000) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number | null;
  retryAfterMinutes: number | null;
}

/**
 * Check if a request should be rate limited
 * @param key - Unique identifier (e.g., member_id, IP address)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with allowed status and retry info
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
  }
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);

  // Check if currently blocked
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    const retryAfterMs = entry.blockedUntil - now;
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs,
      retryAfterMinutes: Math.ceil(retryAfterMs / 60000),
    };
  }

  // Reset if window has passed or first attempt
  if (!entry || now - entry.firstAttempt > config.windowMs) {
    entry = {
      attempts: 0,
      firstAttempt: now,
      blockedUntil: null,
    };
    store.set(key, entry);
  }

  // Increment attempts
  entry.attempts++;

  // Check if exceeded
  if (entry.attempts > config.maxAttempts) {
    entry.blockedUntil = now + config.blockDurationMs;
    const retryAfterMs = config.blockDurationMs;
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs,
      retryAfterMinutes: Math.ceil(retryAfterMs / 60000),
    };
  }

  return {
    allowed: true,
    remainingAttempts: config.maxAttempts - entry.attempts,
    retryAfterMs: null,
    retryAfterMinutes: null,
  };
}

/**
 * Reset rate limit for a key (e.g., after successful login)
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
