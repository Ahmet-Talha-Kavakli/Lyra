// [RATE LIMITERS — PER-ENDPOINT DDoS & ABUSE PROTECTION]
// Fine-grained rate limiting for 100K+ users.
// Each endpoint has different limits based on resource cost and abuse potential.
// For production scale: migrate to Redis-backed store (ioredis package)

import { rateLimit } from 'express-rate-limit';
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
 * For production, use Redis-backed store with ipKeyGenerator helper
 * Dev mode: simple fallback
 */
const keyGeneratorPerUser = (req) => {
    // In production, call ipKeyGenerator for IPv6 support
    // For dev: simple user ID or client IP
    return req.userId ? `user:${req.userId}` : (req.ip || 'unknown');
};

/**
 * Key generator: per IP (for unauthenticated endpoints)
 */
const keyGeneratorPerIP = (req) => {
    return req.ip || 'unknown';
};

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

// ─── GLOBAL DDoS PROTECTION (Circuit Breaker) ───────────────────────────────
// If ANY endpoint gets >1000 req/min from single IP, block for 5 mins
class DDoSDetector {
    constructor() {
        this.ipStats = new Map();
        this.blockedIPs = new Set();
        this.blockExpiry = new Map();

        // Cleanup expired blocks every minute
        setInterval(() => {
            const now = Date.now();
            for (const [ip, expiry] of this.blockExpiry.entries()) {
                if (expiry < now) {
                    this.blockedIPs.delete(ip);
                    this.blockExpiry.delete(ip);
                }
            }
        }, 60 * 1000);
    }

    check(ip) {
        // Check if currently blocked
        if (this.blockedIPs.has(ip)) {
            return { blocked: true, reason: 'DDoS detection active' };
        }

        // Track request
        if (!this.ipStats.has(ip)) {
            this.ipStats.set(ip, { count: 0, window: Date.now() });
        }

        const stats = this.ipStats.get(ip);
        const now = Date.now();

        // Reset window every minute
        if (now - stats.window > 60 * 1000) {
            stats.count = 1;
            stats.window = now;
            return { blocked: false };
        }

        stats.count++;

        // If >1000 requests in 60 seconds, block for 5 minutes
        if (stats.count > 1000) {
            this.blockedIPs.add(ip);
            this.blockExpiry.set(ip, now + 5 * 60 * 1000);
            logger.error('[DDoS] IP blocked', { ip, requestCount: stats.count });
            return { blocked: true, reason: 'DDoS protection triggered' };
        }

        return { blocked: false };
    }

    getStats() {
        return {
            trackedIPs: this.ipStats.size,
            blockedIPs: this.blockedIPs.size,
        };
    }
}

export const ddosDetector = new DDoSDetector();

/**
 * Middleware: Global DDoS protection check
 */
export function ddosProtectionMiddleware(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Skip localhost in dev
    if (process.env.NODE_ENV !== 'production' && (clientIP === '127.0.0.1' || clientIP === '::1')) {
        return next();
    }

    const check = ddosDetector.check(clientIP);

    if (check.blocked) {
        logger.warn('[DDoS] Request blocked', { ip: clientIP, reason: check.reason });
        return res.status(429).json({ error: 'Çok fazla istek. Daha sonra tekrar deneyin.' });
    }

    next();
}

/**
 * Get rate limiter stats for monitoring
 */
export function getRateLimitStats() {
    return {
        ddos: ddosDetector.getStats(),
        timestamp: new Date().toISOString(),
    };
}
