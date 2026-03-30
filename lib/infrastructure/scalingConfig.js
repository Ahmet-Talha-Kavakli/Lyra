/**
 * Auto-Scaling Configuration
 * Vercel serverless auto-scales, but we need to monitor + tune
 *
 * Metrics:
 * - Cold start time: < 500ms
 * - Function duration: < 10s (ideal < 3s)
 * - Concurrent executions: unlimited
 * - Memory: 3GB per function
 */

import { config } from './config.js';
import { logger } from './logging/logger.js';

class ScalingMonitor {
    constructor() {
        this.metrics = {
            startTime: Date.now(),
            requestCount: 0,
            totalDuration: 0,
            slowRequests: 0, // > 5s
            verySlowRequests: 0, // > 10s
            errors: 0,
            coldStarts: 0
        };

        this.thresholds = {
            slowRequestThreshold: 5000, // 5s
            verySlowThreshold: 10000, // 10s
            errorRateThreshold: 0.05, // 5%
            coldStartThreshold: 500 // 500ms
        };
    }

    /**
     * Record request metrics
     */
    recordRequest(duration, error = null) {
        this.metrics.requestCount++;
        this.metrics.totalDuration += duration;

        if (error) {
            this.metrics.errors++;
        }

        if (duration > this.thresholds.verySlowThreshold) {
            this.metrics.verySlowRequests++;
        } else if (duration > this.thresholds.slowRequestThreshold) {
            this.metrics.slowRequests++;
        }

        // Log slow requests
        if (duration > this.thresholds.slowRequestThreshold) {
            logger.warn('[Scaling] Slow request detected', {
                duration,
                requestCount: this.metrics.requestCount
            });
        }
    }

    /**
     * Detect cold start (first request after deployment)
     */
    recordColdStart(duration) {
        this.metrics.coldStarts++;

        logger.info('[Scaling] Cold start detected', {
            duration,
            coldStarts: this.metrics.coldStarts
        });

        if (duration > this.thresholds.coldStartThreshold) {
            logger.warn('[Scaling] Cold start exceeded threshold', {
                duration,
                threshold: this.thresholds.coldStartThreshold
            });
        }
    }

    /**
     * Get scaling metrics
     */
    getMetrics() {
        const uptime = Date.now() - this.metrics.startTime;
        const avgDuration = this.metrics.requestCount > 0
            ? (this.metrics.totalDuration / this.metrics.requestCount).toFixed(2)
            : 0;

        const errorRate = this.metrics.requestCount > 0
            ? (this.metrics.errors / this.metrics.requestCount).toFixed(4)
            : 0;

        const slowRequestRate = this.metrics.requestCount > 0
            ? ((this.metrics.slowRequests + this.metrics.verySlowRequests) / this.metrics.requestCount).toFixed(4)
            : 0;

        return {
            uptime,
            requestCount: this.metrics.requestCount,
            avgDuration: `${avgDuration}ms`,
            errorRate: `${(errorRate * 100).toFixed(2)}%`,
            slowRequests: this.metrics.slowRequests,
            verySlowRequests: this.metrics.verySlowRequests,
            slowRequestRate: `${(slowRequestRate * 100).toFixed(2)}%`,
            coldStarts: this.metrics.coldStarts,
            health: this.getHealth()
        };
    }

    /**
     * Health status
     */
    getHealth() {
        const errorRate = this.metrics.requestCount > 0
            ? this.metrics.errors / this.metrics.requestCount
            : 0;

        const slowRate = this.metrics.requestCount > 0
            ? (this.metrics.slowRequests + this.metrics.verySlowRequests) / this.metrics.requestCount
            : 0;

        if (errorRate > this.thresholds.errorRateThreshold) return 'unhealthy';
        if (slowRate > 0.1) return 'degraded'; // > 10% slow
        return 'healthy';
    }

    /**
     * Reset metrics (daily)
     */
    reset() {
        this.metrics = {
            startTime: Date.now(),
            requestCount: 0,
            totalDuration: 0,
            slowRequests: 0,
            verySlowRequests: 0,
            errors: 0,
            coldStarts: 0
        };

        logger.info('[Scaling] Metrics reset');
    }
}

export const scalingMonitor = new ScalingMonitor();

/**
 * Middleware to track request duration
 */
export function scalingMiddleware(req, res, next) {
    const startTime = Date.now();
    const isColdStart = req.headers['x-vercel-id'] === undefined; // First request after deploy

    if (isColdStart) {
        scalingMonitor.recordColdStart(0); // Will be updated after
    }

    // Track response time
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const error = res.statusCode >= 400;

        scalingMonitor.recordRequest(duration, error);

        if (isColdStart) {
            // Update cold start time
            scalingMonitor.metrics.coldStarts--; // Remove 0 entry
            scalingMonitor.recordColdStart(duration);
        }
    });

    next();
}

/**
 * Vercel Environment Configuration
 * Add these to vercel.json
 */
export const vercelConfig = {
    functions: {
        'api/index.js': {
            maxDuration: 30, // 30s timeout (can be up to 60s for Enterprise)
            memory: 3008, // 3GB (max for standard)
            includeFiles: [
                'lib/**',
                'middleware/**',
                'routes/**',
                'src/**',
                'node_modules/**'
            ],
            excludeFiles: [
                'frontend/**',
                'node_modules/.cache/**',
                '*.test.js'
            ]
        }
    },
    // Regions for global deployment
    regions: ['iad1', 'sfo1', 'lhr1', 'sin1'], // US, EU, Asia
    // Environment variables
    env: {
        NODE_ENV: 'production',
        OPENAI_API_KEY: '@openai_api_key',
        DATABASE_URL: '@database_url',
        REDIS_URL: '@redis_url',
        JWT_SECRET: '@jwt_secret',
        SENTRY_DSN: '@sentry_dsn'
    }
};

/**
 * Scaling recommendations based on metrics
 */
export function getScalingRecommendations() {
    const metrics = scalingMonitor.getMetrics();
    const recommendations = [];

    const slowRate = parseFloat(metrics.slowRequestRate);
    if (slowRate > 0.1) {
        recommendations.push({
            issue: 'High slow request rate',
            rate: metrics.slowRequestRate,
            action: 'Optimize database queries + API calls',
            priority: 'high'
        });
    }

    const errorRate = parseFloat(metrics.errorRate);
    if (errorRate > 0.05) {
        recommendations.push({
            issue: 'High error rate',
            rate: metrics.errorRate,
            action: 'Check logs + error monitoring',
            priority: 'critical'
        });
    }

    if (metrics.coldStarts > 5) {
        recommendations.push({
            issue: 'Frequent cold starts',
            count: metrics.coldStarts,
            action: 'Enable Vercel Functions "Proactive Cold Start" or increase concurrency',
            priority: 'medium'
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            issue: 'All metrics healthy',
            action: 'Continue monitoring',
            priority: 'low'
        });
    }

    return recommendations;
}
