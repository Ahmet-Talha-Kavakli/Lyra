/**
 * Response Caching Layer
 * Reduces OpenAI API calls + costs
 * Caches similar responses for 24 hours
 */

import { redis } from '../shared/redis.js';
import { logger } from './logging/logger.js';

/**
 * Generate cache key from messages
 * Hash similar prompts to same key
 */
function generateCacheKey(messages, model = 'gpt-4o-mini') {
    // Simple hash: first 3 user messages
    const key = messages
        .filter(m => m.role === 'user')
        .slice(0, 3)
        .map(m => m.content.substring(0, 100))
        .join('|')
        .substring(0, 200);

    // Use SHA256 for shorter key
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(key).digest('hex');

    return `cache:openai:${model}:${hash}`;
}

/**
 * Get cached response
 */
export async function getCachedResponse(messages, model = 'gpt-4o-mini') {
    try {
        const key = generateCacheKey(messages, model);
        const cached = await redis.get(key);

        if (cached) {
            logger.debug('[ResponseCache] Cache hit', { key });
            return JSON.parse(cached);
        }

        return null;
    } catch (error) {
        logger.warn('[ResponseCache] Cache read error', { error: error.message });
        return null; // Fall through to API
    }
}

/**
 * Cache response
 */
export async function cacheResponse(messages, response, model = 'gpt-4o-mini', ttl = 86400) {
    try {
        const key = generateCacheKey(messages, model);

        await redis.setex(key, ttl, JSON.stringify({
            ...response,
            cached: true,
            cachedAt: new Date().toISOString()
        }));

        logger.debug('[ResponseCache] Response cached', { key, ttl });
    } catch (error) {
        logger.warn('[ResponseCache] Cache write error', { error: error.message });
        // Non-blocking: if cache fails, don't error out
    }
}

/**
 * Cache stats
 */
export async function getCacheStats() {
    try {
        const keys = await redis.keys('cache:openai:*');
        return {
            cachedResponses: keys.length,
            estimatedCostSaved: (keys.length * 0.0005).toFixed(4) // ~$0.0005 per cached response
        };
    } catch (error) {
        logger.warn('[ResponseCache] Stats error', { error: error.message });
        return { cachedResponses: 0, estimatedCostSaved: 0 };
    }
}

/**
 * Clear old cache entries
 * Run daily via cron
 */
export async function clearExpiredCache() {
    try {
        const keys = await redis.keys('cache:openai:*');
        let deleted = 0;

        for (const key of keys) {
            const ttl = await redis.ttl(key);
            // Redis handles TTL automatically, but log cleanup
            if (ttl === -1) { // No expiry set
                await redis.del(key);
                deleted++;
            }
        }

        logger.info('[ResponseCache] Cleanup complete', { deleted });
    } catch (error) {
        logger.warn('[ResponseCache] Cleanup error', { error: error.message });
    }
}
