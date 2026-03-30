import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

/**
 * Stateless JWT Denylist Manager
 * Invalidates tokens instantly across all Vercel Edge instances
 * - Logout: token added to denylist until expiration
 * - Password change: all tokens of user revoked
 * - Account locked: all tokens revoked
 */

export class TokenDenylist {
  /**
   * Add single token to denylist (until JWT expiration)
   * @param token JWT token
   * @param expiresIn TTL in seconds (usually JWT.exp - now)
   */
  static async revokeToken(token: string, expiresIn: number = 3600): Promise<void> {
    try {
      const key = `lyra:denylist:${token}`;
      await redis.setex(key, expiresIn, 'true');
    } catch (error) {
      console.error('[TokenDenylist] Failed to revoke token:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user (password change, account locked, etc)
   * @param userId Supabase user ID
   * @param ttlSeconds How long to keep the revocation active
   */
  static async revokeUserSessions(userId: string, ttlSeconds: number = 86400): Promise<void> {
    try {
      const key = `lyra:revoke_user:${userId}`;
      await redis.setex(key, ttlSeconds, 'true');
    } catch (error) {
      console.error('[TokenDenylist] Failed to revoke user sessions:', error);
      throw error;
    }
  }

  /**
   * Check if token is denylisted (called from middleware)
   */
  static async isTokenDenylisted(token: string): Promise<boolean> {
    try {
      const isDenylisted = await redis.get(`lyra:denylist:${token}`);
      return isDenylisted === 'true';
    } catch {
      return false; // Fail-open for availability
    }
  }

  /**
   * Check if user's all sessions are revoked
   */
  static async areUserSessionsRevoked(userId: string): Promise<boolean> {
    try {
      const isRevoked = await redis.get(`lyra:revoke_user:${userId}`);
      return isRevoked === 'true';
    } catch {
      return false; // Fail-open for availability
    }
  }

  /**
   * Validate token (check both individual AND user-wide revocation)
   */
  static async validateToken(token: string, userId: string): Promise<boolean> {
    const tokenDenylisted = await this.isTokenDenylisted(token);
    const userSessionsRevoked = await this.areUserSessionsRevoked(userId);
    return !tokenDenylisted && !userSessionsRevoked;
  }
}
