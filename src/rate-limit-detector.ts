/**
 * Rate Limit Detection Utility
 *
 * Detects rate limiting errors and connection failures from different protocols
 * and suggests cooldown periods
 */

export interface RateLimitDetection {
  isRateLimited: boolean;
  errorType: string;
  cooldownMs?: number;
  suggestedRetryAfter?: number;
  isConnectionFailure?: boolean;
}

/**
 * Detect if an error is a rate limit error and extract retry information
 */
export function detectRateLimit(error: Error, protocol: string): RateLimitDetection {
  const errorMsg = error.message.toLowerCase();
  const errorStr = error.toString().toLowerCase();

  // XMTP rate limiting
  if (protocol === 'XMTP' || protocol === 'XMTP V3') {
    if (
      errorMsg.includes('rate limit') ||
      errorMsg.includes('too many requests') ||
      errorMsg.includes('429')
    ) {
      return {
        isRateLimited: true,
        errorType: 'rate_limit',
        cooldownMs: 60000, // 1 minute default
      };
    }
  }

  // Nostr relay rate limiting
  if (protocol.includes('Nostr')) {
    if (
      errorMsg.includes('rate limit') ||
      errorMsg.includes('rate-limit') ||
      errorMsg.includes('too fast') ||
      errorMsg.includes('slow down')
    ) {
      return {
        isRateLimited: true,
        errorType: 'rate_limit',
        cooldownMs: 30000, // 30 seconds for Nostr
      };
    }

    // Some relays send "blocked" for rate limiting
    if (errorMsg.includes('blocked') || errorMsg.includes('restricted')) {
      return {
        isRateLimited: true,
        errorType: 'rate_limit',
        cooldownMs: 60000,
      };
    }
  }

  // MQTT broker rate limiting
  if (protocol === 'MQTT') {
    if (
      errorMsg.includes('quota') ||
      errorMsg.includes('throttle') ||
      errorMsg.includes('rate limit')
    ) {
      return {
        isRateLimited: true,
        errorType: 'rate_limit',
        cooldownMs: 60000,
      };
    }

    // Connection limit errors
    if (errorMsg.includes('connection limit') || errorMsg.includes('max connections')) {
      return {
        isRateLimited: true,
        errorType: 'connection_limit',
        cooldownMs: 120000, // 2 minutes
      };
    }
  }

  // Waku rate limiting (less common but possible)
  if (protocol === 'Waku') {
    if (errorMsg.includes('rate limit') || errorMsg.includes('throttle')) {
      return {
        isRateLimited: true,
        errorType: 'rate_limit',
        cooldownMs: 60000,
      };
    }
  }

  // IROH rate limiting
  if (protocol === 'IROH') {
    if (errorMsg.includes('rate limit') || errorMsg.includes('throttle')) {
      return {
        isRateLimited: true,
        errorType: 'rate_limit',
        cooldownMs: 60000,
      };
    }
  }

  // Generic HTTP 429 detection
  if (errorMsg.includes('429') || errorMsg.includes('too many requests')) {
    // Try to extract Retry-After header value
    const retryAfterMatch = errorStr.match(/retry[- ]?after[:\s]+(\d+)/i);
    const retryAfterSeconds = retryAfterMatch ? parseInt(retryAfterMatch[1]) : null;

    return {
      isRateLimited: true,
      errorType: 'rate_limit',
      cooldownMs: retryAfterSeconds ? retryAfterSeconds * 1000 : 60000,
      suggestedRetryAfter: retryAfterSeconds || undefined,
    };
  }

  // Check for connection-related errors that should trigger cooldown
  if (
    errorMsg.includes('connection refused') ||
    errorMsg.includes('connection failed') ||
    errorMsg.includes('econnrefused') ||
    errorMsg.includes('bad username or password') ||
    errorMsg.includes('authentication failed') ||
    errorMsg.includes('not authorized')
  ) {
    return {
      isRateLimited: true, // Treat as rate limit for cooldown purposes
      errorType: 'connection_failure',
      cooldownMs: 5 * 60 * 1000, // 5 minutes for connection failures
      isConnectionFailure: true,
    };
  }

  // Check for network timeout errors (shorter cooldown)
  if (
    errorMsg.includes('timeout') ||
    errorMsg.includes('etimedout') ||
    errorMsg.includes('network error')
  ) {
    return {
      isRateLimited: true, // Treat as rate limit for cooldown purposes
      errorType: 'network_timeout',
      cooldownMs: 2 * 60 * 1000, // 2 minutes for timeouts
      isConnectionFailure: true,
    };
  }

  // Generic connection error
  if (errorMsg.includes('connection') || errorMsg.includes('network')) {
    return {
      isRateLimited: true,
      errorType: 'network',
      cooldownMs: 3 * 60 * 1000, // 3 minutes for generic network errors
      isConnectionFailure: true,
    };
  }

  // Generic error (don't trigger cooldown)
  return {
    isRateLimited: false,
    errorType: 'unknown',
  };
}

/**
 * Calculate exponential backoff for rate limit cooldowns
 */
export function calculateBackoff(attemptNumber: number, baseMs: number = 1000): number {
  const maxBackoff = 5 * 60 * 1000; // 5 minutes max
  const backoff = Math.min(baseMs * Math.pow(2, attemptNumber), maxBackoff);

  // Add jitter (±25%)
  const jitter = backoff * 0.25 * (Math.random() - 0.5) * 2;

  return Math.round(backoff + jitter);
}

/**
 * Get human-readable cooldown message
 */
export function formatCooldown(cooldownMs: number): string {
  const seconds = Math.round(cooldownMs / 1000);

  if (seconds < 60) {
    return `${seconds} seconds`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}
