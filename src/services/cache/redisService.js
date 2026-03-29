// [REDIS SERVICE — Distributed State Management]
// Replaces lib/state.js (in-memory Map) with Redis
// For 100K users: stateless across multiple instances

import { logger } from '../logging/logger.js';

// Fallback in-memory cache (for development without Redis)
class InMemoryStateStore {
    constructor() {
        this.userEmotions = new Map();
        this.sessionTranscripts = new Map();
        this.activeSessions = new Map();
    }

    async setUserEmotion(userId, emotionData) {
        this.userEmotions.set(userId, emotionData);
        return emotionData;
    }

    async getUserEmotion(userId) {
        return this.userEmotions.get(userId) || null;
    }

    async setSessionTranscript(userId, transcript) {
        this.sessionTranscripts.set(userId, transcript);
        return transcript;
    }

    async getSessionTranscript(userId) {
        return this.sessionTranscripts.get(userId) || null;
    }

    async setActiveSession(userId, sessionId) {
        this.activeSessions.set(userId, sessionId);
        return sessionId;
    }

    async getActiveSession(userId) {
        return this.activeSessions.get(userId) || null;
    }

    async deleteActiveSession(userId) {
        return this.activeSessions.delete(userId);
    }

    async getAllActiveSessions() {
        return Array.from(this.activeSessions.values());
    }

    async clear() {
        this.userEmotions.clear();
        this.sessionTranscripts.clear();
        this.activeSessions.clear();
    }
}

// Check if Redis available
let redisClient = null;
let useRedis = false;

// Try to initialize Redis (optional, fallback to in-memory)
try {
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        // Redis will be initialized here in AŞAMA 3
        // For now: use in-memory
        logger.info('[RedisService] Redis URL detected, will use Redis in AŞAMA 3');
        useRedis = false; // Still in-memory for compatibility
    }
} catch (err) {
    logger.warn('[RedisService] Redis initialization deferred', { error: err.message });
    useRedis = false;
}

// State store instance
const stateStore = new InMemoryStateStore();

/**
 * Set user emotion data
 * Redis key: emotion:{userId}
 */
export async function setUserEmotion(userId, emotionData) {
    try {
        if (useRedis && redisClient) {
            // Future: Redis implementation
            // await redisClient.set(`emotion:${userId}`, JSON.stringify(emotionData), 'EX', 3600);
        }
        return await stateStore.setUserEmotion(userId, emotionData);
    } catch (err) {
        logger.error('[setUserEmotion] Error', { userId, error: err.message });
        throw err;
    }
}

/**
 * Get user emotion data
 */
export async function getUserEmotion(userId) {
    try {
        if (useRedis && redisClient) {
            // Future: const data = await redisClient.get(`emotion:${userId}`);
        }
        return await stateStore.getUserEmotion(userId);
    } catch (err) {
        logger.error('[getUserEmotion] Error', { userId, error: err.message });
        return null;
    }
}

/**
 * Set session transcript
 * Redis key: transcript:{userId}
 */
export async function setSessionTranscript(userId, transcript) {
    try {
        if (useRedis && redisClient) {
            // Future: Redis implementation
        }
        return await stateStore.setSessionTranscript(userId, transcript);
    } catch (err) {
        logger.error('[setSessionTranscript] Error', { userId, error: err.message });
        throw err;
    }
}

/**
 * Get session transcript
 */
export async function getSessionTranscript(userId) {
    try {
        if (useRedis && redisClient) {
            // Future: const data = await redisClient.get(`transcript:${userId}`);
        }
        return await stateStore.getSessionTranscript(userId);
    } catch (err) {
        logger.error('[getSessionTranscript] Error', { userId, error: err.message });
        return null;
    }
}

/**
 * Set active session for user
 * Redis key: session:active:{userId}
 */
export async function setActiveSession(userId, sessionId) {
    try {
        if (useRedis && redisClient) {
            // Future: Redis implementation
        }
        return await stateStore.setActiveSession(userId, sessionId);
    } catch (err) {
        logger.error('[setActiveSession] Error', { userId, sessionId, error: err.message });
        throw err;
    }
}

/**
 * Get active session for user
 */
export async function getActiveSession(userId) {
    try {
        if (useRedis && redisClient) {
            // Future: const sessionId = await redisClient.get(`session:active:${userId}`);
        }
        return await stateStore.getActiveSession(userId);
    } catch (err) {
        logger.error('[getActiveSession] Error', { userId, error: err.message });
        return null;
    }
}

/**
 * Delete active session
 */
export async function deleteActiveSession(userId) {
    try {
        if (useRedis && redisClient) {
            // Future: await redisClient.del(`session:active:${userId}`);
        }
        return await stateStore.deleteActiveSession(userId);
    } catch (err) {
        logger.error('[deleteActiveSession] Error', { userId, error: err.message });
        throw err;
    }
}

/**
 * Get all active sessions (for monitoring)
 */
export async function getAllActiveSessions() {
    try {
        if (useRedis && redisClient) {
            // Future: SCAN pattern
        }
        return await stateStore.getAllActiveSessions();
    } catch (err) {
        logger.error('[getAllActiveSessions] Error', { error: err.message });
        return [];
    }
}

/**
 * Clear all state (for testing/cleanup)
 */
export async function clearAllState() {
    try {
        if (useRedis && redisClient) {
            // Future: await redisClient.flushdb();
        }
        await stateStore.clear();
        logger.info('[clearAllState] All state cleared');
    } catch (err) {
        logger.error('[clearAllState] Error', { error: err.message });
    }
}

/**
 * Initialize Redis client (AŞAMA 3)
 */
export async function initializeRedis(redisUrl) {
    try {
        // Placeholder for AŞAMA 3
        logger.info('[Redis] Initialization deferred to AŞAMA 3', { url: redisUrl });
        // redisClient will be initialized here
        // useRedis = true;
    } catch (err) {
        logger.error('[Redis] Initialization failed, using in-memory fallback', { error: err.message });
        useRedis = false;
    }
}

/**
 * Health check
 */
export async function getRedisHealth() {
    return {
        type: useRedis ? 'redis' : 'in-memory',
        connected: useRedis ? (redisClient ? true : false) : true,
        status: 'healthy',
    };
}

// Export state store for backward compatibility (temporary)
export { stateStore };
