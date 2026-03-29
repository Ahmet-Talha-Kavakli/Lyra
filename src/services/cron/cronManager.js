/**
 * Cron Manager - Distributed Lock-Based Execution
 *
 * CRITICAL FIX (DAY 1):
 * - Now uses real Redis locks (was in-memory Map)
 * - Multiple pods: only ONE executes cron job
 * - Prevents: duplicate data processing, duplicate API calls, duplicate billing
 * - Lock TTL: 1 hour (auto-release if pod crashes)
 */

import { logger } from '../../../lib/logger.js';
import { acquireLock, releaseLock } from '../cache/redisService.js';

const LOCK_DURATION = 3600; // 1 hour in seconds

class CronManager {
    /**
     * Try to acquire distributed lock for cron job
     * Uses Redis: only succeeds on one pod
     * Returns: true if lock acquired, false if another pod has it
     */
    async acquireLock(jobName) {
        try {
            const acquired = await acquireLock(`cron:${jobName}`, LOCK_DURATION);

            if (acquired) {
                logger.info('[CronLock] ✅ Lock acquired - executing', {
                    jobName,
                    duration: `${LOCK_DURATION}s`,
                    backend: 'Redis'
                });
                return true;
            } else {
                logger.info('[CronLock] ⏭️  Lock exists - skipping', {
                    jobName,
                    reason: 'Another pod is handling this job'
                });
                return false;
            }
        } catch (err) {
            logger.error('[CronLock] Acquisition failed', { jobName, error: err.message });
            // Fail-safe: don't execute if lock fails
            return false;
        }
    }

    /**
     * Release lock after job completes
     */
    async releaseLock(jobName) {
        try {
            await releaseLock(`cron:${jobName}`);
            logger.info('[CronLock] Lock released', { jobName });
            return true;
        } catch (err) {
            logger.error('[CronLock] Release failed', { jobName, error: err.message });
            // Redis will auto-expire, no action needed
            return false;
        }
    }

    /**
     * Execute job with lock protection
     * Safe for 1, 10, or 100 pods - only one runs job
     */
    async executeWithLock(jobName, jobHandler) {
        const hasLock = await this.acquireLock(jobName);

        if (!hasLock) {
            // Another pod is handling it
            return { success: false, reason: 'lock_held_by_another_pod', skipped: true };
        }

        try {
            logger.info(`[CRON] Executing: ${jobName}`);
            const result = await jobHandler();

            await this.releaseLock(jobName);
            logger.info(`[CRON] Completed: ${jobName}`, { success: true });

            return { success: true, result };
        } catch (err) {
            logger.error(`[CRON] Failed: ${jobName}`, { error: err.message });
            await this.releaseLock(jobName);

            return { success: false, error: err.message };
        }
    }

    /**
     * Health check: verify lock system working
     */
    async healthCheck() {
        try {
            const testJobName = '_health_check_';
            const lockAcquired = await this.acquireLock(testJobName);

            if (lockAcquired) {
                await this.releaseLock(testJobName);
                return { status: 'healthy', message: 'Cron lock system working' };
            } else {
                return { status: 'degraded', message: 'Lock in use (expected during execution)' };
            }
        } catch (err) {
            return { status: 'unhealthy', error: err.message };
        }
    }
}

export const cronManager = new CronManager();
