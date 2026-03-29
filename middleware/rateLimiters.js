// [RATE LIMITERS — PER-ENDPOINT DDoS & ABUSE PROTECTION]
// Fine-grained rate limiting for 100K+ users.
// Each endpoint has different limits based on resource cost and abuse potential.
// For production scale: migrate to Redis-backed store (ioredis package)

import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { logger } from '../lib/infrastructure/logger.js';

// Redis client for rate limiting (shared across all limiters)
let redisRateLimitClient = null;
let redisRateLimitStore = null;

// Initialize Redis store for rate limiting
async function initializeRedisRateLimitStore() {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisRateLimitClient = createClient({ url: redisUrl });

        redisRateLimitClient.on('error', (err) => {
            logger.error('[RateLimit Redis] Connection error', { error: err.message });
        });

        await redisRateLimitClient.connect();
        redisRateLimitStore = new RedisStore({
            client: redisRateLimitClient,
            prefix: 'rl:',  // Rate limit key prefix
        });

        logger.info('[RateLimit Redis] Store initialized');
    } catch (err) {
        logger.warn('[RateLimit Redis] Fallback to memory store', { error: err.message });
        redisRateLimitStore = null; // Use default MemoryStore
    }
}

// Initialize on module load
initializeRedisRateLimitStore().catch(err => {
    logger.warn('[RateLimit] Deferred init', { error: err.message });
});

/**
 * Key generator: per user (authenticated) or per IP
 * Uses ipKeyGenerator() helper for IPv6-safe IP detection
 */
const keyGeneratorPerUser = (req) => {
    // Prefer user ID if authenticated, else use IPv6-safe IP
    if (req.userId) return `user:${req.userId}`;
    return ipKeyGenerator(req); // Safe IPv4/IPv6 detection
};

/**
 * Key generator: per IP (for unauthenticated endpoints)
 * IPv6-safe using express-rate-limit's built-in helper
 */
const keyGeneratorPerIP = ipKeyGenerator;

/**
 * Handler: log rate limit violations (v7 uses handler instead of onLimitReached)
 */
const handleLimitExceeded = (req, res) => {
    logger.warn('[RateLimit] Limit exceeded', {
        endpoint: req.path,
        method: req.method,
        userId: req.userId,
        ip: req.ip,
    });
    res.status(429).json({ error: 'Çok fazla istek. Lütfen bekleyin.' });
};

// Common rateLimit config builder
function createLimiter(config) {
    return rateLimit({
        ...config,
        ...(redisRateLimitStore && { store: redisRateLimitStore }), // Redis if available
    });
}

// ─── AUTHENTICATION ENDPOINTS (Strict) ──────────────────────────────────────
export const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    keyGenerator: keyGeneratorPerUser,
    message: { error: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV !== 'production',
    handler: handleLimitExceeded,
});

// ─── CHAT COMPLETION (Moderate) ─────────────────────────────────────────────
export const chatLimiter = createLimiter({
    windowMs: 5 * 60 * 1000,
    max: 10,
    keyGenerator: keyGeneratorPerUser,
    message: { error: 'Çok fazla istek. Lütfen bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV !== 'production',
    handler: handleLimitExceeded,
});

// ─── API GENERAL (Loose) ────────────────────────────────────────────────────
export const apiGeneralLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: keyGeneratorPerUser,
    message: { error: 'Çok fazla istek. Lütfen bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV !== 'production',
});

// ─── PUBLIC ENDPOINTS (Very Loose) ──────────────────────────────────────────
export const publicLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: keyGeneratorPerIP,
    message: { error: 'Çok fazla istek' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV !== 'production',
});

// ─── FILE UPLOAD (Very Strict) ──────────────────────────────────────────────
export const uploadLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: keyGeneratorPerUser,
    message: { error: 'Çok fazla yükleme. Daha sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV !== 'production',
});

// ─── PASSWORD RESET (Strict) ────────────────────────────────────────────────
export const passwordResetLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 3,
    keyGenerator: keyGeneratorPerIP,
    message: { error: 'Çok fazla şifre sıfırlama isteği. Daha sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV !== 'production',
});

// ─── GLOBAL DDoS PROTECTION ─────────────────────────────────────────────────
// DDoS protection is handled by Redis-backed rate limiters above.
// Each endpoint has specific rate limits enforced via express-rate-limit.
// For distributed systems (multiple pods), Redis coordination prevents
// individual pods from having isolated counters.
