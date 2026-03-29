// [MEMORY PROFILER — HEAP ANALYSIS & LEAK DETECTION]
// For 100K users: track memory per user, identify bloat

import { logger } from './logger.js';

/**
 * Memory snapshot
 */
export function takeMemorySnapshot(label = 'default') {
    const mem = process.memoryUsage();
    return {
        timestamp: new Date().toISOString(),
        label,
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024),
        rssMA: Math.round(mem.rss / 1024 / 1024),
    };
}

/**
 * Track memory trend over time
 */
class MemoryTrend {
    constructor(maxSnapshots = 100) {
        this.snapshots = [];
        this.maxSnapshots = maxSnapshots;
    }

    add(label) {
        const snapshot = takeMemorySnapshot(label);
        this.snapshots.push(snapshot);

        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }

        return snapshot;
    }

    getStats() {
        if (this.snapshots.length === 0) {
            return null;
        }

        const heapValues = this.snapshots.map(s => s.heapUsedMB);
        const minHeap = Math.min(...heapValues);
        const maxHeap = Math.max(...heapValues);
        const avgHeap = Math.round(heapValues.reduce((a, b) => a + b, 0) / heapValues.length);

        // Detect trend
        const firstHalf = heapValues.slice(0, Math.floor(heapValues.length / 2));
        const secondHalf = heapValues.slice(Math.floor(heapValues.length / 2));
        const firstAvg = Math.round(firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length);
        const secondAvg = Math.round(secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length);

        const trend = secondAvg > firstAvg
            ? 'increasing (potential leak)'
            : 'stable';

        return {
            snapshots: this.snapshots.length,
            minHeapMB: minHeap,
            maxHeapMB: maxHeap,
            avgHeapMB: avgHeap,
            delta: maxHeap - minHeap,
            trend,
            latest: this.snapshots[this.snapshots.length - 1],
        };
    }

    report() {
        const stats = this.getStats();
        if (!stats) return;

        logger.info('[MemoryTrend] Report', {
            snapshots: stats.snapshots,
            minHeap: `${stats.minHeapMB}MB`,
            maxHeap: `${stats.maxHeapMB}MB`,
            avgHeap: `${stats.avgHeapMB}MB`,
            delta: `${stats.delta}MB`,
            trend: stats.trend,
        });

        return stats;
    }
}

export const memoryTrend = new MemoryTrend();

/**
 * Monitor memory per time interval
 */
export function startMemoryMonitoring(intervalMs = 60000) {
    const interval = setInterval(() => {
        memoryTrend.add('periodic');
        const stats = memoryTrend.getStats();

        if (stats.trend === 'increasing (potential leak)') {
            logger.warn('[MemoryMonitor] Potential memory leak detected', {
                delta: `${stats.delta}MB`,
                current: `${stats.latest.heapUsedMB}MB`,
            });
        }
    }, intervalMs);

    logger.info('[MemoryMonitor] Started', { intervalMs });

    return () => {
        clearInterval(interval);
        logger.info('[MemoryMonitor] Stopped');
    };
}

/**
 * Estimate memory per user (for scaling calculations)
 */
export function estimatePerUserMemory() {
    const mem = process.memoryUsage();

    // Rough estimates
    return {
        heapPerUserKB: Math.round((mem.heapUsed / 1024) / 100), // Assuming ~100 users per instance
        estimatedUsersPerGB: Math.round((1024 * 1024) / ((mem.heapUsed / 1024) / 100)),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    };
}

/**
 * Alert on high memory usage
 */
export function checkMemoryHealth(thresholdPercent = 85) {
    const mem = process.memoryUsage();
    const usedPercent = (mem.heapUsed / mem.heapTotal) * 100;

    if (usedPercent > thresholdPercent) {
        logger.error('[MemoryHealth] ALERT: High memory usage', {
            usedPercent: Math.round(usedPercent),
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        });

        return {
            status: 'critical',
            usedPercent: Math.round(usedPercent),
        };
    }

    return {
        status: usedPercent > 70 ? 'warning' : 'healthy',
        usedPercent: Math.round(usedPercent),
    };
}

/**
 * Get detailed heap info for debugging
 */
export function getHeapInfo() {
    const mem = process.memoryUsage();
    const v8 = require('v8');

    try {
        const heapStats = v8.getHeapStatistics();
        const heapSpaces = v8.getHeapSpaceStatistics();

        return {
            heap: {
                used: Math.round(mem.heapUsed / 1024 / 1024),
                total: Math.round(mem.heapTotal / 1024 / 1024),
                limit: Math.round(heapStats.heap_size_limit / 1024 / 1024),
                percentUsed: Math.round((mem.heapUsed / heapStats.heap_size_limit) * 100),
            },
            spaces: heapSpaces.map(space => ({
                name: space.space_name,
                sizeMB: Math.round(space.space_size / 1024 / 1024),
                usedMB: Math.round(space.space_used_size / 1024 / 1024),
                percentUsed: Math.round((space.space_used_size / space.space_size) * 100),
            })),
            gc: {
                external: Math.round(mem.external / 1024 / 1024),
                rss: Math.round(mem.rss / 1024 / 1024),
            },
        };
    } catch (err) {
        logger.warn('[getHeapInfo] V8 API not available', { error: err.message });
        return null;
    }
}

/**
 * Estimate 100K user requirements
 */
export function estimateScalingRequirements() {
    const stats = memoryTrend.getStats();
    if (!stats) {
        return null;
    }

    const currentHeapMB = stats.latest.heapUsedMB;
    const heapPerUserMB = currentHeapMB / 100; // Assume 100 users in current instance

    return {
        currentHeapMB,
        heapPerUserMB: heapPerUserMB.toFixed(2),
        for100KUsers: {
            totalHeapGBNeeded: ((heapPerUserMB * 100000) / 1024).toFixed(1),
            instancesNeeded: Math.ceil((heapPerUserMB * 100000) / 1024 / 2), // 2GB per instance
            databaseConnectionsNeeded: Math.ceil(100000 / 100 * 2), // 2 connections per user
            redisMemoryGBNeeded: Math.ceil((heapPerUserMB * 100000 * 0.1) / 1024), // 10% of heap for cache
        },
    };
}

// Start monitoring on import
if (process.env.NODE_ENV === 'production') {
    startMemoryMonitoring(60000); // Check every minute
}
