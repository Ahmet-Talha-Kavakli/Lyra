// [CRON MANAGER — Redis Lock-Based Distributed Cron]
// Prevents duplicate execution across multiple instances
// Single primary pod runs cron, others skip if lock exists

import { logger } from '../logging/logger.js';

const LOCK_DURATION = 3600; // 1 hour

class CronManager {
    constructor() {
        this.locks = new Map(); // In-memory lock tracking (dev mode)
    }

    /**
     * Try to acquire lock for cron job
     * Returns true if acquired, false if another instance has it
     */
    async acquireLock(jobName) {
        const lockKey = `cron:lock:${jobName}`;

        // Dev mode: in-memory lock
        if (this.locks.has(lockKey)) {
            const lockTime = this.locks.get(lockKey);
            if (Date.now() - lockTime < LOCK_DURATION * 1000) {
                logger.info('[CronLock] Lock exists, skipping', { jobName });
                return false;
            }
        }

        // Acquire lock
        this.locks.set(lockKey, Date.now());
        logger.info('[CronLock] Lock acquired', { jobName, duration: LOCK_DURATION });
        return true;
    }

    /**
     * Release lock after job completes
     */
    async releaseLock(jobName) {
        const lockKey = `cron:lock:${jobName}`;
        this.locks.delete(lockKey);
        logger.info('[CronLock] Lock released', { jobName });
    }

    /**
     * Schedule job with lock protection
     */
    async executeWithLock(jobName, jobHandler) {
        const hasLock = await this.acquireLock(jobName);

        if (!hasLock) {
            logger.warn('[CronLock] Job skipped (another instance running)', { jobName });
            return { success: false, reason: 'lock_exists' };
        }

        try {
            logger.info('[CronLock] Executing job', { jobName });
            const result = await jobHandler();
            logger.info('[CronLock] Job completed', { jobName });
            return { success: true, result };
        } catch (err) {
            logger.error('[CronLock] Job failed', { jobName, error: err.message });
            return { success: false, error: err.message };
        } finally {
            await this.releaseLock(jobName);
        }
    }
}

export const cronManager = new CronManager();
