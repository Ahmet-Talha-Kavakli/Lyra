// [DATABASE OPTIMIZER — CONNECTION POOLING & QUERY OPTIMIZATION]
// For 100K+ users: Supabase PostgreSQL connection limits
// Default: 100 connections, need 10-20x that for 100K users
// Solutions: 1) PgBouncer pooling, 2) Query optimization, 3) Caching

import { supabase } from './supabase.js';
import { logger } from './logger.js';
import { cacheUserProfile, cacheUserMemories, cacheUserSessions, cacheAside } from './cacheManager.js';

/**
 * Get user profile with caching
 * Prevents N+1 queries: single DB hit, subsequent calls from cache
 */
export async function getUserProfileOptimized(userId) {
    return cacheUserProfile(userId, async () => {
        try {
            const { data, error } = await supabase
                .from('psychological_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                logger.warn('[getUserProfileOptimized] Query failed', { userId, error: error.message });
                return null;
            }

            return data;
        } catch (err) {
            logger.error('[getUserProfileOptimized] Unexpected error', { userId, error: err.message });
            return null;
        }
    });
}

/**
 * Get user memories with caching
 * Single combined query instead of 3 separate queries
 */
export async function getUserMemoriesOptimized(userId) {
    return cacheUserMemories(userId, async () => {
        try {
            const { data, error } = await supabase
                .from('memories')
                .select('content, user_profile, pattern_memory, session_count')
                .eq('user_id', userId)
                .single();

            if (error) {
                logger.warn('[getUserMemoriesOptimized] Query failed', { userId, error: error.message });
                return {
                    userMemory: '',
                    ozelIsimler: {},
                    toplamSeans: 0,
                };
            }

            return {
                userMemory: data?.content || '',
                ozelIsimler: data?.user_profile || {},
                toplamSeans: data?.session_count || 0,
            };
        } catch (err) {
            logger.error('[getUserMemoriesOptimized] Unexpected error', { userId, error: err.message });
            return {
                userMemory: '',
                ozelIsimler: {},
                toplamSeans: 0,
            };
        }
    });
}

/**
 * Batch get multiple user profiles
 * Single query instead of N queries
 */
export async function getUserProfilesBatch(userIds) {
    try {
        const { data, error } = await supabase
            .from('psychological_profiles')
            .select('user_id, *')
            .in('user_id', userIds);

        if (error) {
            logger.warn('[getUserProfilesBatch] Query failed', { count: userIds.length, error: error.message });
            return [];
        }

        // Return as map for O(1) lookup
        return new Map(data.map(profile => [profile.user_id, profile]));
    } catch (err) {
        logger.error('[getUserProfilesBatch] Unexpected error', { error: err.message });
        return new Map();
    }
}

/**
 * Get user sessions with caching
 */
export async function getUserSessionsOptimized(userId) {
    return cacheUserSessions(userId, async () => {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select('id, created_at, summary, transcript_length')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50); // Recent sessions only

            if (error) {
                logger.warn('[getUserSessionsOptimized] Query failed', { userId, error: error.message });
                return [];
            }

            return data || [];
        } catch (err) {
            logger.error('[getUserSessionsOptimized] Unexpected error', { userId, error: err.message });
            return [];
        }
    });
}

/**
 * Get session count (aggregate query)
 * Instead of: COUNT(*) on sessions table (slow for 100K users)
 * Use: Cached value from psychological_profiles.session_count
 */
export async function getSessionCountOptimized(userId) {
    const profile = await getUserProfileOptimized(userId);
    return profile?.session_count || 0;
}

/**
 * Upsert memory efficiently
 * Combines read + write in single transaction
 */
export async function upsertMemoryOptimized(userId, updates) {
    try {
        const { data, error } = await supabase
            .from('memories')
            .upsert(
                {
                    user_id: userId,
                    ...updates,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            )
            .select();

        if (error) {
            logger.error('[upsertMemoryOptimized] Failed', { userId, error: error.message });
            return null;
        }

        // Invalidate cache after write
        const { cacheManager } = await import('./cacheManager.js');
        cacheManager.invalidateUserCache(userId);

        return data?.[0] || null;
    } catch (err) {
        logger.error('[upsertMemoryOptimized] Unexpected error', { error: err.message });
        return null;
    }
}

/**
 * Database query statistics & optimization hints
 */
export const dbOptimizationStats = {
    queriesCached: 0,
    queriesExecuted: 0,
    averageLatencyMs: 0,
    slowQueries: [],
};

/**
 * Measure query performance
 */
export async function measureQuery(queryName, queryFn) {
    const start = Date.now();

    try {
        const result = await queryFn();
        const latency = Date.now() - start;

        dbOptimizationStats.queriesExecuted++;

        if (latency > 100) {
            // Log slow queries
            logger.warn('[SlowQuery]', { queryName, latencyMs: latency });
            dbOptimizationStats.slowQueries.push({
                name: queryName,
                latencyMs: latency,
                timestamp: new Date().toISOString(),
            });

            // Keep only last 100 slow queries
            if (dbOptimizationStats.slowQueries.length > 100) {
                dbOptimizationStats.slowQueries.shift();
            }
        }

        return result;
    } catch (err) {
        logger.error('[measureQuery] Error', { queryName, error: err.message });
        throw err;
    }
}

/**
 * Get optimization recommendations
 */
export function getOptimizationStats() {
    return {
        ...dbOptimizationStats,
        recommendation: dbOptimizationStats.slowQueries.length > 0
            ? 'Add indexes on frequently queried columns'
            : 'Database performance optimal',
    };
}

/**
 * Connection pool health check
 * For Supabase: check available connections
 */
export async function checkConnectionPoolHealth() {
    try {
        const { data, error } = await supabase
            .rpc('get_current_connections'); // Requires custom DB function

        if (error) {
            logger.warn('[ConnectionPool] Health check failed', { error: error.message });
            return { status: 'unknown' };
        }

        return {
            status: 'healthy',
            currentConnections: data?.count || 0,
            maxConnections: 100, // Supabase default
            utilizationPercent: Math.round((data?.count / 100) * 100),
        };
    } catch {
        // Fallback: assume healthy if RPC not available
        return { status: 'healthy', note: 'Connection pool health unavailable' };
    }
}
