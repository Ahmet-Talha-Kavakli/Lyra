/**
 * JWT MANAGER - Production Cookie & Token Management
 *
 * SECURITY GUARANTEES:
 * - HttpOnly cookies (XSS proof)
 * - Secure flag (HTTPS only in production)
 * - SameSite=Strict (CSRF proof)
 * - Token rotation (refresh token cycle)
 * - Automatic revocation (JWT denylist)
 * - Zero client-side storage (no localStorage)
 *
 * FLOW:
 * 1. Login → Supabase returns access_token + refresh_token
 * 2. Set HttpOnly cookies + secure flags
 * 3. Frontend uses cookies automatically (credentials: 'include')
 * 4. Token expires → Frontend calls /api/auth/refresh
 * 5. New token returned → cycle repeats
 * 6. Logout → Token added to denylist (Redis)
 */

import { VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { logger } from './logger';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

interface JwtPayload {
  sub: string; // User ID
  email: string;
  iat: number; // Issued at
  exp: number; // Expiration
  aud: string; // Audience
}

/**
 * Parse JWT without verification (fast)
 * Use for: deduplication, caching decisions
 * DON'T use for: security decisions
 */
export function parseJwtUnsafe(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

/**
 * Set secure HttpOnly cookies (login response)
 *
 * SECURITY:
 * - HttpOnly: JavaScript can't access (XSS proof)
 * - Secure: HTTPS only in production
 * - SameSite=Strict: No cross-site requests (CSRF proof)
 * - Path=/: Available everywhere
 *
 * COOKIE LIFECYCLE:
 * - access_token: 1 hour (short-lived)
 * - refresh_token: 30 days (long-lived)
 *
 * Frontend sends these automatically (credentials: 'include')
 */
export function setAuthCookies(
  res: VercelResponse,
  accessToken: string,
  refreshToken: string,
  accessTokenExpiresIn: number = 3600, // 1 hour
  refreshTokenExpiresIn: number = 2592000 // 30 days
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Access token (short-lived, high security)
  res.appendHeader(
    'Set-Cookie',
    `lyra_access_token=${accessToken}; Path=/; HttpOnly; ${
      isProduction ? 'Secure;' : ''
    } SameSite=Strict; Max-Age=${accessTokenExpiresIn}`
  );

  // Refresh token (long-lived, used to get new access token)
  res.appendHeader(
    'Set-Cookie',
    `lyra_refresh_token=${refreshToken}; Path=/api/auth/refresh; HttpOnly; ${
      isProduction ? 'Secure;' : ''
    } SameSite=Strict; Max-Age=${refreshTokenExpiresIn}`
  );

  logger.info('[JWT] Auth cookies set', {
    accessTokenExpiresIn,
    refreshTokenExpiresIn
  });
}

/**
 * Clear auth cookies (logout)
 * Set Max-Age=0 to delete immediately
 */
export function clearAuthCookies(res: VercelResponse): void {
  res.appendHeader('Set-Cookie', 'lyra_access_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
  res.appendHeader('Set-Cookie', 'lyra_refresh_token=; Path=/api/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=0');

  logger.info('[JWT] Auth cookies cleared');
}

/**
 * Revoke token (add to denylist)
 *
 * WHY NOT just delete from database?
 * - Database: Slow (disk I/O), requires query
 * - Redis: Fast (in-memory), O(1) lookup
 * - Stateless: No session table needed
 * - Global: Instant across all Vercel Edge instances
 *
 * USAGE:
 * - Logout: revoke access_token + refresh_token
 * - Password change: revoke all user's tokens
 * - Account locked: revoke all user's tokens
 */
export async function revokeToken(
  token: string,
  reason: string = 'logout'
): Promise<void> {
  try {
    const payload = parseJwtUnsafe(token);
    if (!payload) {
      logger.warn('[JWT] Token parse failed during revocation', { reason });
      return;
    }

    // Calculate TTL: token's expiration time - now
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = Math.max(payload.exp - nowSeconds, 60); // Min 60 seconds

    const key = `lyra:denylist:${token}`;
    await redis.setex(key, ttlSeconds, 'true');

    logger.info('[JWT] Token revoked', {
      userId: payload.sub,
      reason,
      ttlSeconds
    });
  } catch (error: any) {
    logger.error('[JWT] Token revocation failed', {
      error: error.message,
      reason
    });
    // Don't throw - revocation failure is non-critical
  }
}

/**
 * Revoke ALL tokens for a user
 *
 * Use when:
 * - User changes password
 * - Account locked
 * - Suspicious activity detected
 *
 * Effect: All old tokens become invalid immediately
 */
export async function revokeAllUserTokens(
  userId: string,
  reason: string = 'password_change',
  ttlSeconds: number = 86400 // 24 hours
): Promise<void> {
  try {
    const key = `lyra:revoke_user:${userId}`;
    await redis.setex(key, ttlSeconds, 'true');

    logger.info('[JWT] All user tokens revoked', {
      userId,
      reason,
      ttlSeconds
    });
  } catch (error: any) {
    logger.error('[JWT] User token revocation failed', {
      userId,
      error: error.message,
      reason
    });
    throw error;
  }
}

/**
 * Check if token is valid (not revoked)
 *
 * Returns:
 * - true: Token is valid, use it
 * - false: Token is revoked, reject request
 *
 * Failure mode: ALLOW (fail-open)
 * If Redis is down, we allow the token to pass
 * (security impact = very low, availability impact = very high)
 */
export async function isTokenValid(token: string, userId: string): Promise<boolean> {
  try {
    // Check individual token revocation
    const tokenDenylisted = await redis.get(`lyra:denylist:${token}`);
    if (tokenDenylisted === 'true') {
      logger.warn('[JWT] Token is denylisted', { userId });
      return false;
    }

    // Check user-wide revocation (all tokens for this user revoked)
    const userRevoked = await redis.get(`lyra:revoke_user:${userId}`);
    if (userRevoked === 'true') {
      logger.warn('[JWT] All user tokens revoked', { userId });
      return false;
    }

    return true;
  } catch (error: any) {
    logger.error('[JWT] Token validation failed', {
      error: error.message,
      userId
    });
    // Fail-open: allow token to pass (Redis error, not auth error)
    return true;
  }
}

/**
 * Check if user has active sessions (NOT revoked)
 */
export async function hasActiveSession(userId: string): Promise<boolean> {
  try {
    const userRevoked = await redis.get(`lyra:revoke_user:${userId}`);
    return userRevoked !== 'true';
  } catch {
    return true; // Fail-open
  }
}

export default {
  parseJwtUnsafe,
  setAuthCookies,
  clearAuthCookies,
  revokeToken,
  revokeAllUserTokens,
  isTokenValid,
  hasActiveSession
};
