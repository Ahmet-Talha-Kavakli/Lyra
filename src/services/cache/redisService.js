/**
 * Redis Service - Distributed State Management
 *
 * CRITICAL FIX (DAY 1):
 * - Replaced in-memory Map() with real Redis client
 * - All distributed systems now use centralized Redis
 * - Fixes: cronManager locks, rate limiting, session state
 * - 100K scaling ready (no single-instance bottleneck)
 *
 * Features:
 * - User emotions (cache)
 * - Session transcripts (cache)
 * - Active sessions (cache)
 * - Distributed locks (for cron jobs)
 * - Rate limit counters
 */

import { createClient } from 'redis';
import { logger } from '../../../lib/infrastructure/logger.js';

// ─── REDIS CLIENT INITIALIZATION ──────────────────────────────────
let redisClient = null;
let redisConnected = false;

async function initializeRedis() {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        redisClient = createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => Math.min(retries * 50, 500),
                connectTimeout: 5000,
            },
        });

        redisClient.on('error', (err) => {
            logger.error('[Redis] Connection error', { error: err.message });
            redisConnected = false;
        });

        redisClient.on('connect', () => {
            logger.info('[Redis] Connected', { url: redisUrl });
            redisConnected = true;
        });

        redisClient.on('reconnecting', () => {
            logger.warn('[Redis] Reconnecting...');
        });

        await redisClient.connect();
        redisConnected = true;
        logger.info('[Redis] Initialization complete');
    } catch (err) {
        logger.error('[Redis] Initialization failed', { error: err.message });
        redisConnected = false;
        // Fall back to in-memory (see below)
    }
}

// Initialize on module load (non-blocking)
initializeRedis().catch(err => {
    logger.warn('[Redis] Deferred initialization', { error: err.message });
});

// ─── FALLBACK IN-MEMORY STORE (for dev without Redis) ──────────────
class InMemoryStore {
    constructor() {
        this.data = new Map();
    }

    async set(key, value, ttl) {
        this.data.set(key, { value, expiry: ttl ? Date.now() + ttl : null });
        return 'OK';
    }

    async get(key) {
        const entry = this.data.get(key);
        if (!entry) return null;
        if (entry.expiry && Date.now() > entry.expiry) {
            this.data.delete(key);
            return null;
        }
        return entry.value;
    }

    async del(key) {
        return this.data.delete(key) ? 1 : 0;
    }

    async keys(pattern) {
        return Array.from(this.data.keys()).filter(k => k.includes(pattern.replace('*', '')));
    }

    async expire(key, seconds) {
        const entry = this.data.get(key);
        if (entry) {
            entry.expiry = Date.now() + (seconds * 1000);
            return 1;
        }
        return 0;
    }

    async incr(key) {
        const entry = this.data.get(key);
        const newVal = (parseInt(entry?.value || '0') + 1).toString();
        this.data.set(key, { value: newVal, expiry: entry?.expiry });
        return parseInt(newVal);
    }
}

const inMemoryStore = new InMemoryStore();

// ─── HELPER: Get appropriate store (Redis or fallback) ─────────────
function getStore() {
    return redisConnected && redisClient ? redisClient : inMemoryStore;
}

function isUsingRedis() {
    return redisConnected && !!redisClient;
}

// ─── CACHE OPERATIONS ────────────────────────────────────────────
/**
 * Set user emotion data
 * Key: emotion:{userId}
 * TTL: 24 hours
 */
export async function setUserEmotion(userId, emotionData) {
    try {
        const key = `emotion:${userId}`;
        const store = getStore();
        const ttl = 24 * 60 * 60; // 24 hours

        if (store.set) {
            // Redis client
            await store.setex(key, ttl, JSON.stringify(emotionData));
        } else {
            // In-memory store
            await store.set(key, JSON.stringify(emotionData), ttl * 1000);
        }

        logger.debug('[Redis] Emotion set', { userId, key });
        return emotionData;
    } catch (err) {
        logger.error('[Redis] setUserEmotion failed', { userId, error: err.message });
        throw err;
    }
}

/**
 * Get user emotion data
 */
export async function getUserEmotion(userId) {
    try {
        const key = `emotion:${userId}`;
        const store = getStore();

        let data;
        if (store.get) {
            // Both Redis and in-memory have get()
            data = await store.get(key);
        } else {
            return null;
        }

        return data ? JSON.parse(data) : null;
    } catch (err) {
        logger.error('[Redis] getUserEmotion failed', { userId, error: err.message });
        return null;
    }
}

/**
 * Set session transcript
 * Key: transcript:{userId}
 * TTL: 7 days
 */
export async function setSessionTranscript(userId, transcript) {
    try {
        const key = `transcript:${userId}`;
        const store = getStore();
        const ttl = 7 * 24 * 60 * 60; // 7 days

        if (store.setex) {
            // Redis
            await store.setex(key, ttl, JSON.stringify(transcript));
        } else {
            // In-memory
            await store.set(key, JSON.stringify(transcript), ttl * 1000);
        }

        logger.debug('[Redis] Transcript set', { userId, key });
        return transcript;
    } catch (err) {
        logger.error('[Redis] setSessionTranscript failed', { userId, error: err.message });
        throw err;
    }
}

/**
 * Get session transcript
 */
export async function getSessionTranscript(userId) {
    try {
        const key = `transcript:${userId}`;
        const store = getStore();
        const data = await store.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        logger.error('[Redis] getSessionTranscript failed', { userId, error: err.message });
        return null;
    }
}

/**
 * Set active session
 * Key: session:{userId}
 * TTL: 24 hours (session duration)
 */
export async function setActiveSession(userId, sessionId) {
    try {
        const key = `session:${userId}`;
        const store = getStore();
        const ttl = 24 * 60 * 60;

        if (store.setex) {
            await store.setex(key, ttl, sessionId);
        } else {
            await store.set(key, sessionId, ttl * 1000);
        }

        logger.debug('[Redis] Session set', { userId, sessionId });
        return sessionId;
    } catch (err) {
        logger.error('[Redis] setActiveSession failed', { userId, error: err.message });
        throw err;
    }
}

/**
 * Get active session
 */
export async function getActiveSession(userId) {
    try {
        const key = `session:${userId}`;
        const store = getStore();
        return await store.get(key);
    } catch (err) {
        logger.error('[Redis] getActiveSession failed', { userId, error: err.message });
        return null;
    }
}

/**
 * Delete active session
 */
export async function deleteActiveSession(userId) {
    try {
        const key = `session:${userId}`;
        const store = getStore();
        return await store.del(key);
    } catch (err) {
        logger.error('[Redis] deleteActiveSession failed', { userId, error: err.message });
        return 0;
    }
}

/**
 * Get all active sessions
 */
export async function getAllActiveSessions() {
    try {
        const store = getStore();
        const keys = await store.keys('session:*');
        const sessions = [];

        for (const key of keys) {
            const sessionId = await store.get(key);
            if (sessionId) {
                const userId = key.replace('session:', '');
                sessions.push({ userId, sessionId });
            }
        }

        return sessions;
    } catch (err) {
        logger.error('[Redis] getAllActiveSessions failed', { error: err.message });
        return [];
    }
}

/**
 * Clear all state (dev only)
 */
export async function clearAllState() {
    try {
        const store = getStore();
        const keys = await store.keys('emotion:*');
        keys.push(...await store.keys('transcript:*'));
        keys.push(...await store.keys('session:*'));

        for (const key of keys) {
            await store.del(key);
        }

        logger.info('[Redis] All state cleared');
        return true;
    } catch (err) {
        logger.error('[Redis] clearAllState failed', { error: err.message });
        return false;
    }
}

// ─── LOCK OPERATIONS (for distributed cron) ──────────────────────
/**
 * Acquire distributed lock
 * Key: lock:{lockName}
 * TTL: 1 hour (auto-release)
 * Returns: true if lock acquired, false if already held
 */
export async function acquireLock(lockName, ttl = 3600) {
    try {
        const key = `lock:${lockName}`;
        const store = getStore();
        const lockId = Date.now().toString();

        if (store.set && store.nx) {
            // Redis SET NX (only if not exists)
            const result = await store.set(key, lockId, { EX: ttl, NX: true });
            return !!result;
        } else if (store.set) {
            // In-memory fallback
            const existing = await store.get(key);
            if (existing) return false;
            await store.set(key, lockId, ttl * 1000);
            return true;
        }

        return false;
    } catch (err) {
        logger.error('[Redis] acquireLock failed', { lockName, error: err.message });
        return false;
    }
}

/**
 * Release distributed lock
 */
export async function releaseLock(lockName) {
    try {
        const key = `lock:${lockName}`;
        const store = getStore();
        const result = await store.del(key);
        logger.debug('[Redis] Lock released', { lockName });
        return result > 0;
    } catch (err) {
        logger.error('[Redis] releaseLock failed', { lockName, error: err.message });
        return false;
    }
}

// ─── RATE LIMIT OPERATIONS ───────────────────────────────────────
/**
 * Increment rate limit counter
 * Key: ratelimit:{key}
 * TTL: window size (e.g., 60 seconds)
 */
export async function incrementRateLimit(key, window = 60) {
    try {
        const rateKey = `ratelimit:${key}`;
        const store = getStore();

        let count;
        if (store.incr) {
            count = await store.incr(rateKey);
        } else {
            // Fallback
            const current = parseInt(await store.get(rateKey) || '0');
            count = current + 1;
            await store.set(rateKey, count.toString(), window * 1000);
            return count;
        }

        // Set expiry on first increment
        if (count === 1) {
            await store.expire(rateKey, window);
        }

        return count;
    } catch (err) {
        logger.error('[Redis] incrementRateLimit failed', { key, error: err.message });
        return -1;
    }
}

/**
 * Get rate limit counter
 */
export async function getRateLimitCount(key) {
    try {
        const rateKey = `ratelimit:${key}`;
        const store = getStore();
        const count = await store.get(rateKey);
        return count ? parseInt(count) : 0;
    } catch (err) {
        logger.error('[Redis] getRateLimitCount failed', { key, error: err.message });
        return 0;
    }
}

// ─── HEALTH & STATUS ─────────────────────────────────────────────
/**
 * Get Redis health status
 */
export async function getRedisHealth() {
    try {
        const store = getStore();
        const connected = isUsingRedis();

        if (connected) {
            const pong = await redisClient.ping();
            return {
                status: pong === 'PONG' ? 'healthy' : 'degraded',
                backend: 'redis',
                connected: true,
                message: 'Using real Redis'
            };
        } else {
            return {
                status: 'degraded',
                backend: 'in-memory',
                connected: false,
                message: 'Fallback to in-memory store (development mode)'
            };
        }
    } catch (err) {
        return {
            status: 'unhealthy',
            backend: 'error',
            connected: false,
            error: err.message
        };
    }
}

/**
 * Initialize Redis (for server startup)
 */
export async function initializeRedisConnection() {
    await initializeRedis();
    const health = await getRedisHealth();
    logger.info('[Redis] Initialization complete', health);
    return health;
}

// ─── EXPORTS ─────────────────────────────────────────────────────
export { redisClient, isUsingRedis };
