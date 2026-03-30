/**
 * Upstash Redis Client
 * Replaces in-memory Map-based cache (cacheManager.js)
 * Stateless, HTTP-based, multi-instance shared cache
 *
 * Why Upstash over redis-js:
 * - HTTP interface (no persistent TCP connections - perfect for Vercel)
 * - Automatic retry + exponential backoff built-in
 * - No socket leak issues on Lambda cold starts
 * - Works across distributed Vercel instances
 * - Free tier: 10K commands/day
 */

import { Redis } from '@upstash/redis';
import { logger } from '../infrastructure/logger';

const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;

if (!redisToken || !redisUrl) {
  logger.error('UPSTASH_REDIS_REST_TOKEN or UPSTASH_REDIS_REST_URL not configured');
  // Don't throw - allow fallback to in-memory cache for local dev
}

// Lazy-init Redis client
let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis && redisToken && redisUrl) {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
      automaticDeserialization: true // Handle JSON automatically
    });
  }
  return redis as Redis;
}

/**
 * Cache Manager Interface (replaces lib/infrastructure/cacheManager.js)
 */

export async function cacheGet(key: string): Promise<any | null> {
  try {
    if (!redisToken || !redisUrl) {
      logger.debug('[Cache] Upstash not configured, returning null', { key });
      return null;
    }

    const client = getRedisClient();
    const value = await client.get(key);
    return value || null;
  } catch (error: any) {
    logger.warn('[Cache] Get failed, returning null', { key, error: error.message });
    return null; // Fail open - don't crash if cache is down
  }
}

export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds?: number
): Promise<void> {
  try {
    if (!redisToken || !redisUrl) {
      logger.debug('[Cache] Upstash not configured, skipping set', { key });
      return;
    }

    const client = getRedisClient();

    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, JSON.stringify(value));
    } else {
      await client.set(key, value);
    }
  } catch (error: any) {
    logger.warn('[Cache] Set failed', { key, error: error.message });
    // Don't crash - cache is best-effort
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    if (!redisToken || !redisUrl) return;

    const client = getRedisClient();
    await client.del(key);
  } catch (error: any) {
    logger.warn('[Cache] Delete failed', { key, error: error.message });
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  try {
    if (!redisToken || !redisUrl) return false;

    const client = getRedisClient();
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error: any) {
    logger.warn('[Cache] Exists check failed', { key, error: error.message });
    return false;
  }
}

export async function cacheTTL(key: string): Promise<number> {
  try {
    if (!redisToken || !redisUrl) return -1;

    const client = getRedisClient();
    const ttl = await client.ttl(key);
    return ttl;
  } catch (error: any) {
    logger.warn('[Cache] TTL check failed', { key, error: error.message });
    return -1;
  }
}

/**
 * Rate Limiting (replaces setInterval cleanup in routes)
 * Uses Redis counter with TTL
 *
 * Example: rateLimit('email:user@example.com', 5, 3600)
 *   = max 5 requests per 3600 seconds from that IP
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    if (!redisToken || !redisUrl) {
      logger.debug('[RateLimit] Upstash not configured, allowing request', { key });
      return true; // Allow if cache is down
    }

    const client = getRedisClient();
    const current = await client.incr(key);

    if (current === 1) {
      // First request in this window, set expiry
      await client.expire(key, windowSeconds);
    }

    return current <= maxRequests;
  } catch (error: any) {
    logger.warn('[RateLimit] Check failed, allowing request', { key, error: error.message });
    return true; // Fail open
  }
}

/**
 * Leaky bucket algorithm for token generation
 * Used for adaptive rate limiting
 */
export async function tokenBucket(
  key: string,
  capacity: number,
  refillRate: number,
  refillIntervalSeconds: number
): Promise<{ allowed: boolean; tokensRemaining: number }> {
  try {
    if (!redisToken || !redisUrl) {
      return { allowed: true, tokensRemaining: capacity };
    }

    const client = getRedisClient();
    const now = Date.now();
    const stateKey = `bucket:${key}:state`;
    const lastRefillKey = `bucket:${key}:lastRefill`;

    // Get current state
    const stateStr = await client.get(stateKey);
    let tokens = stateStr ? parseInt(stateStr as string) : capacity;
    const lastRefill = await client.get(lastRefillKey);
    const lastRefillTime = lastRefill ? parseInt(lastRefill as string) : now;

    // Calculate tokens to add based on time elapsed
    const elapsedSeconds = (now - lastRefillTime) / 1000;
    const tokensToAdd = Math.min(
      Math.floor((elapsedSeconds / refillIntervalSeconds) * refillRate),
      capacity - tokens
    );

    tokens = Math.min(capacity, tokens + tokensToAdd);

    // Check if request allowed
    const allowed = tokens > 0;
    if (allowed) {
      tokens--;
    }

    // Save state
    await client.set(stateKey, tokens.toString(), { ex: refillIntervalSeconds * 10 });
    await client.set(lastRefillKey, now.toString(), { ex: refillIntervalSeconds * 10 });

    return { allowed, tokensRemaining: Math.max(0, tokens) };
  } catch (error: any) {
    logger.warn('[TokenBucket] Failed, allowing request', { key, error: error.message });
    return { allowed: true, tokensRemaining: capacity };
  }
}

/**
 * Distributed Lock (for cron jobs across multiple instances)
 * Returns lock ID if acquired, null if already locked
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number = 60
): Promise<string | null> {
  try {
    if (!redisToken || !redisUrl) {
      return `local-${Date.now()}`; // Fallback for local dev
    }

    const client = getRedisClient();
    const lockId = `lock-${Date.now()}-${Math.random()}`;

    // NX = only set if doesn't exist
    const result = await client.set(key, lockId, {
      nx: true,
      ex: ttlSeconds
    });

    return result === 'OK' ? lockId : null;
  } catch (error: any) {
    logger.warn('[Lock] Acquire failed', { key, error: error.message });
    return null;
  }
}

export async function releaseLock(key: string, lockId: string): Promise<boolean> {
  try {
    if (!redisToken || !redisUrl) return true;

    const client = getRedisClient();
    const current = await client.get(key);

    // Only release if lock ID matches (prevent releasing someone else's lock)
    if (current === lockId) {
      await client.del(key);
      return true;
    }

    return false;
  } catch (error: any) {
    logger.warn('[Lock] Release failed', { key, error: error.message });
    return false;
  }
}

export default {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheExists,
  cacheTTL,
  rateLimit,
  tokenBucket,
  acquireLock,
  releaseLock
};
